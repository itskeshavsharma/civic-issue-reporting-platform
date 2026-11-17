const User = require('../models/User');
const Ward = require('../models/Ward');
const Department = require('../models/Department');
const Complaint = require('../models/Complaint');
const AuditLog = require('../models/AuditLog');
const { admin, auth } = require('../config/firebase');

/**
 * Valid parent creation permissions:
 * - super_admin can create managing_officer (and any lower tier)
 * - managing_officer can create ward_officer
 * - ward_officer can create field_officer
 */
const CAN_CREATE_ROLE = {
  super_admin: ['managing_officer', 'ward_officer', 'field_officer'],
  managing_officer: ['ward_officer'],
  ward_officer: ['field_officer'],
};

/**
 * @desc    Create Municipal Officer in Hierarchy
 * @route   POST /api/staff
 * @access  Private (super_admin, managing_officer, ward_officer)
 */
const createOfficer = async (req, res, next) => {
  try {
    const { email, password, name, role, wardId, departmentId, phone } = req.body;
    const creatorRole = req.user.role;

    if (!email || !password || !name || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, temporary password, full name, and role are required.',
      });
    }

    const allowedRoles = CAN_CREATE_ROLE[creatorRole] || [];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: As a ${creatorRole}, you can only provision officers of role: [${allowedRoles.join(', ')}].`,
      });
    }

    // Role-specific validations
    let effectiveWardId = wardId || null;
    let effectiveDepartmentId = departmentId || null;

    if (role === 'ward_officer') {
      if (!effectiveWardId) {
        return res.status(400).json({
          success: false,
          message: 'Ward selection is required for Ward Officer accounts.',
        });
      }
      const wardExists = await Ward.findById(effectiveWardId);
      if (!wardExists || !wardExists.isActive) {
        return res.status(400).json({ success: false, message: 'Invalid or inactive Ward selected.' });
      }
    } else if (role === 'field_officer') {
      // If creator is ward_officer, automatically link to their own ward
      if (creatorRole === 'ward_officer') {
        const creatorDoc = await User.findOne({ firebaseUid: req.user.uid });
        if (!creatorDoc || !creatorDoc.wardId) {
          return res.status(400).json({ success: false, message: 'Your account is not linked to any active ward.' });
        }
        effectiveWardId = creatorDoc.wardId;
      }

      if (!effectiveWardId || !effectiveDepartmentId) {
        return res.status(400).json({
          success: false,
          message: 'Both Ward and Department are required for Field Officer accounts.',
        });
      }

      const [wardExists, deptExists] = await Promise.all([
        Ward.findById(effectiveWardId),
        Department.findById(effectiveDepartmentId),
      ]);

      if (!wardExists || !wardExists.isActive) {
        return res.status(400).json({ success: false, message: 'Invalid or inactive Ward selected.' });
      }
      if (!deptExists || !deptExists.isActive) {
        return res.status(400).json({ success: false, message: 'Invalid or inactive Department selected.' });
      }
    }

    if (!auth) {
      return res.status(500).json({ success: false, message: 'Firebase Admin Auth is not initialized on server.' });
    }

    // 1. Create User in Firebase Auth
    const userRecord = await auth.createUser({
      email: email.trim().toLowerCase(),
      password,
      displayName: name.trim(),
    });

    // 2. Set Custom User Claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role,
      wardId: effectiveWardId ? String(effectiveWardId) : null,
      departmentId: effectiveDepartmentId ? String(effectiveDepartmentId) : null,
    });

    // 3. Create Record in MongoDB User collection
    const userDoc = await User.create({
      firebaseUid: userRecord.uid,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      phone: (phone || '').trim(),
      role,
      wardId: effectiveWardId,
      departmentId: effectiveDepartmentId,
      isActive: true,
    });

    const populated = await User.findById(userDoc._id)
      .populate('wardId')
      .populate('departmentId');

    return res.status(201).json({
      success: true,
      message: `Municipal officer "${name}" provisioned as ${role}.`,
      officer: populated,
    });
  } catch (error) {
    console.error('[CreateOfficer Error]:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({ success: false, message: 'An officer with this email already exists in Firebase Auth.' });
    }
    next(error);
  }
};

/**
 * @desc    List Subordinate Officers based on caller role
 * @route   GET /api/staff
 * @access  Private (Staff)
 */
const listOfficers = async (req, res, next) => {
  try {
    const callerRole = req.user.role;
    const { role, wardId, departmentId, includeRevoked = 'true' } = req.query;

    const query = {};
    if (includeRevoked !== 'true') {
      query.isActive = true;
    }

    if (callerRole === 'super_admin') {
      // Super Admin can filter by any role, or defaults to all operational officers
      if (role) {
        query.role = role;
      } else {
        query.role = { $in: ['managing_officer', 'ward_officer', 'field_officer'] };
      }
      if (wardId) query.wardId = wardId;
      if (departmentId) query.departmentId = departmentId;
    } else if (callerRole === 'managing_officer') {
      // Managing Officer sees Ward Officers & Field Officers
      query.role = role && ['ward_officer', 'field_officer'].includes(role) ? role : { $in: ['ward_officer', 'field_officer'] };
      if (wardId) query.wardId = wardId;
      if (departmentId) query.departmentId = departmentId;
    } else if (callerRole === 'ward_officer') {
      // Ward Officer sees Field Officers of their specific ward
      const callerDoc = await User.findOne({ firebaseUid: req.user.uid });
      query.role = 'field_officer';
      query.wardId = callerDoc.wardId;
      if (departmentId) query.departmentId = departmentId;
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized to list personnel.' });
    }

    const officers = await User.find(query)
      .populate('wardId')
      .populate('departmentId')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: officers.length,
      officers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Soft-Delete & Revoke Officer Account
 * @route   PATCH /api/staff/:id/revoke
 * @access  Private (super_admin, managing_officer, ward_officer)
 */
const revokeOfficer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const officer = await User.findById(id);

    if (!officer) {
      return res.status(404).json({ success: false, message: 'Officer not found.' });
    }

    if (officer.firebaseUid === req.user.uid) {
      return res.status(400).json({ success: false, message: 'You cannot revoke your own account.' });
    }

    const callerRole = req.user.role;
    // Check permission to revoke
    if (callerRole === 'managing_officer' && officer.role === 'managing_officer') {
      return res.status(403).json({ success: false, message: 'Cannot revoke peer Managing Officer.' });
    }
    if (callerRole === 'ward_officer' && officer.role !== 'field_officer') {
      return res.status(403).json({ success: false, message: 'Ward Officers can only revoke Field Officers.' });
    }

    // 1. Mark inactive in MongoDB (NEVER delete)
    officer.isActive = false;
    officer.revokedAt = new Date();
    officer.revokedBy = req.user.uid;
    await officer.save();

    // 2. Disable in Firebase Auth
    if (auth && officer.firebaseUid) {
      await auth.updateUser(officer.firebaseUid, { disabled: true }).catch((err) => {
        console.warn('[RevokeOfficer] Firebase account disable warning:', err.message);
      });
    }

    return res.status(200).json({
      success: true,
      message: `Officer ${officer.name} access revoked. Historical records and audit logs are preserved.`,
      officer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Edit Officer details (Name, Ward, Department, Phone, Password)
 * @route   PATCH /api/staff/:id
 * @access  Private (super_admin, managing_officer, ward_officer)
 */
const updateOfficer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, wardId, departmentId, password } = req.body;

    const officer = await User.findById(id);
    if (!officer) {
      return res.status(404).json({ success: false, message: 'Officer not found.' });
    }

    if (name) officer.name = name.trim();
    if (phone !== undefined) officer.phone = String(phone).trim();
    if (wardId !== undefined) officer.wardId = wardId || null;
    if (departmentId !== undefined) officer.departmentId = departmentId || null;

    await officer.save();

    // Sync Firebase Auth if password or name changed
    if (auth && officer.firebaseUid) {
      const fbUpdates = {};
      if (name) fbUpdates.displayName = name.trim();
      if (password && password.length >= 6) fbUpdates.password = password;

      if (Object.keys(fbUpdates).length > 0) {
        await auth.updateUser(officer.firebaseUid, fbUpdates).catch(() => {});
      }

      // Sync custom claims if ward or department changed
      await auth.setCustomUserClaims(officer.firebaseUid, {
        role: officer.role,
        wardId: officer.wardId ? String(officer.wardId) : null,
        departmentId: officer.departmentId ? String(officer.departmentId) : null,
      }).catch(() => {});
    }

    const populated = await User.findById(officer._id)
      .populate('wardId')
      .populate('departmentId');

    return res.status(200).json({
      success: true,
      message: `Officer details for "${officer.name}" updated successfully.`,
      officer: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Officer Ticket History & Chronological Audit Timeline
 * @route   GET /api/staff/:id/history
 * @access  Private (super_admin, managing_officer, ward_officer)
 */
const getOfficerHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const officer = await User.findById(id)
      .populate('wardId')
      .populate('departmentId');

    if (!officer) {
      return res.status(404).json({ success: false, message: 'Officer not found.' });
    }

    // 1. Fetch all complaints ever assigned to this officer
    let complaintFilter = {};
    if (officer.role === 'ward_officer') {
      complaintFilter = { assignedWardOfficerId: officer._id };
    } else if (officer.role === 'field_officer') {
      complaintFilter = { assignedFieldOfficerId: officer._id };
    } else {
      complaintFilter = {
        $or: [{ assignedWardOfficerId: officer._id }, { assignedFieldOfficerId: officer._id }],
      };
    }

    const assignedTickets = await Complaint.find(complaintFilter)
      .populate('wardId')
      .populate('departmentId')
      .sort({ createdAt: -1 })
      .limit(100);

    // 2. Fetch all AuditLog events performed by or assigned to this officer
    const auditLogs = await AuditLog.find({
      $or: [
        { 'performedBy.uid': officer.firebaseUid },
        { 'toUser.uid': officer.firebaseUid },
        { 'fromUser.uid': officer.firebaseUid },
      ],
    })
      .populate('complaintId', 'title status severity address')
      .sort({ timestamp: -1 })
      .limit(200);

    return res.status(200).json({
      success: true,
      officer,
      assignedTicketsCount: assignedTickets.length,
      assignedTickets,
      auditLogsCount: auditLogs.length,
      auditLogs,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOfficer,
  listOfficers,
  revokeOfficer,
  updateOfficer,
  getOfficerHistory,
};
