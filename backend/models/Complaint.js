const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'Firebase User ID (userId) is required'],
      index: true,
    },
    userEmail: {
      type: String,
      required: [true, 'User email is required'],
      trim: true,
      lowercase: true,
    },
    // Array of reporter user IDs (for single or merged duplicate tickets)
    reporterUserIds: {
      type: [String],
      default: [],
    },
    title: {
      en: {
        type: String,
        required: [true, 'English title is required'],
        trim: true,
      },
      hi: {
        type: String,
        required: [true, 'Hindi title is required'],
        trim: true,
      },
    },
    imageUrl: {
      type: String,
      required: [true, 'Complaint image URL is required'],
    },
    boundingBox: {
      type: [Number],
      default: [0, 0, 0, 0], // format: [x1, y1, x2, y2]
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    areaCoveragePct: {
      type: Number,
      default: 0.0,
    },
    reportCount: {
      type: Number,
      default: 1,
    },
    category: {
      type: String,
      default: 'General',
      index: true,
    },
    status: {
      type: String,
      enum: [
        'Submitted',
        'Assigned to Ward',
        'Assigned',
        'In Progress',
        'Resolved',
        'Closed',
        'Reopened',
        // Backwards compatibility aliases
        'Pending',
        'Under Working',
      ],
      default: 'Submitted',
      index: true,
    },
    // Hierarchy Wards & Department Links
    wardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ward',
      default: null,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    // Assigned Hierarchy Personnel
    assignedWardOfficerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedFieldOfficerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    // SLA Deadlines & Breach Tracking
    forwardDeadline: {
      type: Date,
      default: null,
      index: true,
    },
    assignDeadline: {
      type: Date,
      default: null,
      index: true,
    },
    resolutionDeadline: {
      type: Date,
      default: null,
      index: true,
    },
    slaBreached: {
      type: Boolean,
      default: false,
      index: true,
    },
    slaBreachDetails: {
      stage: { type: String, default: null },
      breachedAt: { type: Date, default: null },
    },
    // Upward Returns & 3-Strike Escalation
    returnCount: {
      type: Number,
      default: 0,
      index: true,
    },
    isEscalated: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastReturnReason: {
      type: String,
      default: '',
    },
    returnedBy: {
      uid: { type: String, default: null },
      name: { type: String, default: null },
      role: { type: String, default: null },
      at: { type: Date, default: null },
    },
    // Citizen Reopen Tracking
    reopenCount: {
      type: Number,
      default: 0,
    },
    reopenReason: {
      type: String,
      default: '',
    },
    reopenedAt: {
      type: Date,
      default: null,
    },
    // Recurrent Defect Tracking (When defect reoccurs at a previously closed/resolved location)
    isRecurrent: {
      type: Boolean,
      default: false,
      index: true,
    },
    recurrentFromTicketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      default: null,
    },
    // Array of device FCM tokens for multicast push notifications
    fcmTokens: {
      type: [String],
      default: [],
    },
    // Progressive tracking details for 'In Progress' state
    workInProgress: {
      imageUrl: {
        type: String,
        default: null,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
      officialRemark: {
        type: String,
        default: '',
      },
    },
    // Resolution proof details for 'Resolved' state (Before vs After)
    resolutionProof: {
      imageUrl: {
        type: String,
        default: null,
      },
      resolvedAt: {
        type: Date,
        default: null,
      },
      officialRemark: {
        type: String,
        default: '',
      },
    },
    address: {
      road: { type: String, default: '' },
      suburb: { type: String, default: '' },
      areaName: {
        type: String,
        required: [true, 'Area name is required'],
        index: true,
        trim: true,
      },
      city: {
        type: String,
        required: [true, 'City is required'],
        index: true,
        trim: true,
      },
      state: { type: String, default: '' },
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number], // [Longitude, Latitude] format for GeoJSON
        required: [true, 'Geospatial coordinates [longitude, latitude] are required'],
        validate: {
          validator: function (coords) {
            return (
              Array.isArray(coords) &&
              coords.length === 2 &&
              coords[0] >= -180 &&
              coords[0] <= 180 &&
              coords[1] >= -90 &&
              coords[1] <= 90
            );
          },
          message: 'Coordinates must be [longitude, latitude] within valid geographic limits',
        },
      },
    },
    vectorEmbedding: {
      type: [Number], // 384-dimensional MiniLM embeddings
      select: false, // Excluded from default queries to save network bandwidth
    },
  },
  {
    timestamps: true,
  }
);

// 2dsphere spatial index for geospatial distance querying ($near / $geoWithin)
ComplaintSchema.index({ location: '2dsphere' });

// Compound index on city and areaName for area search
ComplaintSchema.index({ 'address.city': 1, 'address.areaName': 1 });

// Compound indexes for hierarchy queues
ComplaintSchema.index({ wardId: 1, status: 1 });
ComplaintSchema.index({ assignedFieldOfficerId: 1, status: 1 });
ComplaintSchema.index({ isEscalated: 1, createdAt: -1 });
ComplaintSchema.index({ slaBreached: 1, createdAt: -1 });

// Index for user queries and sorting
ComplaintSchema.index({ userId: 1, createdAt: -1 });
ComplaintSchema.index({ reporterUserIds: 1, createdAt: -1 });

module.exports = mongoose.model('Complaint', ComplaintSchema);
