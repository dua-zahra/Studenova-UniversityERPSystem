const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const StudentAttendance = require("../models/StudentAttendance");
const Batch = require("../models/Batch");
const moment = require("moment");

const saveFacultyAttendance = async (req, res) => {
  try {
    const { courseCode, courseName, batchId, batchName, sectionName, semester, students, date } = req.body;

    if (!students || !Array.isArray(students) || students.length === 0)
      return res.status(400).json({ message: "No students provided" });
    if (!date) return res.status(400).json({ message: "Attendance date is required" });

    let batch = null;
    if (batchId && mongoose.Types.ObjectId.isValid(batchId)) batch = await Batch.findById(batchId);
    if (!batch && batchName) batch = await Batch.findOne({ batchName });
    if (!batch) return res.status(400).json({ message: "Batch not found" });

    const semNum = Number(semester);
    const attendanceDate = new Date(date);


    let attendanceDoc = await Attendance.findOne({
      courseCode,
      batchId: batch._id,
      sectionName,
      semester: semNum,
    });

    if (!attendanceDoc) {
      attendanceDoc = new Attendance({
        courseCode,
        courseName,
        batchId: batch._id,
        sectionName,
        semester: semNum,
        students: [],
      });
    }

    for (const s of students) {
      if (!s.studentId) continue;

      let studentName = s.studentName;
      if (!studentName) {
        const student = await Student.findOne({ studentId: s.studentId });
        studentName = student ? student.fullName : "Unknown";
      }

      let studentRecord = attendanceDoc.students.find(st => st.studentId === s.studentId);
      const record = { date: attendanceDate, status: s.attendance };

      if (!studentRecord) {
        attendanceDoc.students.push({
          studentId: s.studentId,
          studentName,
          attendanceRecords: [record],
          percentage: s.attendance === "Present" ? 100 : 0,
        });
      } else {
        const existing = studentRecord.attendanceRecords.find(r => r.date.toDateString() === attendanceDate.toDateString());
        if (existing) existing.status = s.attendance;
        else studentRecord.attendanceRecords.push(record);

        const total = studentRecord.attendanceRecords.length;
        const present = studentRecord.attendanceRecords.filter(r => r.status === "Present").length;
        studentRecord.percentage = total === 0 ? 0 : parseFloat(((present / total) * 100).toFixed(2));
      }

      let studentAttendance = await StudentAttendance.findOne({ studentId: s.studentId, batchId: batch._id });
      if (!studentAttendance) {
        studentAttendance = new StudentAttendance({
          studentId: s.studentId,
          fullName: studentName,
          department: s.department || "Unknown",
          degreeLevel: s.degreeLevel || "Undergraduate",
          batchId: batch._id,
          semesters: [],
        });
      }

      await studentAttendance.markAttendance(semNum, courseCode, courseName, attendanceDate, s.attendance);

      await Student.findOneAndUpdate(
        { studentId: s.studentId },
        { $set: { lastAttendanceDate: attendanceDate, lastAttendanceStatus: s.attendance } },
        { new: true }
      );
    }

    const savedAttendance = await attendanceDoc.save({ validateBeforeSave: false });
    return res.status(200).json({
      message: "Attendance saved successfully and synced with StudentAttendance & Student model",
      data: savedAttendance,
    });

  } catch (err) {
    console.error("Error saving attendance:", err);
    return res.status(500).json({ message: "Error saving attendance", error: err.message });
  }
};

const updateAttendance = async (req, res) => {
  try {
    const { batchId, semester, courseCode, courseName, sectionName, students } = req.body;
    if (!batchId || !semester || !courseCode || !sectionName || !students || !Array.isArray(students)) {
      return res.status(400).json({ message: "Missing required fields or invalid students data" });
    }

    const semNum = Number(semester);

    let attendanceDoc = await Attendance.findOne({ batchId, semester: semNum, courseCode, sectionName });
    if (!attendanceDoc) {
      attendanceDoc = new Attendance({ batchId, semester: semNum, courseCode, courseName, sectionName, students: [] });
    }

    for (const s of students) {
      if (!s.studentId || !s.attendanceRecords) continue;

      let studentRecord = attendanceDoc.students.find(st => st.studentId === s.studentId);
      if (!studentRecord) {
        studentRecord = { studentId: s.studentId, studentName: s.studentName, attendanceRecords: [], percentage: 0 };
        attendanceDoc.students.push(studentRecord);
      }

      for (const r of s.attendanceRecords) {
        const recordDate = new Date(r.date);
        const existing = studentRecord.attendanceRecords.find(a => new Date(a.date).toDateString() === recordDate.toDateString());
        if (existing) existing.status = r.status;
        else studentRecord.attendanceRecords.push({ date: recordDate, status: r.status });
      }

      const total = studentRecord.attendanceRecords.length;
      const present = studentRecord.attendanceRecords.filter(r => r.status === "Present").length;
      studentRecord.percentage = total === 0 ? 0 : parseFloat(((present / total) * 100).toFixed(2));

      let studentAttendance = await StudentAttendance.findOne({ studentId: s.studentId, batchId });
      if (!studentAttendance) {
        studentAttendance = new StudentAttendance({
          studentId: s.studentId,
          fullName: s.studentName,
          department: s.department || "Unknown",
          degreeLevel: s.degreeLevel || "Undergraduate",
          batchId,
          semesters: [],
        });
      }

      for (const r of s.attendanceRecords) {
        const recordDate = new Date(r.date);
        await studentAttendance.markAttendance(semNum, courseCode, courseName || courseCode, recordDate, r.status);
      }

     
      await Student.findOneAndUpdate(
        { studentId: s.studentId },
        { $set: { lastAttendanceUpdated: new Date() } }
      );
    }

    await attendanceDoc.save({ validateBeforeSave: false });
    return res.status(200).json({ success: true, message: "Attendance updated successfully" });
  } catch (err) {
    console.error("Error updating attendance:", err);
    return res.status(500).json({ message: "Error updating attendance", error: err.message });
  }
};


const getAttendanceByDate = async (req, res) => {
  try {
    const { courseCode, batchId, batchName, sectionName, semester, date } = req.query;

    if (!courseCode || !semester || !date)
      return res.status(400).json({ message: "Missing parameters" });

    let batch = null;
    if (batchId && mongoose.Types.ObjectId.isValid(batchId)) batch = await Batch.findById(batchId);
    if (!batch && batchName) batch = await Batch.findOne({ batchName });
    if (!batch) return res.status(400).json({ message: "Batch not found" });

    const semNum = Number(semester);
    const allStudents = await Student.find({ batch: batch._id, section: sectionName, currentSemester: semNum });

    const attendanceDoc = await Attendance.findOne({ courseCode, batchId: batch._id, sectionName, semester: semNum });

    const studentsWithAttendance = allStudents.map(s => {
      let attendance = "Absent", percentage = 0;
      if (attendanceDoc && Array.isArray(attendanceDoc.students)) {
        const record = attendanceDoc.students.find(st => st.studentId === s.studentId);
        if (record) {
          const dayRecord = record.attendanceRecords.find(r => new Date(r.date).toDateString() === new Date(date).toDateString());
          attendance = dayRecord ? dayRecord.status : "Absent";
          percentage = record.percentage || 0;
        }
      }
      return {
        studentId: s.studentId,
        studentName: s.fullName || "",
        attendance,
        percentage,
        color: percentage <= 65 ? "red" : "green"
      };
    });

    return res.status(200).json({ success: true, students: studentsWithAttendance });
  } catch (err) {
    console.error("Error fetching attendance:", err);
    return res.status(500).json({ message: "Error fetching attendance", error: err.message });
  }
};

const getAttendanceByCourseSection = async (req, res) => {
  try {
    const { batchId, semester, courseCode, sectionName } = req.query;
    if (!batchId || !semester || !courseCode || !sectionName)
      return res.status(400).json({ message: "Missing required parameters" });

    const records = await Attendance.findOne({ batchId, semester, courseCode, sectionName });
    if (!records) return res.status(200).json({ students: [] });

    const students = records.students.map(s => ({
      studentId: s.studentId,
      studentName: s.studentName || "Unknown",
      attendanceRecords: s.attendanceRecords,
      percentage: s.percentage || 0,
    }));

    return res.json({ students });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching attendance data" });
  }
};

module.exports = {
  saveFacultyAttendance,
  updateAttendance,
  getAttendanceByDate,
  getAttendanceByCourseSection,
};
