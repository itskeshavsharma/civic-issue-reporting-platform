const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const {
  requireStaff,
  requireSuperAdmin,
  requireManagingOfficer,
  requireWardOfficer,
  requireFieldOfficer,
} = require('../middleware/roleGuard');
const {
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
} = require('../controllers/hierarchyWorkflowController');

// All workflow routes require verified token
router.use(verifyToken);

// 1. Operational Queue
router.get('/queue', requireStaff, getWorkflowQueue);

// 2. Managing Officer: Forward to Ward
router.patch('/forward-to-ward/:id', requireManagingOfficer, forwardToWard);

// 3. Ward Officer: Assign to Field
router.patch('/assign-to-field/:id', requireWardOfficer, assignToField);

// 4. Leave Reassignment
router.patch('/reassign/:id', requireWardOfficer, reassignOfficer);

// 5. Field Officer: Start Work
router.patch(
  '/start-work/:id',
  (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      return upload.single('proofImage')(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
      });
    }
    next();
  },
  startWork
);

// 6. Field Officer: Resolve Work (mandatory proof image)
router.patch(
  '/resolve/:id',
  (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      return upload.single('proofImage')(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
      });
    }
    next();
  },
  resolveWork
);

// 7. Strict Upward Return
router.post('/return-upward/:id', returnUpward);

// 8. Update Severity (Managing Officer & Ward Officer)
router.patch('/severity/:id', requireStaff, updateSeverity);

// 9. Citizen Confirm or Reopen
router.patch('/citizen-action/:id', citizenAction);

// 10. Super Admin Analytics
router.get('/analytics', requireSuperAdmin, getSystemAnalytics);

// 11. Immutable Audit Trail
router.get('/audit-trail/:id', getComplaintAuditTrail);

module.exports = router;
