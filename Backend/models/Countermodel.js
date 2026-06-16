const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  degreeLevel: { type: String, required: true },
  enrollmentYear: { type: Number, required: true },
  seq: { type: Number, default: 0 }
});

counterSchema.index({ degreeLevel: 1, enrollmentYear: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);
