const Complaint = require('../models/Complaint');
const Ward = require('../models/Ward');
const Department = require('../models/Department');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { uploadImageToCloudinary } = require('../utils/cloudinary');
const { sendComplaintNotification } = require('../utils/notificationService');

/**
 * Helper: Upload image buffer to Cloudinary with fallback
 */
async function uploadProof(fileBuffer, folderName) {
  if (fileBuffer && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_CLOUD_NAME) {
    return await uploadImageToCloudinary(fileBuffer, folderName);
  }
  return null;
}

/**
 * Helper: Notify Citizen Reporters via In-App Notification and FCM Web Push
 */
async function notifyCitizens(complaint, title, body) {
  try {
    const allUserIds = Array.from(new Set([complaint.userId, ...(complaint.reporterUserIds || [])].filter(Boolean)));
    const fcmTokens = Array.isArray(complaint.fcmTokens) ? complaint.fcmTokens : [];
    if (allUserIds.length > 0 || fcmTokens.length > 0) {
      sendComplaintNotification({
        tokens: fcmTokens,
        userIds: allUserIds,
        title,
        body,
        complaintId: complaint._id,
        clickAction: '/my-complaints',
      }).catch((e) => console.warn('[notifyCitizens Push Warning]:', e.message));
    }
  } catch (err) {
    console.warn('[notifyCitizens Warning]:', err.message);
  }
}

/**
 * Helper: Record Immutable Audit Log
 */
async function logAuditEvent({
  complaintId,
  action,
  performedBy,
  fromUser = null,
  toUser = null,
  fromStatus = null,
  toStatus = null,
  reason = '',
  metadata = {},
}) {
  try {
    await AuditLog.create({
      complaintId,
      action,
      performedBy: {
        uid: performedBy.uid || performedBy.firebaseUid || 'system',
        name: performedBy.name || performedBy.displayName || 'System',
        role: performedBy.role || 'system',
      },
      fromUser: fromUser ? { uid: fromUser.uid, name: fromUser.name, role: fromUser.role } : null,
      toUser: toUser ? { uid: toUser.uid, name: toUser.name, role: toUser.role } : null,
      fromStatus,
      toStatus,
      reason: (reason || '').trim(),
      metadata,
    });
  } catch (err) {
    console.error('[AuditLog Error]:', err.message);
  }
}

/**
 * @desc    Get Role-Scoped Operational Queue with Live SLA Timers
 * @route   GET /api/workflow/queue
 * @access  Private (Staff: super_admin, managing_officer, ward_officer, field_officer)
 */
const getWorkflowQueue = async (req, res, next) => {
  try {
    const caller = req.user;
    const { status, wardId, departmentId, isEscalated, slaBreached, search, page = 1, limit = 50 } = req.query;

    const conditions = [];

    // 1. Role Scoping
    if (caller.role === 'super_admin') {
      // Super Admin sees everything; can filter by specific ward, department, escalation, or SLA breach
      if (wardId) conditions.push({ wardId });
      if (departmentId) conditions.push({ departmentId });
      if (isEscalated === 'true') conditions.push({ isEscalated: true });
      if (slaBreached === 'true') conditions.push({ slaBreached: true });
      if (status) conditions.push({ status });
    } else if (caller.role === 'managing_officer') {
      // Managing Officer:
      // - Central intake of all 'Submitted' tickets
      // - Tickets returned upward to them
      // - Tickets in wards that have no active Ward Officer
      const managingFilter = [
        { status: 'Submitted' },
        { 'returnedBy.role': 'ward_officer' },
        { status: 'Assigned to Ward', assignedWardOfficerId: null },
      ];
      if (status) {
        conditions.push({ status });
      } else {
        conditions.push({ $or: managingFilter });
      }
    } else if (caller.role === 'ward_officer') {
      // Ward Officer:
      // Sees only complaints assigned to their ward
      const callerDoc = await User.findOne({ firebaseUid: caller.uid });
      if (!callerDoc || !callerDoc.wardId) {
        return res.status(200).json({ success: true, count: 0, total: 0, complaints: [] });
      }
      conditions.push({ wardId: callerDoc.wardId });

      if (status) {
        conditions.push({ status });
      } else {
        // Default: tickets waiting for assignment or in progress/reopened in this ward
        conditions.push({
          status: { $in: ['Assigned to Ward', 'Assigned', 'In Progress', 'Reopened', 'Resolved'] },
        });
      }
    } else if (caller.role === 'field_officer') {
      // Field Officer:
      // Sees only tickets specifically assigned to them
      const callerDoc = await User.findOne({ firebaseUid: caller.uid });
      conditions.push({ assignedFieldOfficerId: callerDoc._id });
      if (status) {
        conditions.push({ status });
      } else {
        conditions.push({ status: { $in: ['Assigned', 'In Progress'] } });
      }
    }

    // 2. Keyword Search
    if (search && search.trim()) {
      const s = search.trim();
      const sRegex = { $regex: new RegExp(s, 'i') };
      conditions.push({
        $or: [
          { 'title.en': sRegex },
          { 'title.hi': sRegex },
          { 'address.road': sRegex },
          { 'address.areaName': sRegex },
          { userEmail: sRegex },
        ],
      });
    }

    const queryFilter = conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0] : { $and: conditions };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [total, rawComplaints] = await Promise.all([
      Complaint.countDocuments(queryFilter),
      Complaint.find(queryFilter)
        .populate('wardId')
        .populate('departmentId')
        .populate('assignedWardOfficerId', 'name email phone isOnLeave isActive')
        .populate('assignedFieldOfficerId', 'name email phone isOnLeave isActive')
        .sort({ isEscalated: -1, slaBreached: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    // Check & tag active SLA breaches in real-time
    const now = new Date();
    const complaints = await Promise.all(
      rawComplaints.map(async (c) => {
        let isNowBreached = Boolean(c.slaBreached);
        let breachStage = c.slaBreachDetails?.stage || null;

        if (!['Resolved', 'Closed'].includes(c.status)) {
          if (c.status === 'Submitted' && c.forwardDeadline && now > c.forwardDeadline) {
            isNowBreached = true;
            breachStage = 'Managing Officer Forward SLA (24h)';
          } else if (c.status === 'Assigned to Ward' && c.assignDeadline && now > c.assignDeadline) {
            isNowBreached = true;
            breachStage = 'Ward Officer Assignment SLA (24h)';
          } else if (['Assigned', 'In Progress'].includes(c.status) && c.resolutionDeadline && now > c.resolutionDeadline) {
            isNowBreached = true;
            breachStage = 'Field Officer Resolution SLA';
          }

          if (isNowBreached && !c.slaBreached) {
            c.slaBreached = true;
            c.slaBreachDetails = { stage: breachStage, breachedAt: now };
            await c.save();
            await logAuditEvent({
              complaintId: c._id,
              action: 'SLA_BREACHED',
              performedBy: { uid: 'system', name: 'SLA Monitor Daemon', role: 'system' },
              reason: `Breached deadline at ${breachStage}`,
            });
          }
        }

        return c;
      })
    );

    // Redact citizen PII for all municipal officers / staff
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
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      complaints: sanitizedComplaints,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Managing Officer: Forward Complaint to Ward
 * @route   PATCH /api/workflow/forward-to-ward/:id
 * @access  Private (super_admin, managing_officer)
 */
const forwardToWard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { wardId } = req.body;

    if (!wardId) {
      return res.status(400).json({ success: false, message: 'Official Ward selection is required.' });
    }

    const [complaint, ward] = await Promise.all([Complaint.findById(id), Ward.findById(wardId)]);

    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    if (!ward || !ward.isActive) return res.status(400).json({ success: false, message: 'Invalid or inactive Ward.' });

    // Find active Ward Officer for this ward
    const activeWardOfficer = await User.findOne({ wardId, role: 'ward_officer', isActive: true });

    const previousStatus = complaint.status;
    complaint.wardId = ward._id;
    complaint.assignedWardOfficerId = activeWardOfficer ? activeWardOfficer._id : null;
    complaint.status = 'Assigned to Ward';
    complaint.assignDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour assignment deadline
    complaint.returnedBy = null; // Clear returned state

    await complaint.save();

    await logAuditEvent({
      complaintId: complaint._id,
      action: 'FORWARDED_TO_WARD',
      performedBy: req.user,
      toUser: activeWardOfficer,
      fromStatus: previousStatus,
      toStatus: 'Assigned to Ward',
      reason: `Forwarded to Ward: ${ward.name} (${ward.code})`,
      metadata: { wardId: ward._id, wardName: ward.name },
    });

    const populated = await Complaint.findById(complaint._id)
      .populate('wardId')
      .populate('departmentId')
      .populate('assignedWardOfficerId', 'name email phone isOnLeave');

    const titleEn = typeof complaint.title === 'object' ? complaint.title?.en : complaint.title;
    notifyCitizens(
      complaint,
      'Grievance Routed to Ward 🏛️',
      `Your report "${titleEn || 'Civic Issue'}" has been verified and routed to ${ward.name} for departmental action.`
    );

    return res.status(200).json({
      success: true,
      message: `Complaint forwarded to ${ward.name}. ${activeWardOfficer ? 'Assigned to Ward Officer.' : 'Warning: No active Ward Officer for this ward.'}`,
      complaint: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ward Officer: Assign Complaint to Field Officer
 * @route   PATCH /api/workflow/assign-to-field/:id
 * @access  Private (super_admin, ward_officer)
 */
const assignToField = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fieldOfficerId, departmentId } = req.body;

    if (!fieldOfficerId) {
      return res.status(400).json({ success: false, message: 'Field Officer selection is required.' });
    }

    const [complaint, fieldOfficer] = await Promise.all([
      Complaint.findById(id),
      User.findOne({ _id: fieldOfficerId, role: 'field_officer', isActive: true }).populate('departmentId'),
    ]);

    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    if (!fieldOfficer) return res.status(404).json({ success: false, message: 'Active Field Officer not found.' });

    // Determine department and SLA hours
    const targetDeptId = departmentId || fieldOfficer.departmentId?._id;
    let deptSlaHours = 48;
    if (targetDeptId) {
      const deptDoc = await Department.findById(targetDeptId);
      if (deptDoc) {
        deptSlaHours = deptDoc.slaHours || 48;
        complaint.departmentId = deptDoc._id;
      }
    }

    const previousStatus = complaint.status;
    complaint.assignedFieldOfficerId = fieldOfficer._id;
    complaint.status = 'Assigned';
    complaint.resolutionDeadline = new Date(Date.now() + deptSlaHours * 60 * 60 * 1000);
    complaint.returnedBy = null;

    await complaint.save();

    await logAuditEvent({
      complaintId: complaint._id,
      action: 'ASSIGNED_TO_FIELD',
      performedBy: req.user,
      toUser: fieldOfficer,
      fromStatus: previousStatus,
      toStatus: 'Assigned',
      reason: `Assigned to Field Officer ${fieldOfficer.name} (SLA: ${deptSlaHours}h)`,
      metadata: { fieldOfficerId: fieldOfficer._id, isOnLeave: fieldOfficer.isOnLeave },
    });

    const populated = await Complaint.findById(complaint._id)
      .populate('wardId')
      .populate('departmentId')
      .populate('assignedFieldOfficerId', 'name email phone isOnLeave');

    const titleEn = typeof complaint.title === 'object' ? complaint.title?.en : complaint.title;
    const deptName = populated.departmentId?.name || 'Field Operations';
    notifyCitizens(
      complaint,
      'Field Crew Dispatched 👷',
      `Your grievance "${titleEn || 'Civic Issue'}" has been assigned to ${deptName} crew (${fieldOfficer.name}) for on-ground repair.`
    );

    return res.status(200).json({
      success: true,
      message: `Assigned to ${fieldOfficer.name}. Resolution deadline set to ${deptSlaHours} hours.`,
      complaint: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Leave Reassignment (1-Click)
 * @route   PATCH /api/workflow/reassign/:id
 * @access  Private (super_admin, managing_officer, ward_officer)
 */
const reassignOfficer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newFieldOfficerId, reason = 'Officer on leave reassignment' } = req.body;

    const [complaint, newOfficer] = await Promise.all([
      Complaint.findById(id),
      User.findOne({ _id: newFieldOfficerId, role: 'field_officer', isActive: true }),
    ]);

    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    if (!newOfficer) return res.status(404).json({ success: false, message: 'New Field Officer not found or inactive.' });

    const previousOfficerId = complaint.assignedFieldOfficerId;
    complaint.assignedFieldOfficerId = newOfficer._id;
    await complaint.save();

    await logAuditEvent({
      complaintId: complaint._id,
      action: 'REASSIGNED',
      performedBy: req.user,
      fromUser: previousOfficerId ? { uid: String(previousOfficerId), name: 'Previous Officer', role: 'field_officer' } : null,
      toUser: newOfficer,
      reason: reason.trim(),
    });

    const populated = await Complaint.findById(complaint._id)
      .populate('wardId')
      .populate('departmentId')
      .populate('assignedFieldOfficerId', 'name email phone isOnLeave');

    const titleEn = typeof complaint.title === 'object' ? complaint.title?.en : complaint.title;
    notifyCitizens(
      complaint,
      'Crew Reassigned 🔄',
      `Repair operations for "${titleEn || 'Civic Issue'}" reassigned to backup field crew (${newOfficer.name}) to ensure prompt resolution.`
    );

    return res.status(200).json({
      success: true,
      message: `Ticket reassigned to ${newOfficer.name} successfully.`,
      complaint: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Field Officer: Start Work on Ticket
 * @route   PATCH /api/workflow/start-work/:id
 * @access  Private (field_officer, super_admin)
 */
const startWork = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { officialRemark } = req.body;

    // Strict Segregation of Duties: Only field_officer or super_admin
    if (!['field_officer', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Managing Officers and Ward Officers cannot transition tickets to In Progress. Only assigned Field Officers can start work.',
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    let inProgressUrl = complaint.workInProgress?.imageUrl || null;
    if (req.file && req.file.buffer) {
      inProgressUrl = await uploadProof(req.file.buffer, 'civic_in_progress');
    }

    const previousStatus = complaint.status;
    complaint.status = 'In Progress';
    complaint.workInProgress = {
      imageUrl: inProgressUrl,
      updatedAt: new Date(),
      officialRemark: officialRemark || 'Field crew has arrived and commenced work.',
    };

    await complaint.save();

    await logAuditEvent({
      complaintId: complaint._id,
      action: 'STARTED_WORK',
      performedBy: req.user,
      fromStatus: previousStatus,
      toStatus: 'In Progress',
      reason: officialRemark || 'Work started on site',
    });

    const titleEn = typeof complaint.title === 'object' ? complaint.title?.en : complaint.title;
    notifyCitizens(
      complaint,
      'Work In Progress 🛠️',
      officialRemark || `Field crew has arrived on-site and commenced repair for "${titleEn || 'Civic Issue'}".`
    );

    return res.status(200).json({
      success: true,
      message: 'Work commenced. Ticket updated to "In Progress".',
      complaint,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Field Officer: Complete & Resolve Ticket (Mandatory Cloudinary Photo)
 * @route   PATCH /api/workflow/resolve/:id
 * @access  Private (field_officer, super_admin)
 */
const resolveWork = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { officialRemark } = req.body;

    // Strict Segregation of Duties: Only field_officer or super_admin
    if (!['field_officer', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Managing Officers and Ward Officers cannot mark tickets as Resolved. Only assigned Field Officers can complete work.',
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory resolution proof image is required to mark the grievance as Resolved.',
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    // Upload resolution proof
    const proofUrl = await uploadProof(req.file.buffer, 'civic_resolutions');
    if (!proofUrl) {
      return res.status(500).json({ success: false, message: 'Failed to upload resolution proof image.' });
    }

    const previousStatus = complaint.status;
    complaint.status = 'Resolved';
    complaint.resolutionProof = {
      imageUrl: proofUrl,
      resolvedAt: new Date(),
      officialRemark: officialRemark || 'Issue resolved and verified on ground.',
    };

    await complaint.save();

    await logAuditEvent({
      complaintId: complaint._id,
      action: 'RESOLVED',
      performedBy: req.user,
      fromStatus: previousStatus,
      toStatus: 'Resolved',
      reason: officialRemark || 'Ground resolution completed with photographic proof',
    });

    // Multicast Push Notifications to reporting citizens via FCM
    const allUserIds = Array.from(new Set([complaint.userId, ...(complaint.reporterUserIds || [])].filter(Boolean)));
    const fcmTokens = Array.isArray(complaint.fcmTokens) ? complaint.fcmTokens : [];

    sendComplaintNotification({
      tokens: fcmTokens,
      userIds: allUserIds,
      title: 'Issue Resolved! ✅',
      body: 'Municipal team has completed work. Tap to view the Before vs After photo and confirm or reopen.',
      complaintId: complaint._id,
      clickAction: '/my-complaints',
    }).catch((err) => console.warn('[Resolve Push Error]:', err.message));

    return res.status(200).json({
      success: true,
      message: 'Complaint resolved successfully. Photographic evidence recorded.',
      complaint,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Strict Upward-Only Return with 3-Strike Escalation
 * @route   POST /api/workflow/return-upward/:id
 * @access  Private (field_officer, ward_officer)
 */
const returnUpward = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const caller = req.user;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory reason is required to return a complaint upward.',
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    const previousStatus = complaint.status;
    let newStatus = complaint.status;
    let targetTier = '';

    if (caller.role === 'field_officer') {
      // Returns strictly one level up to Ward Officer
      newStatus = 'Assigned to Ward';
      complaint.assignedFieldOfficerId = null;
      targetTier = 'Ward Officer';
    } else if (caller.role === 'ward_officer') {
      // Returns strictly one level up to Managing Officer
      newStatus = 'Submitted';
      complaint.wardId = null;
      complaint.assignedWardOfficerId = null;
      complaint.assignedFieldOfficerId = null;
      targetTier = 'Managing Officer';
    } else {
      return res.status(403).json({ success: false, message: 'Only Field Officers and Ward Officers can initiate upward returns.' });
    }

    complaint.status = newStatus;
    complaint.returnCount = (complaint.returnCount || 0) + 1;
    complaint.lastReturnReason = reason.trim();
    complaint.returnedBy = {
      uid: caller.uid,
      name: caller.name,
      role: caller.role,
      at: new Date(),
    };

    // 3-Strike Escalation Check
    let escalatedAlert = false;
    if (complaint.returnCount >= 3) {
      complaint.isEscalated = true;
      escalatedAlert = true;
    }

    await complaint.save();

    await logAuditEvent({
      complaintId: complaint._id,
      action: escalatedAlert ? 'ESCALATED_3_STRIKES' : 'RETURNED_UPWARD',
      performedBy: caller,
      fromStatus: previousStatus,
      toStatus: newStatus,
      reason: reason.trim(),
      metadata: { returnCount: complaint.returnCount, escalated: escalatedAlert },
    });

    return res.status(200).json({
      success: true,
      message: `Complaint returned upward to ${targetTier}. (Return Count: ${complaint.returnCount}${escalatedAlert ? ' - Escalated to Super Admin!' : ''})`,
      complaint,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Citizen: Confirm & Close or Reopen Issue
 * @route   PATCH /api/workflow/citizen-action/:id
 * @access  Private (Citizen reporter)
 */
const citizenAction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // 'confirm' or 'reopen'

    if (!['confirm', 'reopen'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be "confirm" or "reopen".' });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    // Verify citizen owns this complaint
    const isReporter = complaint.userId === req.user.uid || (complaint.reporterUserIds || []).includes(req.user.uid);
    if (!isReporter && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only reporting citizens can confirm or reopen this complaint.' });
    }

    if (complaint.status !== 'Resolved' && req.user.role !== 'super_admin') {
      return res.status(400).json({ success: false, message: 'Only Resolved tickets can be confirmed or reopened.' });
    }

    const previousStatus = complaint.status;

    if (action === 'confirm') {
      complaint.status = 'Closed';
      await complaint.save();

      await logAuditEvent({
        complaintId: complaint._id,
        action: 'CLOSED',
        performedBy: req.user,
        fromStatus: previousStatus,
        toStatus: 'Closed',
        reason: 'Citizen verified and confirmed resolution.',
      });

      notifyCitizens(
        complaint,
        'Grievance Closed 🎉',
        'Thank you for verifying and closing this grievance. Working together for a cleaner and safer city!'
      );

      return res.status(200).json({
        success: true,
        message: 'Thank you! Complaint marked as Closed.',
        complaint,
      });
    } else {
      // Reopen
      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, message: 'A mandatory reason is required to reopen an issue.' });
      }

      complaint.status = 'Reopened';
      complaint.reopenCount = (complaint.reopenCount || 0) + 1;
      complaint.reopenReason = reason.trim();
      complaint.reopenedAt = new Date();
      // Unassign field officer so Ward Officer directly has full power to re-dispatch or assign
      complaint.assignedFieldOfficerId = null;
      // Route back to Ward Officer with 24h assignment SLA
      complaint.assignDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await complaint.save();

      await logAuditEvent({
        complaintId: complaint._id,
        action: 'REOPENED',
        performedBy: req.user,
        fromStatus: previousStatus,
        toStatus: 'Reopened',
        reason: reason.trim(),
        metadata: { reopenCount: complaint.reopenCount },
      });

      notifyCitizens(
        complaint,
        'Grievance Reopened ⚠️',
        'Your grievance has been reopened and forwarded to the Ward Officer for priority reinspection.'
      );

      return res.status(200).json({
        success: true,
        message: 'Complaint reopened and routed back to Ward Officer for urgent reinspection.',
        complaint,
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Super Admin: System-Wide Analytics & SLA Performance
 * @route   GET /api/workflow/analytics
 * @access  Private (super_admin)
 */
const getSystemAnalytics = async (req, res, next) => {
  try {
    const [
      totalComplaints,
      submittedCount,
      assignedWardCount,
      assignedCount,
      inProgressCount,
      resolvedCount,
      closedCount,
      reopenedCount,
      escalatedCount,
      slaBreachCount,
    ] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: { $in: ['Submitted', 'Pending'] } }),
      Complaint.countDocuments({ status: 'Assigned to Ward' }),
      Complaint.countDocuments({ status: 'Assigned' }),
      Complaint.countDocuments({ status: { $in: ['In Progress', 'Under Working'] } }),
      Complaint.countDocuments({ status: 'Resolved' }),
      Complaint.countDocuments({ status: 'Closed' }),
      Complaint.countDocuments({ status: 'Reopened' }),
      Complaint.countDocuments({ isEscalated: true }),
      Complaint.countDocuments({ slaBreached: true }),
    ]);

    // Dynamic Ward-Wise Breakdown
    const wardBreakdown = await Complaint.aggregate([
      { $match: { wardId: { $ne: null } } },
      { $group: { _id: '$wardId', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'wards',
          localField: '_id',
          foreignField: '_id',
          as: 'ward',
        },
      },
      { $unwind: '$ward' },
      { $project: { _id: 1, name: '$ward.name', code: '$ward.code', count: 1 } },
      { $sort: { count: -1 } },
    ]);

    // Dynamic Department Breakdown
    const deptBreakdown = await Complaint.aggregate([
      { $match: { departmentId: { $ne: null } } },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department',
        },
      },
      { $unwind: '$department' },
      { $project: { _id: 1, name: '$department.name', code: '$department.code', count: 1 } },
      { $sort: { count: -1 } },
    ]);

    // Average Resolution Time (hours)
    const resolvedComplaints = await Complaint.find({
      status: { $in: ['Resolved', 'Closed'] },
      'resolutionProof.resolvedAt': { $ne: null },
    }).select('createdAt resolutionProof.resolvedAt');

    let avgResolutionHours = 0;
    if (resolvedComplaints.length > 0) {
      const totalHours = resolvedComplaints.reduce((acc, c) => {
        const diff = (new Date(c.resolutionProof.resolvedAt) - new Date(c.createdAt)) / (1000 * 60 * 60);
        return acc + Math.max(0, diff);
      }, 0);
      avgResolutionHours = parseFloat((totalHours / resolvedComplaints.length).toFixed(1));
    }

    return res.status(200).json({
      success: true,
      totalComplaints,
      submittedCount,
      assignedWardCount,
      assignedCount,
      inProgressCount,
      resolvedCount,
      closedCount,
      reopenedCount,
      escalatedCount,
      slaBreachCount,
      avgResolutionHours,
      wardBreakdown,
      deptBreakdown,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Managing Officer & Ward Officer: Update Issue Severity
 * @route   PATCH /api/workflow/severity/:id
 * @access  Private (super_admin, managing_officer, ward_officer)
 */
const updateSeverity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { severity, remark = '' } = req.body;
    const caller = req.user;

    if (!['super_admin', 'managing_officer', 'ward_officer'].includes(caller.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only Managing Officers and Ward Officers can change issue severity.',
      });
    }

    const upperSev = (severity || '').toUpperCase();
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(upperSev)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid severity level. Allowed values: LOW, MEDIUM, HIGH, CRITICAL.',
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    // Ward Officer scoping
    if (caller.role === 'ward_officer') {
      const callerDoc = await User.findOne({ firebaseUid: caller.uid });
      const callerWardId = callerDoc?.wardId?._id ? String(callerDoc.wardId._id) : callerDoc?.wardId ? String(callerDoc.wardId) : null;
      const complaintWardId = complaint.wardId?._id ? String(complaint.wardId._id) : complaint.wardId ? String(complaint.wardId) : null;

      const isMyWard = callerWardId && complaintWardId && callerWardId === complaintWardId;
      const isMyOfficer = complaint.assignedWardOfficerId && String(complaint.assignedWardOfficerId) === String(callerDoc?._id);

      if (!isMyWard && !isMyOfficer && complaintWardId !== null) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only adjust severity for complaints in your assigned ward.',
        });
      }
    }

    const previousSeverity = complaint.severity;
    complaint.severity = upperSev;
    await complaint.save();

    await logAuditEvent({
      complaintId: complaint._id,
      action: 'SEVERITY_UPDATED',
      performedBy: caller,
      reason: remark || `Severity updated from ${previousSeverity} to ${upperSev}`,
      metadata: { previousSeverity, newSeverity: upperSev },
    });

    notifyCitizens(
      complaint,
      'Priority Updated ⚡',
      `Municipal officers updated your grievance priority to ${upperSev}.${remark ? ` (${remark})` : ''}`
    );

    return res.status(200).json({
      success: true,
      message: `Grievance severity updated to ${upperSev} successfully.`,
      complaint,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Chronological Audit Trail for a Complaint (PII-protected)
 * @route   GET /api/workflow/audit-trail/:id
 * @access  Private (All authenticated)
 */
const getComplaintAuditTrail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const auditLogs = await AuditLog.find({ complaintId: id }).sort({ timestamp: 1 });

    // Protect citizen personal information from municipal viewers
    const sanitizedLogs = auditLogs.map((entry) => {
      const obj = entry.toObject ? entry.toObject() : { ...entry };
      if (obj.performedBy?.role === 'citizen') {
        obj.performedBy = { uid: 'protected', name: 'Verified Citizen', role: 'citizen' };
      }
      return obj;
    });

    return res.status(200).json({
      success: true,
      count: sanitizedLogs.length,
      auditLogs: sanitizedLogs,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWorkflowQueue,
  forwardToWard,
  assignToField,
  reassignOfficer,
  startWork,
  resolveWork,
  returnUpward,
  citizenAction,
  updateSeverity,
  getSystemAnalytics,
  getComplaintAuditTrail,
};
