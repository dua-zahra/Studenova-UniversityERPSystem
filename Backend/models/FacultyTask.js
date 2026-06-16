const mongoose = require("mongoose");

const facultyTaskSchema = new mongoose.Schema({
  facultyName: { type: String }, 
  courseCode: { type: String },
  courseName: { type: String },
  batchName: { type: String },
  sectionName: { type: String },
  semester: { type: String },
  taskTitle: { type: String },
  taskDescription: { type: String },
  assignmentFile: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("FacultyTask", facultyTaskSchema);
