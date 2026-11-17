const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { admin, auth } = require('../config/firebase');
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const { uploadImageToCloudinary } = require('../utils/cloudinary');
const { sendComplaintNotification } = require('../utils/notificationService');

// Ensure local uploads directory exists for fallback
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Fallback helper: Save uploaded buffer to local uploads/ directory if Cloudinary is unavailable
 */
async function saveLocalImageBuffer(buffer, originalname = 'proof.jpg') {
  const extension = path.extname(originalname) || '.jpg';
  const filename = `proof_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${extension}`;
  const filePath = path.join(UPLOAD_DIR, filename);
  await fs.promises.writeFile(filePath, buffer);
  return `/uploads/${filename}`;
}

/**
 * Upload image buffer to Cloudinary with local disk fallback
 */
async function uploadProofImage(buffer, folderName, req, originalname = 'proof.jpg') {
  try {
    if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_CLOUD_NAME) {
      const secureUrl = await uploadImageToCloudinary(buffer, folderName);
      return secureUrl;
    }
  } catch (cloudErr) {
    console.warn(`[Cloudinary Warning] Upload to folder "${folderName}" failed, using local disk fallback:`, cloudErr.message);
  }

  // Fallback to local server URL
  const savedRelativePath = await saveLocalImageBuffer(buffer, originalname);
  const host = req.get('host');
  const protocol = req.protocol;
  return `${protocol}://${host}${savedRelativePath}`;
}

// =============================================================================
// A. Officer Account Management (Super Admin Only)
// =============================================================================

/**
 * @desc    Create a new Municipal Officer account with Firebase Admin custom claims
 * @route   POST /api/admin/officers
 * @access  Private (Super Admin)
 */
const createOfficer = async (req, res, next) => {
  try {
    const { email, password, displayName, assignedArea } = req.body;
    const officerName = displayName || req.body.fullName;
    const officerArea = assignedArea || req.body.assignedWard;

    if (!email || !password || !officerName || !officerArea) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: email, password, displayName, and assignedArea.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    if (!auth) {
      return res.status(500).json({
        success: false,
        message: 'Firebase Admin Auth is uninitialized on server. Check serviceAccountKey.json.',
      });
    }

    // 1. Create Firebase User
    const userRecord = await auth.createUser({
      email: email.trim().toLowerCase(),
      password,
      displayName: officerName.trim(),
    });

    // 2. Set Custom User Claims for RBAC
    const customClaims = {
      role: 'admin',
      assignedArea: officerArea.trim(),
      ward: officerArea.trim(), // Alias for compatibility
    };

    await auth.setCustomUserClaims(userRecord.uid, customClaims);

    console.log(`[Admin Controller] Provisioned officer ${email} (${userRecord.uid}) for area: "${officerArea}"`);

    // 3. Return HTTP 201 with created officer details
    return res.status(201).json({
      success: true,
      message: `Municipal officer "${officerName}" successfully provisioned for ${officerArea}.`,
      officer: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role: 'admin',
        assignedArea: officerArea.trim(),
        createdAt: userRecord.metadata?.creationTime || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Admin Controller - createOfficer Error]:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({
        success: false,
        message: 'An officer account with this email address already exists.',
      });
    }
    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({
        success: false,
        message: 'The email address provided is invalid.',
      });
    }
    next(error);
  }
};

/**
 * @desc    List all registered municipal officers with role and assignedArea claims
 * @route   GET /api/admin/officers
 * @access  Private (Super Admin)
 */
const listOfficers = async (req, res, next) => {
  try {
    if (!auth) {
      return res.status(500).json({
        success: false,
        message: 'Firebase Admin Auth is uninitialized on server.',
      });
    }

    // List all users from Firebase Authentication (up to 1000)
    const listUsersResult = await auth.listUsers(1000);

    // Filter and map only users with administrative custom claims ('admin' or 'super_admin')
    const officers = listUsersResult.users
      .filter((user) => {
        const role = user.customClaims?.role;
        return role === 'admin' || role === 'super_admin';
      })
      .map((user) => {
        const claims = user.customClaims || {};
        return {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'Officer',
          fullName: user.displayName || user.email?.split('@')[0] || 'Officer',
          role: claims.role,
          assignedArea: claims.assignedArea || claims.ward || 'All Jurisdictions',
          assignedWard: claims.assignedArea || claims.ward || 'All Jurisdictions',
          disabled: user.disabled,
          createdAt: user.metadata?.creationTime,
          lastSignInTime: user.metadata?.lastSignInTime,
        };
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return res.status(200).json({
      success: true,
      count: officers.length,
      officers,
    });
  } catch (error) {
    console.error('[Admin Controller - listOfficers Error]:', error);
    next(error);
  }
};

/**
 * @desc    Delete a municipal officer account from Firebase Auth
 * @route   DELETE /api/admin/officers/:uid
 * @access  Private (Super Admin)
 */
const deleteOfficer = async (req, res, next) => {
  try {
    const { uid } = req.params;

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: 'Officer UID is required as a URL parameter.',
      });
    }

    // Prevent Super Admin from deleting their own active session
    if (req.user?.uid === uid) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own active super_admin account.',
      });
    }

    if (!auth) {
      return res.status(500).json({
        success: false,
        message: 'Firebase Admin Auth is uninitialized on server.',
      });
    }

    await auth.deleteUser(uid);
    console.log(`[Admin Controller] Deleted officer account: ${uid}`);

    return res.status(200).json({
      success: true,
      message: 'Officer account credentials and permissions revoked successfully.',
      uid,
    });
  } catch (error) {
    console.error('[Admin Controller - deleteOfficer Error]:', error);
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({
        success: false,
        message: 'Officer account not found with the provided UID.',
      });
    }
    next(error);
  }
};

// =============================================================================
// B. Administrative Dashboard Metrics
// =============================================================================

/**
 * @desc    Get aggregated municipal KPI metrics & hotspots with ward RBAC scoping
 * @route   GET /api/admin/stats
 * @access  Private (Admin / Super Admin)
 */
const getAdminStats = async (req, res, next) => {
  try {
    const filter = {};
    let targetJurisdiction = 'All Jurisdictions';

    // Role-Based Jurisdiction Scoping:
    // If field officer (admin), enforce assignedArea claim
    if (req.user.role === 'admin') {
      const officerArea = req.user.assignedArea || req.user.ward;
      if (officerArea && officerArea.trim()) {
        targetJurisdiction = officerArea.trim();
        filter['address.areaName'] = { $regex: new RegExp(officerArea.trim(), 'i') };
      }
    } else if (req.user.role === 'super_admin') {
      // Super Admin can optionally filter by specific areaName or ward
      const queryArea = req.query.areaName || req.query.ward || req.query.area;
      const isCitywide =
        !queryArea ||
        queryArea.trim().toLowerCase() === 'all' ||
        queryArea.trim().toLowerCase().startsWith('all');

      if (!isCitywide) {
        targetJurisdiction = queryArea.trim();
        filter['address.areaName'] = { $regex: new RegExp(queryArea.trim(), 'i') };
      }
    }

    // 1. KPI Counts (Supporting 5-Tier Municipal Statuses)
    const [totalComplaints, pendingCount, underWorkingCount, resolvedCount] = await Promise.all([
      Complaint.countDocuments(filter),
      Complaint.countDocuments({ ...filter, status: { $in: ['Submitted', 'Pending', 'Assigned to Ward', 'Assigned'] } }),
      Complaint.countDocuments({ ...filter, status: { $in: ['In Progress', 'Under Working', 'Reopened'] } }),
      Complaint.countDocuments({ ...filter, status: { $in: ['Resolved', 'Closed'] } }),
    ]);

    // 2. Severity Breakdown
    const [critCount, highCount, medCount, lowCount] = await Promise.all([
      Complaint.countDocuments({ ...filter, severity: 'CRITICAL' }),
      Complaint.countDocuments({ ...filter, severity: 'HIGH' }),
      Complaint.countDocuments({ ...filter, severity: 'MEDIUM' }),
      Complaint.countDocuments({ ...filter, severity: 'LOW' }),
    ]);

    // 3. Top Hotspots (Top 5 recurring complaints sorted by reportCount descending)
    const topHotspots = await Complaint.find(filter)
      .sort({ reportCount: -1, createdAt: -1 })
      .limit(5)
      .select('_id title imageUrl severity status reportCount address location areaCoveragePct createdAt');

    return res.status(200).json({
      success: true,
      jurisdiction: targetJurisdiction,
      totalComplaints,
      pendingCount,
      underWorkingCount,
      resolvedCount,
      severityBreakdown: {
        CRITICAL: critCount,
        HIGH: highCount,
        MEDIUM: medCount,
        LOW: lowCount,
      },
      topHotspots,
    });
  } catch (error) {
    console.error('[Admin Controller - getAdminStats Error]:', error);
    next(error);
  }
};

// =============================================================================
// C. Geospatial & Tabular Complaints Feed
// =============================================================================

/**
 * @desc    Get paginated complaints with status, severity, area & search query filtering
 * @route   GET /api/admin/complaints
 * @access  Private (Admin / Super Admin)
 */
const getAllComplaintsAdmin = async (req, res, next) => {
  try {
    const { status, severity, areaName, search, page = 1, limit = 50, view, activeOnly } = req.query;

    const conditions = [];

    // 1. Role-Based Area Enforcement
    const callerRole = req.user.role;
    const isMapView = view === 'map';

    // When viewing GIS Map Console (view === 'map'), Ward and Field Officers
    // receive the complete citywide map console with all live pins, identical to Managing Officer!
    if (!isMapView && callerRole === 'field_officer') {
      const userDoc = await User.findOne({ firebaseUid: req.user.uid }).populate('wardId');
      const fieldOr = [];
      if (userDoc?._id) {
        fieldOr.push({ assignedFieldOfficerId: userDoc._id });
      }
      if (userDoc?.wardId) {
        const wid = userDoc.wardId._id || userDoc.wardId;
        fieldOr.push({ wardId: wid });
        if (userDoc.wardId.name) {
          fieldOr.push({ 'address.areaName': { $regex: new RegExp(userDoc.wardId.name.trim(), 'i') } });
        }
      }
      if (fieldOr.length > 0) {
        conditions.push({ $or: fieldOr });
      }
    } else if (!isMapView && ['admin', 'ward_officer'].includes(callerRole)) {
      const userDoc = await User.findOne({ firebaseUid: req.user.uid }).populate('wardId');
      const wardOr = [];
      if (userDoc?._id) {
        wardOr.push({ assignedWardOfficerId: userDoc._id });
      }
      if (userDoc?.wardId) {
        const wid = userDoc.wardId._id || userDoc.wardId;
        wardOr.push({ wardId: wid });
        if (userDoc.wardId.name) {
          wardOr.push({ 'address.areaName': { $regex: new RegExp(userDoc.wardId.name.trim(), 'i') } });
        }
      }
      const officerArea = req.user.assignedArea || req.user.ward;
      if (officerArea && typeof officerArea === 'string' && officerArea.trim()) {
        const areaRegex = { $regex: new RegExp(officerArea.trim(), 'i') };
        wardOr.push({ 'address.areaName': areaRegex }, { 'address.suburb': areaRegex }, { 'address.city': areaRegex });
      }
      if (wardOr.length > 0) {
        conditions.push({ $or: wardOr });
      }
    } else {
      // Super Admin, Managing Officer, and Citywide GIS Map Console
      const targetArea = areaName || req.query.ward || req.query.area;
      const isCitywide =
        !targetArea ||
        targetArea.trim().toLowerCase() === 'all' ||
        targetArea.trim().toLowerCase().startsWith('all');

      if (!isCitywide) {
        const areaRegex = { $regex: new RegExp(targetArea.trim(), 'i') };
        conditions.push({
          $or: [
            { 'address.areaName': areaRegex },
            { 'address.suburb': areaRegex },
            { 'address.city': areaRegex },
          ],
        });
      }
    }

    // 2. Status Filter & Live Map Default (All 5-Tier Active Statuses)
    const ACTIVE_STATUSES = [
      'Submitted',
      'Assigned to Ward',
      'Assigned',
      'In Progress',
      'Reopened',
      'Pending',
      'Under Working',
    ];

    if (status && status !== 'All Active' && status !== 'All' && status !== 'all') {
      conditions.push({ status });
    } else if (status === 'All Active' || (view === 'map' && status !== 'All' && status !== 'all') || activeOnly === 'true') {
      // By default, live active map views display all active tickets (exclude Resolved and Closed)
      conditions.push({ status: { $in: ACTIVE_STATUSES } });
    }

    // 3. Severity Filter
    if (severity && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity.toUpperCase())) {
      conditions.push({ severity: severity.toUpperCase() });
    }

    // 4. Keyword Search (searches title, ticket ID, road, area, citizen email)
    const searchTerm = (search || req.query.query || '').trim();
    if (searchTerm) {
      const sRegex = { $regex: new RegExp(searchTerm, 'i') };
      const searchOr = [
        { 'title.en': sRegex },
        { 'title.hi': sRegex },
        { 'address.road': sRegex },
        { 'address.areaName': sRegex },
        { 'address.suburb': sRegex },
        { userEmail: sRegex },
      ];

      // If search string matches valid MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(searchTerm)) {
        searchOr.push({ _id: searchTerm });
      }

      conditions.push({ $or: searchOr });
    }

    const queryFilter = conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0] : { $and: conditions };

    // Pagination (Map views allow up to 1000 markers without truncating)
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const maxLimit = view === 'map' ? 1000 : 100;
    const limitNum = Math.max(1, Math.min(maxLimit, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [totalCount, complaints] = await Promise.all([
      Complaint.countDocuments(queryFilter),
      Complaint.find(queryFilter)
        .populate('wardId')
        .populate('departmentId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    // Redact citizen personal identifiers (PII protection for municipal admins/officers)
    const sanitizedComplaints = complaints.map((c) => {
      const obj = c.toObject ? c.toObject() : { ...c };
      obj.userEmail = 'Citizen (Protected Identity)';
      delete obj.userId;
      delete obj.reporterUserIds;
      delete obj.fcmTokens;
      delete obj.vectorEmbedding;
      return obj;
    });

    return res.status(200).json({
      success: true,
      count: sanitizedComplaints.length,
      total: totalCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      limit: limitNum,
      data: sanitizedComplaints,
    });
  } catch (error) {
    console.error('[Admin Controller - getAllComplaintsAdmin Error]:', error);
    next(error);
  }
};

// =============================================================================
// D. Ticket Status & Work Progress Update (With Cloudinary & FCM)
// =============================================================================

/**
 * @desc    Update complaint status ('Under Working', 'Resolved') with proof image and FCM notifications
 * @route   PATCH /api/admin/complaints/:id/status
 * @access  Private (Admin / Super Admin)
 */
const updateTicketStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, officialRemark = '', severity } = req.body;
    const callerRole = req.user.role;

    // Strict Segregation of Duties:
    // Managing Officers and Ward Officers CANNOT mark tickets Working/In Progress or Resolved!
    if (['managing_officer', 'ward_officer'].includes(callerRole)) {
      if (status && ['Under Working', 'In Progress', 'Resolved'].includes(status)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Managing Officers and Ward Officers cannot transition tickets to Working or Resolved. Only assigned Field Officers can commence work and resolve issues.',
        });
      }
    }

    if (status && !['Pending', 'Under Working', 'Resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Allowed values: "Pending", "Under Working", "Resolved".',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint ID format.',
      });
    }

    // 1. Find Complaint by _id
    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found with the provided ID.',
      });
    }

    // Area jurisdiction check for field officers (admin role)
    if (req.user.role === 'admin') {
      const officerArea = (req.user.assignedArea || req.user.ward || '').toLowerCase().trim();
      const complaintArea = (complaint.address?.areaName || complaint.address?.suburb || '').toLowerCase().trim();

      if (officerArea && !complaintArea.includes(officerArea) && !officerArea.includes(complaintArea)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: You are restricted to your assigned area (${req.user.assignedArea}). This complaint belongs to (${complaint.address?.areaName}).`,
        });
      }
    }

    // Update severity if requested by authorized tiers
    if (severity && ['super_admin', 'managing_officer', 'ward_officer'].includes(callerRole)) {
      const upperSev = severity.toUpperCase();
      if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(upperSev)) {
        complaint.severity = upperSev;
      }
    }

    if (status) {
      complaint.status = status;
    }

    let notificationTitle = 'Complaint Update';
    let notificationBody = officialRemark || `Status of your complaint "${complaint.title?.en || 'Civic Issue'}" updated to ${status || complaint.status}.`;

    // 2. Upload Proof Image (if provided) and update status records
    if (status === 'Under Working') {
      let proofUrl = complaint.workInProgress?.imageUrl || null;
      if (req.file && req.file.buffer) {
        proofUrl = await uploadProofImage(req.file.buffer, 'civic_in_progress', req, req.file.originalname);
      }

      complaint.workInProgress = {
        imageUrl: proofUrl,
        updatedAt: new Date(),
        officialRemark: officialRemark || complaint.workInProgress?.officialRemark || 'Municipal crew deployed on-site.',
      };

      notificationTitle = 'Work In Progress: Municipal Team Assigned 🛠️';
      notificationBody = officialRemark || `Municipal crew is actively addressing your complaint "${complaint.title?.en || 'Civic Issue'}".`;
    } else if (status === 'Resolved') {
      let proofUrl = complaint.resolutionProof?.imageUrl || null;
      if (req.file && req.file.buffer) {
        proofUrl = await uploadProofImage(req.file.buffer, 'civic_resolutions', req, req.file.originalname);
      }

      complaint.resolutionProof = {
        imageUrl: proofUrl,
        resolvedAt: new Date(),
        officialRemark: officialRemark || complaint.resolutionProof?.officialRemark || 'Issue resolved and verified by municipal inspector.',
      };

      notificationTitle = 'Complaint Resolved! ✅';
      notificationBody = officialRemark || `Your reported issue "${complaint.title?.en || 'Civic Issue'}" has been resolved. Tap to view before vs after fix proof.`;
    }

    await complaint.save();

    // 3. Concurrently trigger push notifications and in-app Notification records
    const allUserIds = Array.from(
      new Set([complaint.userId, ...(complaint.reporterUserIds || [])].filter(Boolean))
    );

    const fcmTokens = Array.isArray(complaint.fcmTokens) ? complaint.fcmTokens : [];

    // Asynchronously dispatch notifications without blocking HTTP response
    sendComplaintNotification({
      tokens: fcmTokens,
      userIds: allUserIds,
      title: notificationTitle,
      body: notificationBody,
      complaintId: complaint._id,
      clickAction: '/my-complaints',
    }).catch((notifErr) => {
      console.error('[Admin Controller - updateTicketStatus Notification Error]:', notifErr);
    });

    // 4. Return HTTP 200 with updated complaint document
    return res.status(200).json({
      success: true,
      message: `Complaint status successfully updated to "${status}".`,
      complaint,
    });
  } catch (error) {
    console.error('[Admin Controller - updateTicketStatus Error]:', error);
    next(error);
  }
};

/**
 * @desc    Get dynamically populated distinct area names from MongoDB complaints & registered officers
 * @route   GET /api/admin/areas
 * @access  Private (Admin / Super Admin)
 */
const getDistinctAreas = async (req, res, next) => {
  try {
    // 1. Fetch unique area names from live MongoDB complaints
    const complaintAreas = await Complaint.distinct('address.areaName');

    // 2. Fetch assigned areas from active officers in Firebase Auth
    let officerAreas = [];
    if (auth) {
      try {
        const listUsersResult = await auth.listUsers(1000);
        officerAreas = listUsersResult.users
          .map((u) => u.customClaims?.assignedArea || u.customClaims?.ward)
          .filter(Boolean);
      } catch (err) {
        console.warn('[Admin Controller] Could not fetch officer areas from Firebase:', err.message);
      }
    }

    // Merge, deduplicate, filter out empty / generic "all", and sort
    const combinedSet = new Set([...complaintAreas, ...officerAreas]);
    const areas = Array.from(combinedSet)
      .filter((a) => typeof a === 'string' && a.trim() && !a.toLowerCase().startsWith('all'))
      .map((a) => a.trim())
      .sort((a, b) => a.localeCompare(b));

    return res.status(200).json({
      success: true,
      count: areas.length,
      areas,
    });
  } catch (error) {
    console.error('[Admin Controller - getDistinctAreas Error]:', error);
    next(error);
  }
};

module.exports = {
  createOfficer,
  listOfficers,
  deleteOfficer,
  getAdminStats,
  getAllComplaintsAdmin,
  updateTicketStatus,
  getDistinctAreas,
};
