const mongoose = require('mongoose');

const classSectionSchema = new mongoose.Schema({
  department: { type: String, required: true },
  semester: { type: Number, required: true },
  enrollmentYear: { type: Number, required: true },
  section: { type: String, required: true },
  studentCount: { type: Number, default: 0 },
  capacity: { type: Number, default: 20 },
  createdAt: { type: Date, default: Date.now }
});

classSectionSchema.index(
  { department: 1, semester: 1, enrollmentYear: 1, section: 1 },
  { unique: true }
);

module.exports = mongoose.model('ClassSection', classSectionSchema);