const mongoose = require('mongoose');
require('./Ward');
require('./Department');

const UserSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: [true, 'Firebase UID is required'],
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    photoURL: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['super_admin', 'managing_officer', 'ward_officer', 'field_officer', 'citizen'],
      default: 'citizen',
      index: true,
    },
    // Linked Ward (for ward_officer and field_officer)
    wardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ward',
      default: null,
      index: true,
    },
    // Linked Department (for field_officer)
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    // Leave status toggle (for operational officers)
    isOnLeave: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Soft-delete / account revocation status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: String, // firebaseUid of superior officer
      default: null,
    },
    fcmToken: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for hierarchy queries
UserSchema.index({ role: 1, wardId: 1, isActive: 1 });
UserSchema.index({ role: 1, departmentId: 1, isActive: 1 });

module.exports = mongoose.model('User', UserSchema);
