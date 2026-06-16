const mongoose = require("mongoose");
const Student = require("../models/Student"); 

const AssessmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  obtainedMarks: { type: Number, required: true, min: 0 },
  totalMarks: { type: Number, required: true, min: 0 },
  weightage: { type: Number, required: true, min: 0, max: 100 }
}, { _id: false });

const CourseResultSchema = new mongoose.Schema({
  courseCode: { type: String, required: true },
  courseName: { type: String, required: true },
  semester: { type: Number, required: true },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty" },
  assessments: [AssessmentSchema],
  obtainedMarks: { type: Number, required: true, min: 0 },
  totalMarks: { type: Number, required: true, min: 0 },
  percentage: { type: Number, required: true, min: 0, max: 100 },
  grade: { type: String, required: true, enum: ['A','B','C','D','F'] },
  gradePoints: { type: Number, required: true, min: 0, max: 4 },
  status: { type: String, required: true, enum: ['draft','completed','published'] },
  batchName: { type: String, required: true },
  sectionName: { type: String, required: true }
}, { _id: false });

const SemesterResultSchema = new mongoose.Schema({
  semesterNumber: { type: Number, required: true },
  courses: [CourseResultSchema]
}, { _id: false });

const StudentResultsSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  studentName: { type: String, required: true },
  universityEmail: { type: String, required: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true },
  batchName: { type: String, required: true },
  degreeLevel: { type: String, required: true },
  department: { type: String, required: true },
  section: { type: String },
  currentSemester: { type: Number, required: true },
  academicProgress: [SemesterResultSchema]
}, { timestamps: true });

/**
 * Helper: Calculate grade and points
 * @param {Number} percentage
 * @returns {Object} { grade, gradePoints }
 */
StudentResultsSchema.statics.calculateGradeAndPoints = function(percentage) {
  if (percentage >= 85) return { grade: "A", gradePoints: 4.0 };
  if (percentage >= 75) return { grade: "B", gradePoints: 3.0 };
  if (percentage >= 65) return { grade: "C", gradePoints: 2.0 };
  if (percentage >= 50) return { grade: "D", gradePoints: 1.0 };
  return { grade: "F", gradePoints: 0.0 };
};

/**
 * Static method: Get batchId safely from Student model
 * @param {String} studentId
 * @returns {ObjectId|null}
 */
StudentResultsSchema.statics.getBatchIdForStudent = async function(studentId) {
  const student = await Student.findOne({ studentId });
  return student ? student.batchId || null : null;
};

module.exports = mongoose.models.StudentResults || mongoose.model("StudentResults", StudentResultsSchema);
