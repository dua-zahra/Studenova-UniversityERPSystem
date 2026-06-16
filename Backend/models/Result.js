const mongoose = require("mongoose");

const AssessmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  obtainedMarks: { type: Number, required: true, min: 0 },
  totalMarks: { type: Number, required: true, min: 0 },
  weightage: { type: Number, required: true, min: 0, max: 100 }
}, { _id: false });

const StudentResultSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  assessments: [AssessmentSchema],
  obtainedMarks: { type: Number, required: true, min: 0 },
  totalMarks: { type: Number, required: true, min: 0 },
  grade: { type: String, required: true },
  gradePoints: { type: Number, required: true, min: 0, max: 4 },
  status: { type: String, required: true, enum: ['draft', 'completed', 'published'] }
}, { _id: false });

const ResultSchema = new mongoose.Schema({
  courseCode: { type: String, required: true },
  courseName: { type: String, required: true },
  sectionName: { type: String, required: true },
  batchName: { type: String, required: true },
  department: { type: String, required: true },
  semester: { type: Number, required: true, default: 1 },
  totalStudents: { type: Number, required: true, min: 0, default: 0 },
  totalMarks: { type: Number, required: true, min: 0, default: 0 },
  results: [StudentResultSchema]
}, { timestamps: true });

ResultSchema.statics.calculateGradeAndPoints = function(percentage) {
  if (percentage >= 85) return { grade: "A+", gradePoints: 4.0 };
  if (percentage >= 75) return { grade: "A", gradePoints: 4.0 };
  if (percentage >= 65) return { grade: "B", gradePoints: 3.0 };
  if (percentage >= 50) return { grade: "C", gradePoints: 2.0 };
  return { grade: "F", gradePoints: 0.0 };
};

module.exports = mongoose.models.Result || mongoose.model("Result", ResultSchema);
