const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin, requireSuperAdmin } = require('../middleware/roleGuard');
const upload = require('../middleware/uploadMiddleware');

const {
  createOfficer,
  listOfficers,
  deleteOfficer,
  getAdminStats,
  getAllComplaintsAdmin,
  updateTicketStatus,
  getDistinctAreas,
} = require('../controllers/adminController');

/**
 * =============================================================================
 * Municipal Officer & Administrative Endpoints
 * =============================================================================
 */

/**
 * @route   POST /api/admin/officers
 * @desc    Create a new Municipal Officer with Firebase Auth & custom claims
 * @access  Private (Super Admin)
 */
router.post('/officers', verifyToken, requireSuperAdmin, createOfficer);

/**
 * @route   GET /api/admin/officers
 * @desc    List all municipal officers registered in Firebase Auth
 * @access  Private (Super Admin)
 */
router.get('/officers', verifyToken, requireSuperAdmin, listOfficers);

/**
 * @route   DELETE /api/admin/officers/:uid
 * @desc    Revoke and delete a municipal officer account
 * @access  Private (Super Admin)
 */
router.delete('/officers/:uid', verifyToken, requireSuperAdmin, deleteOfficer);

/**
 * @route   GET /api/admin/stats
 * @desc    Administrative dashboard aggregated metrics & priority hotspots
 * @access  Private (Admin / Super Admin)
 */
router.get('/stats', verifyToken, requireAdmin, getAdminStats);

/**
 * @route   GET /api/admin/areas
 * @desc    Dynamic list of unique area / ward names
 * @access  Private (Admin / Super Admin)
 */
router.get('/areas', verifyToken, requireAdmin, getDistinctAreas);

/**
 * @route   GET /api/admin/complaints
 * @desc    Geospatial & tabular grievance feed with multi-criteria filters
 * @access  Private (Admin / Super Admin)
 */
router.get('/complaints', verifyToken, requireAdmin, getAllComplaintsAdmin);

/**
 * @route   PATCH /api/admin/complaints/:id/status
 * @desc    Update complaint status ('Under Working', 'Resolved') with proof image & push notification
 * @access  Private (Admin / Super Admin)
 */
router.patch(
  '/complaints/:id/status',
  verifyToken,
  requireAdmin,
  (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      return upload.single('proofImage')(req, res, (err) => {
        if (err) {
          console.error('[Admin Multer Upload Error]:', err);
          return res.status(400).json({ success: false, message: err.message || 'Image upload error' });
        }
        next();
      });
    }
    next();
  },
  updateTicketStatus
);

module.exports = router;
