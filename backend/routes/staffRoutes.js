const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireWardOfficer } = require('../middleware/roleGuard');
const {
  createOfficer,
  listOfficers,
  revokeOfficer,
  updateOfficer,
  getOfficerHistory,
} = require('../controllers/staffController');

/**
 * All staff management routes require at least Ward Officer tier
 */
router.use(verifyToken, requireWardOfficer);

router.post('/', createOfficer);
router.get('/', listOfficers);
router.patch('/:id', updateOfficer);
router.patch('/:id/revoke', revokeOfficer);
router.get('/:id/history', getOfficerHistory);

module.exports = router;
