const { admin, auth } = require('../config/firebase');
const User = require('../models/User');
require('../models/Ward');
require('../models/Department');

/**
 * Express middleware to authenticate requests using Firebase ID Token.
 * Extracts Bearer token, verifies via Firebase Admin SDK,
 * syncs/retrieves MongoDB User document, and attaches it to req.user.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No Bearer token provided in Authorization header.',
      });
    }

    const token = authHeader.split('Bearer ')[1].trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token is empty.',
      });
    }

    if (!auth) {
      return res.status(500).json({
        success: false,
        message: 'Firebase Auth is uninitialized on server. Check service account configuration.',
      });
    }

    const decodedToken = await auth.verifyIdToken(token);

    // Synchronize or find MongoDB User record
    let userDoc = await User.findOne({ firebaseUid: decodedToken.uid })
      .populate('wardId')
      .populate('departmentId');

    if (!userDoc) {
      // Auto-create initial user record for authenticated citizen or newly bootstrapped account
      const effectiveRole = decodedToken.role || 'citizen';
      userDoc = await User.create({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email || '',
        name: decodedToken.name || (decodedToken.email ? decodedToken.email.split('@')[0] : 'User'),
        photoURL: decodedToken.picture || null,
        role: effectiveRole,
      });
    }

    // Check if account has been soft-deleted / revoked
    if (!userDoc.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your municipal account has been revoked or deactivated. Access is denied.',
      });
    }

    // Attach verified user context to request
    req.user = {
      uid: decodedToken.uid,
      _id: userDoc._id,
      email: userDoc.email,
      name: userDoc.name,
      displayName: userDoc.name,
      photoURL: userDoc.photoURL,
      role: userDoc.role,
      wardId: userDoc.wardId,
      departmentId: userDoc.departmentId,
      isOnLeave: userDoc.isOnLeave,
      isActive: userDoc.isActive,
      mongoUser: userDoc,
      firebaseClaims: decodedToken,
    };

    next();
  } catch (error) {
    console.error(`[AuthMiddleware] Token verification failed: ${error.message}`);

    let statusCode = 401;
    let message = 'Invalid or expired token.';

    if (error.code === 'auth/id-token-expired') {
      message = 'Firebase ID token has expired. Please refresh your session.';
    } else if (error.code === 'auth/argument-error') {
      message = 'Firebase ID token is malformed.';
    }

    return res.status(statusCode).json({
      success: false,
      message,
      error: error.message,
    });
  }
};

/**
 * Optional Auth Middleware:
 * If Bearer token is provided, verifies and sets req.user.
 * If no token is provided, sets req.user = null and proceeds.
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split('Bearer ')[1].trim();

    if (!token || !auth) {
      req.user = null;
      return next();
    }

    const decodedToken = await auth.verifyIdToken(token);

    const userDoc = await User.findOne({ firebaseUid: decodedToken.uid })
      .populate('wardId')
      .populate('departmentId');

    if (userDoc && userDoc.isActive) {
      req.user = {
        uid: decodedToken.uid,
        _id: userDoc._id,
        email: userDoc.email,
        name: userDoc.name,
        displayName: userDoc.name,
        photoURL: userDoc.photoURL,
        role: userDoc.role,
        wardId: userDoc.wardId,
        departmentId: userDoc.departmentId,
        isOnLeave: userDoc.isOnLeave,
        isActive: userDoc.isActive,
        mongoUser: userDoc,
        firebaseClaims: decodedToken,
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.verifyFirebaseToken = authMiddleware;
module.exports.verifyToken = authMiddleware;
module.exports.optionalAuthMiddleware = optionalAuthMiddleware;
