const mongoose = require("mongoose");
const { Schema } = mongoose;

const attendanceRecordSchema = new Schema({
  date: { type: Date, required: true },
  status: { type: String, enum: ["Present", "Absent", "Late"], default: "Absent" },
}, { _id: false });

const courseAttendanceSchema = new Schema({
  courseCode: { type: String, required: true },
  courseName: { type: String, required: true },
  attendanceRecords: { type: [attendanceRecordSchema], default: [] },
  percentage: { type: Number, default: 0 },
}, { _id: false });

const semesterAttendanceSchema = new Schema({
  semesterNumber: { type: Number, required: true },
  courses: { type: [courseAttendanceSchema], default: [] },
}, { _id: false });

const studentAttendanceSchema = new Schema({
  studentId: { type: String, required: true },
  fullName: { type: String, required: true },
  department: { type: String, required: true },
  degreeLevel: { type: String, enum: ["Undergraduate", "Graduate", "PhD"], required: true },
  batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
  semesters: { type: [semesterAttendanceSchema], default: [] },
}, { timestamps: true });

studentAttendanceSchema.methods.markAttendance = async function(semesterNumber, courseCode, courseName, date, status) {
  semesterNumber = Number(semesterNumber);
  date = new Date(date);

  let semester = this.semesters.find(s => s.semesterNumber === semesterNumber);
  if (!semester) {
    semester = { semesterNumber, courses: [] };
    this.semesters.push(semester);
  }

  let course = semester.courses.find(c => c.courseCode === courseCode);
  if (!course) {
    course = { courseCode, courseName, attendanceRecords: [], percentage: 0 };
    semester.courses.push(course);
  }

  let existingRecord = course.attendanceRecords.find(r => r.date.toDateString() === date.toDateString());
  if (existingRecord) {
    existingRecord.status = status; 
  } else {
    course.attendanceRecords.push({ date, status }); 
  }

  const total = course.attendanceRecords.length;
  const present = course.attendanceRecords.filter(r => r.status === "Present").length;
  course.percentage = total === 0 ? 0 : parseFloat(((present / total) * 100).toFixed(2));

  this.markModified("semesters"); 
  await this.save();
};

module.exports = mongoose.models.StudentAttendance || mongoose.model("StudentAttendance", studentAttendanceSchema);
