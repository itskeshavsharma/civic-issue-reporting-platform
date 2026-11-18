const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        'SUBMITTED',
        'FORWARDED_TO_WARD',
        'ASSIGNED_TO_FIELD',
        'STARTED_WORK',
        'RESOLVED',
        'CLOSED',
        'REOPENED',
        'RETURNED_UPWARD',
        'REASSIGNED',
        'SLA_BREACHED',
        'ESCALATED_3_STRIKES',
      ],
      required: true,
      index: true,
    },
    performedBy: {
      uid: { type: String, required: true, index: true },
      name: { type: String, required: true },
      role: { type: String, required: true },
    },
    fromUser: {
      uid: { type: String, default: null, index: true },
      name: { type: String, default: null },
      role: { type: String, default: null },
    },
    toUser: {
      uid: { type: String, default: null, index: true },
      name: { type: String, default: null },
      role: { type: String, default: null },
    },
    fromStatus: {
      type: String,
      default: null,
    },
    toStatus: {
      type: String,
      default: null,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

// Indexes for fast officer audit history lookups
AuditLogSchema.index({ 'performedBy.uid': 1, timestamp: -1 });
AuditLogSchema.index({ 'toUser.uid': 1, timestamp: -1 });
AuditLogSchema.index({ 'fromUser.uid': 1, timestamp: -1 });
AuditLogSchema.index({ complaintId: 1, timestamp: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
