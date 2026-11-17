const Ward = require('../models/Ward');
const Department = require('../models/Department');

// =============================================================================
// Master Wards CRUD
// =============================================================================

/**
 * @desc    Get all active wards (City-Agnostic)
 * @route   GET /api/master/wards
 * @access  Public / Authenticated
 */
const getWards = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    const filter = includeInactive === 'true' ? {} : { isActive: true };
    const wards = await Ward.find(filter).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: wards.length,
      wards,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new Ward
 * @route   POST /api/master/wards
 * @access  Private (Super Admin)
 */
const createWard = async (req, res, next) => {
  try {
    const { name, code, description } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Ward name and unique code are required.',
      });
    }

    const existingCode = await Ward.findOne({ code: code.trim().toUpperCase() });
    if (existingCode) {
      return res.status(409).json({
        success: false,
        message: `A ward with code "${code.trim().toUpperCase()}" already exists.`,
      });
    }

    const ward = await Ward.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: (description || '').trim(),
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: `Ward "${ward.name}" (${ward.code}) registered successfully.`,
      ward,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Ward details
 * @route   PATCH /api/master/wards/:id
 * @access  Private (Super Admin)
 */
const updateWard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, description, isActive } = req.body;

    const ward = await Ward.findById(id);
    if (!ward) {
      return res.status(404).json({
        success: false,
        message: 'Ward not found.',
      });
    }

    if (name) ward.name = name.trim();
    if (code) {
      const codeUpper = code.trim().toUpperCase();
      const existing = await Ward.findOne({ code: codeUpper, _id: { $ne: id } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `Code "${codeUpper}" is already in use by another ward.`,
        });
      }
      ward.code = codeUpper;
    }
    if (description !== undefined) ward.description = String(description).trim();
    if (isActive !== undefined) ward.isActive = Boolean(isActive);

    await ward.save();

    return res.status(200).json({
      success: true,
      message: `Ward "${ward.name}" updated successfully.`,
      ward,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Soft-delete / deactivate Ward
 * @route   DELETE /api/master/wards/:id
 * @access  Private (Super Admin)
 */
const deleteWard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ward = await Ward.findById(id);
    if (!ward) {
      return res.status(404).json({ success: false, message: 'Ward not found.' });
    }

    ward.isActive = false;
    await ward.save();

    return res.status(200).json({
      success: true,
      message: `Ward "${ward.name}" deactivated successfully.`,
      ward,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// Master Departments CRUD
// =============================================================================

/**
 * @desc    Get all active departments with SLA hours
 * @route   GET /api/master/departments
 * @access  Public / Authenticated
 */
const getDepartments = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    const filter = includeInactive === 'true' ? {} : { isActive: true };
    const departments = await Department.find(filter).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: departments.length,
      departments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new Department with custom SLA hours
 * @route   POST /api/master/departments
 * @access  Private (Super Admin)
 */
const createDepartment = async (req, res, next) => {
  try {
    const { name, code, slaHours = 48, description } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Department name and unique code are required.',
      });
    }

    const existing = await Department.findOne({
      $or: [{ name: name.trim() }, { code: code.trim().toUpperCase() }],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A department with this name or code already exists.',
      });
    }

    const department = await Department.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      slaHours: Math.max(1, parseInt(slaHours, 10) || 48),
      description: (description || '').trim(),
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: `Department "${department.name}" registered with ${department.slaHours}h SLA.`,
      department,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Department
 * @route   PATCH /api/master/departments/:id
 * @access  Private (Super Admin)
 */
const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, slaHours, description, isActive } = req.body;

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }

    if (name) department.name = name.trim();
    if (code) department.code = code.trim().toUpperCase();
    if (slaHours !== undefined) department.slaHours = Math.max(1, parseInt(slaHours, 10) || 48);
    if (description !== undefined) department.description = String(description).trim();
    if (isActive !== undefined) department.isActive = Boolean(isActive);

    await department.save();

    return res.status(200).json({
      success: true,
      message: `Department "${department.name}" updated successfully.`,
      department,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Soft-delete / deactivate Department
 * @route   DELETE /api/master/departments/:id
 * @access  Private (Super Admin)
 */
const deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }

    department.isActive = false;
    await department.save();

    return res.status(200).json({
      success: true,
      message: `Department "${department.name}" deactivated successfully.`,
      department,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWards,
  createWard,
  updateWard,
  deleteWard,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
