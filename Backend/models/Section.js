const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true
  },
  semester: {
    type: Number,
    required: true
  },
  maxStudents: {
    type: Number,
    required: true
  },
  currentStudents: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

SectionSchema.index({ name: 1, batchId: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('Section', SectionSchema);