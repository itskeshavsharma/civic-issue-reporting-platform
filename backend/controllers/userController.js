const User = require('../models/User');
const { uploadImageToCloudinary } = require('../utils/cloudinary');
const { admin, auth } = require('../config/firebase');

/**
 * @desc    Universal Profile Update for all 5 roles
 * @route   PATCH /api/users/profile
 * @access  Private (All Authenticated Users)
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, isOnLeave } = req.body;
    const userDoc = await User.findOne({ firebaseUid: req.user.uid });

    if (!userDoc) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found in municipal database.',
      });
    }

    // 1. Update text fields if provided
    if (name && typeof name === 'string' && name.trim()) {
      userDoc.name = name.trim();
      // Update Firebase Auth displayName
      if (auth) {
        await auth.updateUser(req.user.uid, { displayName: name.trim() }).catch((err) => {
          console.warn('[UpdateProfile] Firebase displayName sync warning:', err.message);
        });
      }
    }

    if (phone !== undefined) {
      userDoc.phone = String(phone).trim();
    }

    // 2. Handle profile picture upload if attached via Multer
    if (req.file && req.file.buffer) {
      try {
        const secureUrl = await uploadImageToCloudinary(req.file.buffer, 'civic_avatars');
        if (secureUrl) {
          userDoc.photoURL = secureUrl;
          if (auth) {
            await auth.updateUser(req.user.uid, { photoURL: secureUrl }).catch(() => {});
          }
        }
      } catch (uploadErr) {
        console.warn('[UpdateProfile] Cloudinary upload failed, keeping existing photo:', uploadErr.message);
      }
    } else if (req.body.photoURL) {
      userDoc.photoURL = req.body.photoURL.trim();
    }

    // 3. Officers can toggle their own "On Leave" status
    if (isOnLeave !== undefined && userDoc.role !== 'citizen') {
      userDoc.isOnLeave = Boolean(isOnLeave === true || isOnLeave === 'true');
    }

    await userDoc.save();

    const populated = await User.findById(userDoc._id)
      .populate('wardId')
      .populate('departmentId');

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        uid: populated.firebaseUid,
        _id: populated._id,
        email: populated.email,
        name: populated.name,
        displayName: populated.name,
        phone: populated.phone,
        photoURL: populated.photoURL,
        role: populated.role,
        ward: populated.wardId ? { _id: populated.wardId._id, name: populated.wardId.name, code: populated.wardId.code } : null,
        department: populated.departmentId
          ? { _id: populated.departmentId._id, name: populated.departmentId.name, code: populated.departmentId.code }
          : null,
        isOnLeave: populated.isOnLeave,
        isActive: populated.isActive,
      },
    });
  } catch (error) {
    console.error('[UpdateProfile Error]:', error);
    next(error);
  }
};

/**
 * @desc    Get Current User Profile
 * @route   GET /api/users/profile
 * @access  Private
 */
const getProfile = async (req, res, next) => {
  try {
    const userDoc = await User.findOne({ firebaseUid: req.user.uid })
      .populate('wardId')
      .populate('departmentId');

    if (!userDoc) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user: userDoc,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateProfile,
  getProfile,
};
