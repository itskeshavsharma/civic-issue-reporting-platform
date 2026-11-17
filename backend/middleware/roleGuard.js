/**
 * RBAC Guard Middleware for 5-Tier Municipal Hierarchy
 * Hierarchy Tiers:
 * 1. super_admin (Municipal Head / System Owner)
 * 2. managing_officer (Central Intake & Ward Router)
 * 3. ward_officer (Ward Supervisor)
 * 4. field_officer (Ground Execution)
 * 5. citizen (Public Reporter)
 */

/**
 * Generic role checker
 * @param  {...string} allowedRoles
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No authenticated user context found.',
      });
    }

    const userRole = req.user.role;
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Forbidden: Access restricted to authorized roles [${allowedRoles.join(', ')}].`,
      currentRole: userRole || 'unassigned',
    });
  };
};

/**
 * Super Admin ONLY (Tier 1)
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. No authenticated context found.',
    });
  }

  if (req.user.role === 'super_admin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Forbidden: Access restricted to Municipal Head / IT Admin (super_admin).',
    currentRole: req.user.role || 'unassigned',
  });
};

/**
 * Managing Officer & Super Admin (Tiers 1 & 2)
 */
const requireManagingOfficer = requireRole('super_admin', 'managing_officer');

/**
 * Ward Officer & Superiors (Tiers 1, 2, 3)
 */
const requireWardOfficer = requireRole('super_admin', 'managing_officer', 'ward_officer');

/**
 * Field Officer & Ward Officer (Tiers 1, 3, 4)
 */
const requireFieldOfficer = requireRole('super_admin', 'ward_officer', 'field_officer');

/**
 * Any Operational Staff Officer (Tiers 1, 2, 3, 4 + legacy admin)
 */
const requireStaff = requireRole(
  'super_admin',
  'managing_officer',
  'ward_officer',
  'field_officer',
  'admin'
);

/**
 * Backwards compatibility alias for requireAdmin
 */
const requireAdmin = requireStaff;

module.exports = {
  requireRole,
  requireSuperAdmin,
  requireManagingOfficer,
  requireWardOfficer,
  requireFieldOfficer,
  requireStaff,
  requireAdmin,
};
