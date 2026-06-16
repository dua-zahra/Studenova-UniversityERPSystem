const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  courseName: { type: String, required: true },
  courseCode: { type: String, required: true },
  creditHrs: { type: Number, required: true },
  type: { type: String, enum: ['Core', 'Elective'], required: true }
});

const SemesterSchema = new mongoose.Schema({
  semesterNumber: { type: Number, required: true },
  courses: [CourseSchema]
});

const CourseEntrySchema = new mongoose.Schema({
  degreeLevel: { type: String, enum: ['Undergraduate', 'Graduate', 'PhD'], required: true },
  department: { type: String, required: true }, 
  semesters: [SemesterSchema]
});

CourseEntrySchema.index({ degreeLevel: 1, department: 1 }, { unique: true });

module.exports = mongoose.models.CourseEntry || mongoose.model('CourseEntry', CourseEntrySchema);
