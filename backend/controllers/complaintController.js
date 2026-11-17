const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const Complaint = require('../models/Complaint');
const AuditLog = require('../models/AuditLog');
const { getCosineSimilarity } = require('../utils/vectorMath');
const { uploadImageToCloudinary } = require('../utils/cloudinary');
const { sendComplaintNotification } = require('../utils/notificationService');

// Base URL for FastAPI AI Microservice
const AI_MICROSERVICE_URL = process.env.AI_MICROSERVICE_URL || 'http://127.0.0.1:8000';

// Ensure local uploads directory exists for fallback
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Fallback helper: Save uploaded buffer to local uploads/ directory
 */
async function saveLocalImageBuffer(buffer, originalname = 'upload.jpg') {
  const extension = path.extname(originalname) || '.jpg';
  const filename = `civic_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${extension}`;
  const filePath = path.join(UPLOAD_DIR, filename);
  await fs.promises.writeFile(filePath, buffer);
  return `/uploads/${filename}`;
}

/**
 * Helper: Upload image buffer to Cloudinary with local disk fallback
 */
async function uploadImage(buffer, folderName, req, originalname = 'upload.jpg') {
  try {
    if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_CLOUD_NAME) {
      const secureUrl = await uploadImageToCloudinary(buffer, folderName);
      return secureUrl;
    }
  } catch (cloudErr) {
    console.warn(`[Cloudinary Warning] Upload to folder "${folderName}" failed, using local disk fallback:`, cloudErr.message);
  }

  // Fallback to local server static URL
  const savedRelativePath = await saveLocalImageBuffer(buffer, originalname);
  const host = req.get('host');
  const protocol = req.protocol;
  return `${protocol}://${host}${savedRelativePath}`;
}

/**
 * Endpoint 1: POST /api/complaints/preview
 * Stage 1: Quick Inspection
 * Receives image, forwards to FastAPI /preview, returns AI suggestions without saving to DB.
 */
const previewComplaint = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided. Please upload an image under the "image" field.',
      });
    }

    // Build multipart/form-data to forward to FastAPI
    const formData = new FormData();
    formData.append('image', req.file.buffer, {
      filename: req.file.originalname || 'preview.jpg',
      contentType: req.file.mimetype || 'image/jpeg',
    });

    let aiResponse;
    try {
      aiResponse = await axios.post(`${AI_MICROSERVICE_URL}/preview`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000, // 30s timeout for model inference
      });
    } catch (aiErr) {
      console.error(`[AI Service Error - Preview]: ${aiErr.message}`);
      return res.status(502).json({
        success: false,
        message: 'FastAPI AI Microservice unavailable or encountered an error.',
        error: aiErr.response ? aiErr.response.data : aiErr.message,
        targetUrl: `${AI_MICROSERVICE_URL}/preview`,
      });
    }

    const aiData = aiResponse.data || {};
    const suggested = aiData.suggested_description || aiData.final_issue || {};

    // Return AI response directly to frontend
    return res.status(200).json({
      success: true,
      data: {
        ...aiData,
        suggested_description: suggested,
        final_issue: suggested,
        bounding_box: aiData.bounding_box || [0, 0, 0, 0],
        dimensions: aiData.image_dimensions || aiData.dimensions || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Endpoint 2: POST /api/complaints/submit
 * Stage 2: Verification, Cloudinary Upload, Deduplication & DB Write
 */
const submitComplaint = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'Complaint image is required under field name "image".',
      });
    }

    const {
      final_text,
      was_edited,
      latitude,
      longitude,
      areaName,
      city,
      road = '',
      suburb = '',
      state = '',
      fcmToken = '',
    } = req.body;

    // Validate required fields
    if (!final_text || !areaName || !city || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: final_text, latitude, longitude, areaName, and city are required.',
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid geospatial coordinates. Latitude must be in [-90, 90] and Longitude in [-180, 180].',
      });
    }

    // Step 1: Call FastAPI AI Microservice /submit
    const formData = new FormData();
    formData.append('image', req.file.buffer, {
      filename: req.file.originalname || 'complaint.jpg',
      contentType: req.file.mimetype || 'image/jpeg',
    });
    formData.append('final_text', String(final_text));
    formData.append(
      'was_edited',
      String(was_edited === 'true' || was_edited === true)
    );

    let aiData;
    try {
      const aiResponse = await axios.post(`${AI_MICROSERVICE_URL}/submit`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 45000, // 45s timeout for full inference + embeddings
      });
      aiData = aiResponse.data;
    } catch (aiErr) {
      console.error(`[AI Service Error - Submit]: ${aiErr.message}`);
      return res.status(502).json({
        success: false,
        message: 'FastAPI AI Microservice unavailable or encountered an error during submission.',
        error: aiErr.response ? aiErr.response.data : aiErr.message,
        targetUrl: `${AI_MICROSERVICE_URL}/submit`,
      });
    }

    // Step 2: Extract AI outputs
    const {
      final_issue,
      bounding_box = [0, 0, 0, 0],
      severity = 'MEDIUM',
      area_coverage_pct = 0.0,
      vector_embedding = [],
    } = aiData;

    // Normalize bilingual titles
    let titleEn = '';
    let titleHi = '';

    if (typeof final_issue === 'object' && final_issue !== null) {
      titleEn = final_issue.en || final_text;
      titleHi = final_issue.hi || final_text;
    } else if (typeof final_issue === 'string') {
      titleEn = final_issue;
      titleHi = final_issue;
    } else {
      titleEn = final_text;
      titleHi = final_text;
    }

    // Step 3: Spatial Deduplication Query in MongoDB (200m radius, ACTIVE issues only)
    // Only ACTIVE tickets are eligible for deduplication and citizen report merging.
    // Closed or Resolved issues must NOT swallow new reports; once closed, a new defect
    // at the same site must be treated as a fresh complaint so the municipality addresses it.
    const ACTIVE_MERGE_STATUSES = [
      'Submitted',
      'Assigned to Ward',
      'Assigned',
      'In Progress',
      'Under Working',
      'Pending',
      'Reopened',
    ];

    let matchedDoc = null;
    let highestSimilarity = 0.0;
    let matchedClosedDoc = null;
    let highestClosedSimilarity = 0.0;
    const deduplicationRadius = Number(process.env.DEDUPLICATION_RADIUS_METERS) || 200;

    if (Array.isArray(vector_embedding) && vector_embedding.length > 0) {
      // 1. Search for nearby active tickets to merge
      const nearbyActiveTickets = await Complaint.find({
        status: { $in: ACTIVE_MERGE_STATUSES },
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            $maxDistance: deduplicationRadius,
          },
        },
      }).select('+vectorEmbedding');

      // Step 4: Semantic Cosine Similarity Check (MiniLM 384-D) on Active tickets
      for (const ticket of nearbyActiveTickets) {
        if (Array.isArray(ticket.vectorEmbedding) && ticket.vectorEmbedding.length > 0) {
          const sim = getCosineSimilarity(vector_embedding, ticket.vectorEmbedding);
          if (sim >= 0.78 && sim > highestSimilarity) {
            highestSimilarity = sim;
            matchedDoc = ticket;
          }
        }
      }

      // 2. If no active ticket matched, check if a defect was previously closed/resolved here
      if (!matchedDoc) {
        try {
          const nearbyClosedTickets = await Complaint.find({
            status: { $in: ['Resolved', 'Closed'] },
            location: {
              $near: {
                $geometry: {
                  type: 'Point',
                  coordinates: [lng, lat],
                },
                $maxDistance: deduplicationRadius,
              },
            },
          })
            .sort({ updatedAt: -1 })
            .limit(10)
            .select('+vectorEmbedding');

          for (const closedTicket of nearbyClosedTickets) {
            if (Array.isArray(closedTicket.vectorEmbedding) && closedTicket.vectorEmbedding.length > 0) {
              const sim = getCosineSimilarity(vector_embedding, closedTicket.vectorEmbedding);
              if (sim >= 0.78 && sim > highestClosedSimilarity) {
                highestClosedSimilarity = sim;
                matchedClosedDoc = closedTicket;
              }
            }
          }
        } catch (closedErr) {
          console.warn('[Recurrent Defect Search Warning]:', closedErr.message);
        }
      }
    }

    // If duplicate match found: merge ticket and append FCM token & reporter user ID
    if (matchedDoc) {
      matchedDoc.reportCount += 1;

      // Escalate severity if reportCount >= 3 and not already CRITICAL
      if (matchedDoc.reportCount >= 3 && matchedDoc.severity !== 'CRITICAL') {
        matchedDoc.severity = 'HIGH';
      }

      // Append FCM Token if provided and not already present
      if (fcmToken && typeof fcmToken === 'string' && fcmToken.trim() !== '') {
        const tokenTrimmed = fcmToken.trim();
        if (!matchedDoc.fcmTokens) matchedDoc.fcmTokens = [];
        if (!matchedDoc.fcmTokens.includes(tokenTrimmed)) {
          matchedDoc.fcmTokens.push(tokenTrimmed);
        }
      }

      // Append current user ID to reporterUserIds if not already present
      if (!matchedDoc.reporterUserIds) matchedDoc.reporterUserIds = [matchedDoc.userId];
      if (!matchedDoc.reporterUserIds.includes(req.user.uid)) {
        matchedDoc.reporterUserIds.push(req.user.uid);
      }

      await matchedDoc.save();

      // Dispatch acknowledgment notification to citizen about backing existing report
      sendComplaintNotification({
        tokens: fcmToken ? [fcmToken.trim()] : [],
        userIds: [req.user.uid],
        title: 'Grievance Backed 🤝',
        body: `Your report for "${titleEn}" was linked to active grievance #${matchedDoc._id.toString().slice(-6)} to expedite municipal action.`,
        complaintId: matchedDoc._id,
        clickAction: '/my-complaints',
      }).catch((e) => console.warn('[Duplicate Push Warning]:', e.message));

      return res.status(200).json({
        success: true,
        is_duplicate: true,
        similarity_score: Number(highestSimilarity.toFixed(4)),
        complaint: matchedDoc,
      });
    }

    // Step 5: Upload Image to Cloudinary folder "civic_reports"
    const imageUrl = await uploadImage(req.file.buffer, 'civic_reports', req, req.file.originalname);

    // Collect initial FCM tokens
    const fcmTokensArray = [];
    if (fcmToken && typeof fcmToken === 'string' && fcmToken.trim() !== '') {
      fcmTokensArray.push(fcmToken.trim());
    }

    // Step 6: Create and save new Complaint document
    const forwardDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // Managing Officer 24h forward SLA

    // Recurrent Defect Tracking: If this defect reoccurred after a previous ticket was closed/resolved
    const isRecurrent = Boolean(matchedClosedDoc);
    const recurrentFromTicketId = matchedClosedDoc ? matchedClosedDoc._id : null;

    const newComplaint = new Complaint({
      userId: req.user.uid,
      userEmail: req.user.email || 'unknown@civic.app',
      reporterUserIds: [req.user.uid],
      title: {
        en: titleEn,
        hi: titleHi,
      },
      imageUrl,
      boundingBox: Array.isArray(bounding_box) ? bounding_box : [0, 0, 0, 0],
      severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity?.toUpperCase())
        ? severity.toUpperCase()
        : isRecurrent ? 'HIGH' : 'MEDIUM', // Auto-prioritize recurrent defects
      areaCoveragePct: typeof area_coverage_pct === 'number' ? area_coverage_pct : 0.0,
      reportCount: 1,
      status: 'Submitted',
      isRecurrent,
      recurrentFromTicketId,
      forwardDeadline,
      fcmTokens: fcmTokensArray,
      workInProgress: {
        imageUrl: null,
        updatedAt: null,
        officialRemark: '',
      },
      resolutionProof: {
        imageUrl: null,
        resolvedAt: null,
        officialRemark: '',
      },
      address: {
        road,
        suburb,
        areaName,
        city,
        state,
      },
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      vectorEmbedding: vector_embedding,
    });

    await newComplaint.save();

    // Dispatch instant in-app and push notification acknowledging registration
    const notifTitle = isRecurrent
      ? 'Grievance Registered (Recurrent Defect) 📋'
      : 'Grievance Registered 📋';
    const notifBody = isRecurrent
      ? `Your report "${titleEn}" has been registered as Ticket #${newComplaint._id.toString().slice(-6)}. Recurring issue at this site has been flagged for municipal priority addressing.`
      : `Your report "${titleEn}" has been registered (Ticket #${newComplaint._id.toString().slice(-6)}) and queued for municipal review.`;

    sendComplaintNotification({
      tokens: fcmTokensArray,
      userIds: [req.user.uid],
      title: notifTitle,
      body: notifBody,
      complaintId: newComplaint._id,
      clickAction: '/my-complaints',
    }).catch((e) => console.warn('[Submit Push Warning]:', e.message));

    // Log Immutable Audit Event
    await AuditLog.create({
      complaintId: newComplaint._id,
      action: 'SUBMITTED',
      performedBy: {
        uid: req.user.uid,
        name: req.user.name || req.user.displayName || 'Citizen',
        role: req.user.role || 'citizen',
      },
      toStatus: 'Submitted',
      reason: isRecurrent
        ? `Citizen grievance submitted. Recurrent defect detected at previously closed/resolved location (#${matchedClosedDoc._id.toString().slice(-6)}). Queued for municipal addressing.`
        : 'Citizen grievance submitted with AI defect bounding box and reverse geocoding.',
    }).catch((err) => console.warn('[AuditLog submit warning]:', err.message));

    const complaintObj = newComplaint.toObject();
    delete complaintObj.vectorEmbedding;

    return res.status(201).json({
      success: true,
      is_duplicate: false,
      is_recurrent: isRecurrent,
      recurrent_from_ticket_id: recurrentFromTicketId,
      complaint: complaintObj,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Endpoint 3: PATCH /api/complaints/:id/status
 * Update complaint status (Pending -> Under Working -> Resolved)
 * Allows municipal officials to upload inspection / resolution proof images & send FCM push notifications.
 */
const updateComplaintStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, officialRemark = '' } = req.body;

    if (!['Pending', 'Under Working', 'Resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Allowed values: "Pending", "Under Working", "Resolved".',
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found with the provided ID.',
      });
    }

    complaint.status = status;

    let notificationTitle = 'Complaint Update';
    let notificationBody = officialRemark || `Status of your complaint "${complaint.title?.en || 'Civic Issue'}" has been updated to ${status}.`;

    if (status === 'Under Working') {
      let proofUrl = complaint.workInProgress?.imageUrl || null;
      if (req.file && req.file.buffer) {
        proofUrl = await uploadImage(req.file.buffer, 'civic_in_progress', req, req.file.originalname);
      }

      complaint.workInProgress = {
        imageUrl: proofUrl,
        updatedAt: new Date(),
        officialRemark: officialRemark || 'Municipal crew is working on your issue.',
      };

      notificationTitle = 'Work In Progress: Municipal Team Assigned 🛠️';
      notificationBody = officialRemark || 'Municipal crew is working on your issue. Track live progress in the app.';
    } else if (status === 'Resolved') {
      let proofUrl = complaint.resolutionProof?.imageUrl || null;
      if (req.file && req.file.buffer) {
        proofUrl = await uploadImage(req.file.buffer, 'civic_resolutions', req, req.file.originalname);
      }

      complaint.resolutionProof = {
        imageUrl: proofUrl,
        resolvedAt: new Date(),
        officialRemark: officialRemark || 'Issue resolved and verified by municipal inspector.',
      };

      notificationTitle = 'Complaint Resolved! ✅';
      notificationBody = officialRemark || 'Your complaint has been resolved! Tap to view the before vs. after fix photo.';
    }

    await complaint.save();

    // Multicast Push Notification and in-app Notification records for all reporting users
    const allUserIds = Array.from(
      new Set([complaint.userId, ...(complaint.reporterUserIds || [])].filter(Boolean))
    );

    const fcmTokens = Array.isArray(complaint.fcmTokens) ? complaint.fcmTokens : [];

    // Trigger asynchronous notifications
    sendComplaintNotification({
      tokens: fcmTokens,
      userIds: allUserIds,
      title: notificationTitle,
      body: notificationBody,
      complaintId: complaint._id,
      clickAction: '/my-complaints',
    }).catch((err) => {
      console.error('[UpdateStatus Notification Error]:', err);
    });

    return res.status(200).json({
      success: true,
      message: `Complaint status updated to "${status}" successfully.`,
      complaint,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Endpoint 4: GET /api/complaints/my
 * User's Complaints with status tabs & counts breakdown
 */
const getUserComplaints = async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const { status } = req.query;

    const userCondition = {
      $or: [{ userId }, { reporterUserIds: userId }],
    };

    const queryFilter = { ...userCondition };

    if (status && status !== 'all' && status !== 'All') {
      const lower = status.toLowerCase();
      if (lower === 'submitted' || lower === 'pending') {
        queryFilter.status = { $in: ['Submitted', 'Assigned to Ward', 'Pending'] };
      } else if (lower === 'in progress' || lower === 'working' || lower === 'under working') {
        queryFilter.status = { $in: ['In Progress', 'Assigned', 'Under Working', 'Reopened'] };
      } else if (lower === 'resolved') {
        queryFilter.status = 'Resolved';
      } else if (lower === 'closed') {
        queryFilter.status = 'Closed';
      } else {
        queryFilter.status = status;
      }
    }

    // Execute complaints query sorted by createdAt descending
    const complaints = await Complaint.find(queryFilter).sort({ createdAt: -1 });

    // Aggregate counts for each status tab for this user across all 5 municipal tiers
    const [submittedCount, workingCount, resolvedCount, closedCount, totalCount] = await Promise.all([
      Complaint.countDocuments({
        ...userCondition,
        status: { $in: ['Submitted', 'Assigned to Ward', 'Pending'] },
      }),
      Complaint.countDocuments({
        ...userCondition,
        status: { $in: ['In Progress', 'Assigned', 'Under Working', 'Reopened'] },
      }),
      Complaint.countDocuments({ ...userCondition, status: 'Resolved' }),
      Complaint.countDocuments({ ...userCondition, status: 'Closed' }),
      Complaint.countDocuments(userCondition),
    ]);

    return res.status(200).json({
      success: true,
      submittedCount,
      pendingCount: submittedCount, // backwards compatibility
      workingCount,
      resolvedCount,
      closedCount,
      totalCount,
      data: complaints,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Endpoint 5: GET /api/complaints/area and /api/complaints/nearby
 * Complaints filtered by City / Area Name OR by coordinate radius (default 50km)
 * When view === 'map' or activeOnly === 'true', excludes Resolved complaints by default.
 */
const getComplaintsByArea = async (req, res, next) => {
  try {
    const { city, areaName, area, query, latitude, longitude, radius = 50000, status, view, activeOnly } = req.query;

    const conditions = [];

    if (status && ['Submitted', 'Assigned to Ward', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Reopened', 'Pending', 'Under Working'].includes(status)) {
      conditions.push({ status });
    } else if (status === 'active' || view === 'map' || activeOnly === 'true' || !status) {
      // Primary active map view excludes resolved and closed complaints by default
      conditions.push({ status: { $nin: ['Resolved', 'Closed'] } });
    }

    // Spatial coordinate query if coordinates are provided
    if (latitude !== undefined && longitude !== undefined && String(latitude).trim() !== '' && String(longitude).trim() !== '') {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const rad = parseFloat(radius);

      if (!isNaN(lat) && !isNaN(lng)) {
        const radiusInRadians = rad / 6378137;
        conditions.push({
          location: {
            $geoWithin: {
              $centerSphere: [[lng, lat], radiusInRadians],
            },
          },
        });
      }
    }

    // Area / City filter across all locality fields
    const targetArea = area || city || areaName;
    if (targetArea && targetArea.trim() && targetArea.toLowerCase() !== 'all') {
      const aRegex = { $regex: new RegExp(targetArea.trim(), 'i') };
      conditions.push({
        $or: [
          { 'address.areaName': aRegex },
          { 'address.city': aRegex },
          { 'address.suburb': aRegex },
          { 'address.road': aRegex },
          { 'address.state': aRegex },
        ],
      });
    }

    // General keyword query
    if (query && query.trim()) {
      const qRegex = { $regex: new RegExp(query.trim(), 'i') };
      conditions.push({
        $or: [
          { 'title.en': qRegex },
          { 'title.hi': qRegex },
          { 'address.city': qRegex },
          { 'address.areaName': qRegex },
          { 'address.suburb': qRegex },
          { 'address.road': qRegex },
        ],
      });
    }

    const filter = conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0] : { $and: conditions };

    const complaints = await Complaint.find(filter).sort({ createdAt: -1 }).limit(100);

    return res.status(200).json({
      success: true,
      count: complaints.length,
      complaints,
      data: complaints,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Endpoint 7: GET /api/complaints/resolved
 * Area-Wise Resolved Complaints Archive
 * Returns complaints where status === 'Resolved' with before/after photos and official remarks.
 * Enforces officer ward scoping if user is authenticated with role === 'admin'.
 */
const getResolvedComplaints = async (req, res, next) => {
  try {
    const { areaName, area, city, wardId, search, query, page = 1, limit = 100 } = req.query;
    const conditions = [{ status: { $in: ['Resolved', 'Closed'] } }];

    // 1. Role-Based Ward Enforcement
    if (req.user && ['ward_officer', 'field_officer'].includes(req.user.role) && req.user.wardId) {
      conditions.push({ wardId: req.user.wardId });
    } else if (wardId) {
      conditions.push({ wardId });
    } else {
      // Citizen or Super Admin area filter
      const targetArea = areaName || area || city;
      if (
        targetArea &&
        targetArea.trim() &&
        targetArea.trim().toLowerCase() !== 'all' &&
        !targetArea.trim().toLowerCase().startsWith('all')
      ) {
        const aRegex = { $regex: new RegExp(targetArea.trim(), 'i') };
        conditions.push({
          $or: [
            { 'address.areaName': aRegex },
            { 'address.suburb': aRegex },
            { 'address.city': aRegex },
            { 'address.road': aRegex },
          ],
        });
      }
    }

    // 2. Keyword Search
    const searchText = search || query;
    if (searchText && searchText.trim()) {
      const sRegex = { $regex: new RegExp(searchText.trim(), 'i') };
      conditions.push({
        $or: [
          { 'title.en': sRegex },
          { 'title.hi': sRegex },
          { 'address.road': sRegex },
          { 'address.areaName': sRegex },
          { 'resolutionProof.officialRemark': sRegex },
        ],
      });
    }

    const queryFilter = conditions.length === 1 ? conditions[0] : { $and: conditions };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 100));
    const skip = (pageNum - 1) * limitNum;

    const [total, complaints] = await Promise.all([
      Complaint.countDocuments(queryFilter),
      Complaint.find(queryFilter)
        .sort({ 'resolutionProof.resolvedAt': -1, updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    // Group complaints by areaName for convenient area-wise tabs / accordions
    const groupedByArea = {};
    complaints.forEach((c) => {
      const a = c.address?.areaName || c.address?.suburb || c.address?.city || 'General Area';
      if (!groupedByArea[a]) {
        groupedByArea[a] = [];
      }
      groupedByArea[a].push(c);
    });

    return res.status(200).json({
      success: true,
      total,
      count: complaints.length,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      complaints,
      data: complaints,
      groupedByArea,
    });
  } catch (error) {
    console.error('[getResolvedComplaints Error]:', error);
    next(error);
  }
};

/**
 * Endpoint 6: GET /api/complaints/stats
 * User profile activity counters
 */
const getUserStats = async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const userCondition = {
      $or: [{ userId }, { reporterUserIds: userId }],
    };

    const [total, pending, underWorking, resolved] = await Promise.all([
      Complaint.countDocuments(userCondition),
      Complaint.countDocuments({ ...userCondition, status: 'Pending' }),
      Complaint.countDocuments({ ...userCondition, status: 'Under Working' }),
      Complaint.countDocuments({ ...userCondition, status: 'Resolved' }),
    ]);

    return res.status(200).json({
      success: true,
      total,
      pending,
      underWorking,
      resolved,
      stats: {
        total,
        pending,
        underWorking,
        resolved,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  previewComplaint,
  submitComplaint,
  updateComplaintStatus,
  getUserComplaints,
  getComplaintsByArea,
  getResolvedComplaints,
  getUserStats,
};
