const mongoose = require('mongoose');

const WardSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ward name is required'],
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Ward code is required'],
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Ward', WardSchema);
