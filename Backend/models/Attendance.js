const mongoose = require("mongoose");

const attendanceRecordSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    status: { type: String, enum: ["Present", "Absent", "Late"], default: "Absent" },
  },
  { _id: false }
);

const studentAttendanceSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  attendanceRecords: { type: [attendanceRecordSchema], default: [] },
  percentage: { type: Number, default: 0 },
});

const facultyAttendanceSchema = new mongoose.Schema(
  {
    courseCode: { type: String, required: true },
    courseName: { type: String },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true },
    sectionName: { type: String, required: true },
    semester: { type: Number, required: true },
    students: { type: [studentAttendanceSchema], default: [] },
  },
  { timestamps: true }
);


 
facultyAttendanceSchema.methods.saveAttendance = async function(date, studentsData) {
  const attendanceDate = new Date(date);

  for (const s of studentsData) {
    if (!s.studentId) continue;

    let student = this.students.find(st => st.studentId === s.studentId);
    if (!student) {
      student = {
        studentId: s.studentId,
        studentName: s.studentName || s.studentId,
        attendanceRecords: [],
        percentage: 0,
      };
      this.students.push(student);
    }

    student.attendanceRecords = student.attendanceRecords.filter(
      r => r.date.toDateString() !== attendanceDate.toDateString()
    );

    student.attendanceRecords.push({
      date: attendanceDate,
      status: s.attendance || "Absent",
    });

    const total = student.attendanceRecords.length;
    const presentCount = student.attendanceRecords.filter(r => r.status === "Present").length;
    student.percentage = total === 0 ? 0 : parseFloat(((presentCount / total) * 100).toFixed(2));
  }

  this.markModified("students");
  return this.save();
};

module.exports = mongoose.model("FacultyAttendance", facultyAttendanceSchema);
