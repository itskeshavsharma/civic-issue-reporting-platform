const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireSuperAdmin } = require('../middleware/roleGuard');
const {
  getWards,
  createWard,
  updateWard,
  deleteWard,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require('../controllers/masterController');

// Wards
router.get('/wards', getWards);
router.post('/wards', verifyToken, requireSuperAdmin, createWard);
router.patch('/wards/:id', verifyToken, requireSuperAdmin, updateWard);
router.delete('/wards/:id', verifyToken, requireSuperAdmin, deleteWard);

// Departments
router.get('/departments', getDepartments);
router.post('/departments', verifyToken, requireSuperAdmin, createDepartment);
router.patch('/departments/:id', verifyToken, requireSuperAdmin, updateDepartment);
router.delete('/departments/:id', verifyToken, requireSuperAdmin, deleteDepartment);

module.exports = router;
