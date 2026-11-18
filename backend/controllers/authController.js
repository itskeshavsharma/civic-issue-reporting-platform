const User = require('../models/User');
require('../models/Ward');
require('../models/Department');

/**
 * 5-Tier Role Permissions Matrix
 */
const ROLE_PERMISSIONS = {
  super_admin: [
    'manage_wards',
    'manage_departments',
    'manage_managing_officers',
    'manage_all_officers',
    'view_all_queues',
    'view_analytics',
    'view_escalations',
    'view_audit_logs',
    'view_resolved_archive',
    'edit_own_profile',
  ],
  managing_officer: [
    'route_complaints',
    'manage_ward_officers',
    'view_intake_queue',
    'view_returned_queue',
    'view_subordinate_history',
    'view_resolved_archive',
    'edit_own_profile',
  ],
  ward_officer: [
    'assign_to_field',
    'reassign_leave',
    'return_to_managing',
    'manage_field_officers',
    'view_ward_queue',
    'view_field_history',
    'view_resolved_archive',
    'edit_own_profile',
  ],
  field_officer: [
    'start_work',
    'resolve_ticket',
    'return_to_ward',
    'view_assigned_tasks',
    'view_resolved_archive',
    'edit_own_profile',
  ],
  citizen: [
    'submit_complaint',
    'view_own_complaints',
    'reopen_complaint',
    'close_complaint',
    'view_nearby',
    'view_resolved_archive',
    'edit_own_profile',
  ],
};

/**
 * @desc    Get authenticated user session details, verified role, assigned ward, and permissions
 * @route   GET /api/auth/me
 * @access  Private (Firebase Bearer Token)
 */
const getMe = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No authenticated user session found.',
      });
    }

    // Refresh user record from MongoDB with populated Ward and Department
    const userDoc = await User.findOne({ firebaseUid: req.user.uid })
      .populate('wardId')
      .populate('departmentId');

    if (!userDoc) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found in municipal database.',
      });
    }

    if (!userDoc.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been revoked or deactivated.',
      });
    }

    const role = userDoc.role || 'citizen';
    const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.citizen;

    const userProfile = {
      uid: userDoc.firebaseUid,
      _id: userDoc._id,
      email: userDoc.email,
      name: userDoc.name,
      displayName: userDoc.name,
      phone: userDoc.phone || '',
      photoURL: userDoc.photoURL || null,
      role,
      ward: userDoc.wardId ? { _id: userDoc.wardId._id, name: userDoc.wardId.name, code: userDoc.wardId.code } : null,
      department: userDoc.departmentId
        ? {
            _id: userDoc.departmentId._id,
            name: userDoc.departmentId.name,
            code: userDoc.departmentId.code,
            slaHours: userDoc.departmentId.slaHours,
          }
        : null,
      isOnLeave: userDoc.isOnLeave || false,
      isActive: userDoc.isActive,
      permissions,
    };

    return res.status(200).json({
      success: true,
      ...userProfile,
      user: userProfile,
    });
  } catch (error) {
    console.error('[AuthController - getMe Error]:', error);
    next(error);
  }
};

module.exports = {
  getMe,
  ROLE_PERMISSIONS,
};
