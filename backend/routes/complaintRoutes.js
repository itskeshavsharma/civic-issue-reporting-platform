const express = require('express');
const router = express.Router();

const { authMiddleware, optionalAuthMiddleware } = require('../middleware/authMiddleware');
const uploadMiddleware = require('../middleware/uploadMiddleware');
const {
  previewComplaint,
  submitComplaint,
  updateComplaintStatus,
  getUserComplaints,
  getComplaintsByArea,
  getResolvedComplaints,
  getUserStats,
} = require('../controllers/complaintController');

/**
 * @route   POST /api/complaints/preview
 * @desc    Stage 1: Forward image to FastAPI AI for preliminary issue detection
 * @access  Public / Optional Auth (preview does not require prior login)
 */
router.post('/preview', optionalAuthMiddleware, uploadMiddleware.single('image'), previewComplaint);

/**
 * @route   POST /api/complaints/submit
 * @desc    Stage 2: Process AI embeddings, Cloudinary upload, spatial deduplication (200m + cosine similarity), and DB save
 * @access  Private (Firebase Auth)
 */
router.post('/submit', authMiddleware, uploadMiddleware.single('image'), submitComplaint);

/**
 * @route   PATCH /api/complaints/:id/status
 * @desc    Update complaint status ('Under Working', 'Resolved') with optional proof image and dispatch push notifications
 * @access  Private (Firebase Auth)
 */
router.patch('/:id/status', authMiddleware, uploadMiddleware.single('proofImage'), updateComplaintStatus);

/**
 * @route   GET /api/complaints/my and /api/complaints/my-complaints
 * @desc    Get logged-in user's complaints with status filters & badge counts
 * @access  Private (Firebase Auth)
 */
router.get('/my', authMiddleware, getUserComplaints);
router.get('/my-complaints', authMiddleware, getUserComplaints);

/**
 * @route   GET /api/complaints/resolved
 * @desc    Get resolved complaints archive grouped by area with before/after photos
 * @access  Public / Optional Auth (Scoped to ward for admin officers)
 */
router.get('/resolved', optionalAuthMiddleware, getResolvedComplaints);

/**
 * @route   GET /api/complaints/area and /api/complaints/nearby
 * @desc    Get complaints filtered by City/Area name or geographic radius
 * @access  Public / Community
 */
router.get('/area', getComplaintsByArea);
router.get('/nearby', getComplaintsByArea);

/**
 * @route   GET /api/complaints/stats
 * @desc    Get aggregated activity stats for the logged-in user
 * @access  Private (Firebase Auth)
 */
router.get('/stats', authMiddleware, getUserStats);

module.exports = router;
