const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');
const Student = require('../models/Student');
const studentFee = require('../models/StudentFee');
const TimeTable = require('../models/Timetable');
const StudentAttendances = require('../models/StudentAttendance');
const StudentResult = require('../models/StudentResults');
const Results = require('../models/Result');
const Batch = require('../models/Batch');
const Department = require('../models/Department');
const CourseEntry = require('../models/CourseEntry');
const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const FacultyTask = require("../models/FacultyTask"); 
const Result = require("../models/Result");
const UniversityExpenses = require('../models/UniversityExpense'); 
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { addDays, isAfter } = require('date-fns');

const cleanupUploads = (files) => {
  if (!files) return;
  Object.values(files).forEach(fileArray => {
    fileArray.forEach(file => {
      if (fs.existsSync(file.path)) {
        fs.unlink(file.path, err => {
          if (err) console.error('File cleanup error:', err);
        });
      }
    });
  });
};

const generateStudentSequence = async (depCode, yearShort, session) => {
  const regex = new RegExp(`^${depCode}-${yearShort}-(\\d{3})$`);
  const students = await Student.find({ username: { $regex: regex } }).session(session);

  let maxSeq = 0;
  students.forEach(stu => {
    const match = stu.username.match(regex);
    if (match) {
      const seqNum = parseInt(match[1], 10);
      if (seqNum > maxSeq) maxSeq = seqNum;
    }
  });

  return (maxSeq + 1).toString().padStart(3, '0');
};

const autoGenerateStudentFeeRecord = async (student, session) => {
  try {
    console.log(' AUTOMATICALLY generating fee record for new student:', student.studentId);

    const batch = await Batch.findById(student.batch).session(session);
    if (!batch) {
      console.log(' Batch not found for student:', student.studentId);
      return null;
    }

    const feeStructure = await FeeStructure.findOne({
      degreeLevel: student.degreeLevel,
      department: student.department,
      batch: batch.batchName,
      isActive: true
    }).session(session);

    if (!feeStructure) {
      console.log(' No active fee structure found for batch:', batch.batchName);
      return null;
    }

    console.log(' Found fee structure for batch:', feeStructure.batch);

    const scholarshipPercentage = student.scholarshipPercentage || 0;
    console.log(` Student ${student.studentId} scholarship: ${scholarshipPercentage}%`);

    const semesterFees = [];

    for (const semesterData of feeStructure.semesterBreakdown) {
      console.log(` Processing semester ${semesterData.semester} for student ${student.studentId}`);

      let semesterBaseFee = 0;
      let semesterFeeConfig = feeStructure.masterBaseFee;

      if (feeStructure.semesterBaseFees && feeStructure.semesterBaseFees.get(semesterData.semester.toString())) {
        semesterFeeConfig = feeStructure.semesterBaseFees.get(semesterData.semester.toString());
        semesterBaseFee = semesterFeeConfig.totalBaseFee;
        console.log(` Using CUSTOM fees for semester ${semesterData.semester}: Rs. ${semesterBaseFee}`);
      } else {
        semesterBaseFee = feeStructure.masterBaseFee.totalBaseFee;
        console.log(`Using MASTER fees for semester ${semesterData.semester}: Rs. ${semesterBaseFee}`);
      }

      const originalCourseFee = semesterData.courseFee;
      const originalSemesterTotal = semesterBaseFee + originalCourseFee;

      const tuitionPortion = semesterFeeConfig.tuitionFee;
      const miscellaneousPortion = semesterFeeConfig.miscellaneousFee;
      const fixedFees = semesterFeeConfig.examFee +
        semesterFeeConfig.libraryFee +
        semesterFeeConfig.labFee;

      const discountedTuition = Math.round(tuitionPortion * (1 - scholarshipPercentage / 100));
      const discountedCourseFee = Math.round(originalCourseFee * (1 - scholarshipPercentage / 100));

      const discountedBaseFee = discountedTuition + miscellaneousPortion + fixedFees;
      const totalDiscountedFee = discountedBaseFee + discountedCourseFee;
      const scholarshipDiscount = originalSemesterTotal - totalDiscountedFee;

      console.log(`💰 Semester ${semesterData.semester} calculations:`, {
        semesterBaseFee,
        originalCourseFee,
        originalSemesterTotal,
        tuitionPortion,
        miscellaneousPortion,
        fixedFees,
        discountedTuition,
        discountedCourseFee,
        discountedBaseFee,
        totalDiscountedFee,
        scholarshipDiscount
      });

      const academicSemester = batch.academicCalendar?.find(s => s.semester === semesterData.semester);

      let installments = [];
      if (academicSemester && academicSemester.midtermStart && academicSemester.finalStart) {
        const firstInstallmentDueDate = addDays(new Date(academicSemester.midtermStart), -21);
        const secondInstallmentDueDate = addDays(new Date(academicSemester.finalStart), -28);

        const installmentAmount = Math.round(totalDiscountedFee / 2);

        installments = [
          {
            installmentNumber: 1,
            amount: installmentAmount,
            dueDate: firstInstallmentDueDate,
            status: 'pending',
            fineAmount: 0,
            daysOverdue: 0
          },
          {
            installmentNumber: 2,
            amount: installmentAmount,
            dueDate: secondInstallmentDueDate,
            status: 'pending',
            fineAmount: 0,
            daysOverdue: 0
          }
        ];
      }

      const isCustomFee = feeStructure.semesterBaseFees &&
        feeStructure.semesterBaseFees.get(semesterData.semester.toString());

      semesterFees.push({
        semester: semesterData.semester,
        originalBaseFee: semesterBaseFee,
        originalCourseFee: originalCourseFee,
        originalTotalFee: originalSemesterTotal,
        tuitionFee: discountedTuition,
        courseFees: discountedCourseFee,
        fixedFees: fixedFees,
        totalFee: totalDiscountedFee,
        scholarshipDiscount: scholarshipDiscount,
        discountedFee: totalDiscountedFee,
        installments: installments,
        isCustomFee: !!isCustomFee,
        feeStructureVersion: feeStructure.updatedAt
      });
    }

    console.log(` Generated ${semesterFees.length} semester fees for student ${student.studentId}`);

    const totalDegreeFee = semesterFees.reduce((sum, sf) => sum + sf.totalFee, 0);

    const studentFee = new StudentFee({
      studentId: student.studentId,
      degreeLevel: student.degreeLevel,
      department: student.department,
      batch: batch.batchName,
      currentSemester: student.currentSemester,
      scholarshipPercentage: scholarshipPercentage,
      semesterFees: semesterFees,
      totalDegreeFee: totalDegreeFee,
      totalPaid: 0,
      totalDue: totalDegreeFee,
      status: 'active',
      feeStructureVersion: feeStructure.updatedAt
    });

    await studentFee.save({ session });
    console.log(` AUTOMATICALLY CREATED fee record for student ${student.studentId} (Total: Rs. ${totalDegreeFee})`);

    return studentFee;
  } catch (error) {
    console.error(` Error automatically generating fee for student ${student.studentId}:`, error);
    return null;
  }
};

exports.getStudentExpenses = async (req, res) => {
    try {
        const studentId = req.session?.user?.studentId; 

        if (!studentId) {
            return res.status(400).json({ message: "Student ID not found in session" });
        }

        const expenses = await UniversityExpenses.findOne({ studentId });

        if (!expenses) {
            return res.status(404).json({ message: "Expenses not found for this student" });
        }

        return res.status(200).json(expenses);
    } catch (error) {
        console.error("Error fetching student expenses:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};

exports.getStudentTasks = async (req, res) => {
  try {
    const studentId = req.session?.user?.id;

    if (!studentId) {
      return res.status(400).json({ message: "Student ID missing in session" });
    }

    const student = await Student.findById(studentId).lean();
    if (!student) return res.status(404).json({ message: "Student not found" });

    const batchId = student.batch;
    const sectionName = student.section;
    const currentSemester = student.currentSemester;

    const batch = await Batch.findById(batchId).lean();
    if (!batch) return res.status(404).json({ message: "Batch not found" });

    const batchName = batch.batchName;

    const courseEntry = await CourseEntry.findOne({
      degreeLevel: student.degreeLevel,
      department: student.department
    }).lean();

    if (!courseEntry) {
      return res.status(404).json({
        message: `No course entry found for degreeLevel: ${student.degreeLevel}, department: ${student.department}`
      });
    }

    if (!courseEntry.semesters || !Array.isArray(courseEntry.semesters)) {
      return res.status(404).json({ message: "No semesters found in course entry" });
    }

    const semesterObj = courseEntry.semesters.find(
      (s) => s.semesterNumber === currentSemester
    );

    if (!semesterObj) {
      return res.status(404).json({ message: `Semester ${currentSemester} courses not found` });
    }

    const courseCodes = semesterObj.courses.map((c) => c.courseCode);

    const tasks = await FacultyTask.find({
      batchName,
      sectionName,
      semester: currentSemester.toString(),
      courseCode: { $in: courseCodes }
    }).lean();

    return res.json({
      success: true,
      total: tasks.length,
      tasks
    });
  } catch (error) {
    console.error("Error in getStudentTasks:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getStudentFee = async (req, res) => {
  try {
    const studentId = req.session?.user?.id;

    if (!studentId) {
      return res.status(400).json({ message: "Student ID is required in session" });
    }

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const studentFee = await StudentFee.findOne({ studentId: student.studentId });

    if (!studentFee) {
      return res.status(200).json({ studentId: student.studentId, semesterFees: [] });
    }

    const semesterFeesArray = studentFee.semesterFees || [];
    const invoicesArray = studentFee.invoices || [];

    const allSemesterFees = semesterFeesArray.map((sem) => ({
      semester: sem.semester,
      originalBaseFee: parseFloat(sem.originalBaseFee || 0).toFixed(2),
      originalCourseFee: parseFloat(sem.originalCourseFee || 0).toFixed(2),
      originalTotalFee: parseFloat(sem.originalTotalFee || 0).toFixed(2),
      tuitionFee: parseFloat(sem.tuitionFee || 0).toFixed(2),
      courseFees: parseFloat(sem.courseFees || 0).toFixed(2),
      fixedFees: parseFloat(sem.fixedFees || 0).toFixed(2),
      totalFee: parseFloat(sem.totalFee || 0).toFixed(2),
      scholarshipDiscount: parseFloat(sem.scholarshipDiscount || 0).toFixed(2),
      discountedFee: parseFloat(sem.discountedFee || 0).toFixed(2),
      totalFineAmount: parseFloat(sem.totalFineAmount || 0).toFixed(2),
      finePaid: parseFloat(sem.finePaid || 0).toFixed(2),
      fineDue: parseFloat(sem.fineDue || 0).toFixed(2),
      totalReadmissionFee: parseFloat(sem.totalReadmissionFee || 0).toFixed(2),
      readmissionFeePaid: parseFloat(sem.readmissionFeePaid || 0).toFixed(2),
      readmissionFeeDue: parseFloat(sem.readmissionFeeDue || 0).toFixed(2),
      currentPayableAmount: parseFloat(sem.currentPayableAmount || 0).toFixed(2),
      status: sem.status || "pending",
      installments: (sem.installments || []).map((inst) => ({
        installmentNumber: inst.installmentNumber,
        amount: parseFloat(inst.amount || 0).toFixed(2),
        amountPaid: parseFloat(inst.amountPaid || 0).toFixed(2),
        dueDate: inst.dueDate || null,
        paidDate: inst.paidDate || null,
        status: inst.status || "pending",
        fineAmount: parseFloat(inst.fineAmount || 0).toFixed(2),
        finePaid: inst.finePaid || false,
        readmissionFee: parseFloat(inst.readmissionFee || 0).toFixed(2),
        readmissionFeePaid: inst.readmissionFeePaid || false,
        invoiceNumber: inst.invoiceNumber || null,
        invoiceGenerated: inst.invoiceGenerated || false,
      })),
      invoices: invoicesArray
        .filter((inv) => inv.semester === sem.semester)
        .map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          installmentNumber: inv.installmentNumber,
          description: inv.description,
          amount: parseFloat(inv.amount || 0).toFixed(2),
          dueDate: inv.dueDate || null,
          fineAmount: parseFloat(inv.fineAmount || 0).toFixed(2),
          readmissionFee: parseFloat(inv.readmissionFee || 0).toFixed(2),
          totalAmount: parseFloat(inv.totalAmount || 0).toFixed(2),
          paymentStatus: inv.paymentStatus || "pending",
          invoiceStatus: inv.invoiceStatus || "not generated",
          generatedAt: inv.generatedAt || null,
          paidAt: inv.paidAt || null,
          isActive: inv.isActive || true,
        })),
    }));

    res.status(200).json({
      studentId: student.studentId,
      studentName: student.studentName,
      currentSemester: student.currentSemester || 1,
      department: student.department || "",
      degreeLevel: student.degreeLevel || "",
      totalDegreeFee: parseFloat(studentFee.totalDegreeFee || 0).toFixed(2),
      totalPaid: parseFloat(studentFee.totalPaid || 0).toFixed(2),
      totalDue: parseFloat(studentFee.totalDue || 0).toFixed(2),
      totalFineAmount: parseFloat(studentFee.totalFineAmount || 0).toFixed(2),
      totalFinePaid: parseFloat(studentFee.totalFinePaid || 0).toFixed(2),
      totalFineDue: parseFloat(studentFee.totalFineDue || 0).toFixed(2),
      totalReadmissionFee: parseFloat(studentFee.totalReadmissionFee || 0).toFixed(2),
      totalReadmissionFeePaid: parseFloat(studentFee.totalReadmissionFeePaid || 0).toFixed(2),
      totalReadmissionFeeDue: parseFloat(studentFee.totalReadmissionFeeDue || 0).toFixed(2),
      totalPayableAmount: parseFloat(studentFee.totalPayableAmount || 0).toFixed(2),
      totalAmountPaid: parseFloat(studentFee.totalAmountPaid || 0).toFixed(2),
      totalAmountDue: parseFloat(studentFee.totalAmountDue || 0).toFixed(2),
      feeStructureVersion: studentFee.feeStructureVersion || null,
      status: studentFee.status || "pending",
      semesterFees: allSemesterFees,
    });
  } catch (error) {
    console.error("Error in getStudentFee:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getStudentResults = async (req, res) => {
  try {
    const studentId = req.session?.user?.id;
    if (!studentId)
      return res.status(400).json({ message: "Student ID missing in session" });

    
    const student = await Student.findById(studentId);
    if (!student)
      return res.status(404).json({ message: "Student not found" });

    const currentResultDoc = await Result.findOne({
      "results.studentId": student.studentId,
    });

    let currentSemesterResult = null;

    if (currentResultDoc) {
    
      const studentResult = currentResultDoc.results.find(
        (r) => r.studentId.trim() === student.studentId.trim()
      );

      if (studentResult) {
        currentSemesterResult = {
          courseCode: currentResultDoc.courseCode,
          courseName: currentResultDoc.courseName,
          sectionName: currentResultDoc.sectionName,
          batchName: currentResultDoc.batchName,
          department: currentResultDoc.department,
          totalStudents: currentResultDoc.totalStudents,
          totalMarks: currentResultDoc.totalMarks,
          createdAt: currentResultDoc.createdAt,
          updatedAt: currentResultDoc.updatedAt,
          status: studentResult.status,
          grade: studentResult.grade,
          gradePoints: studentResult.gradePoints,
          percentage:
            studentResult.obtainedMarks && studentResult.totalMarks
              ? ((studentResult.obtainedMarks / studentResult.totalMarks) * 100).toFixed(2)
              : 0,
          obtainedMarks: studentResult.obtainedMarks,
          assessments: (studentResult.assessments || []).map((a) => ({
            name: a.name,
            obtainedMarks: a.obtainedMarks,
            totalMarks: a.totalMarks,
            weightage: a.weightage,
            grade: a.grade,
            gradePoints: a.gradePoints,
            status: a.status,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
          })),
        };
      }
    }

    // -------------------------------
    // 2. Previous semesters from 'StudentResults'
    // -------------------------------
    const previousResultsDoc = await StudentResult.findOne({ studentId: student.studentId });
    let previousSemesters = [];

    if (previousResultsDoc) {
      previousSemesters = (previousResultsDoc.academicProgress || []).map((sem) => ({
        semesterNumber: sem.semesterNumber,
        courses: (sem.courses || []).map((course) => ({
          courseCode: course.courseCode,
          courseName: course.courseName,
          sectionName: course.sectionName || "-",
          batchName: previousResultsDoc.batchName || "-",
          status: course.status,
          grade: course.grade,
          gradePoints: course.gradePoints,
          percentage:
            course.obtainedMarks && course.totalMarks
              ? ((course.obtainedMarks / course.totalMarks) * 100).toFixed(2)
              : 0,
          obtainedMarks: course.obtainedMarks,
          totalMarks: course.totalMarks,
          assessments: (course.assessments || []).map((a) => ({
            name: a.name,
            obtainedMarks: a.obtainedMarks,
            totalMarks: a.totalMarks,
            weightage: a.weightage,
            grade: a.grade,
            gradePoints: a.gradePoints,
            status: a.status,
          })),
        })),
      }));
      // Sort by semester ascending
      previousSemesters.sort((a, b) => a.semesterNumber - b.semesterNumber);
    }

    // -------------------------------
    // 3. Build final response
    // -------------------------------
    const response = {
      studentId: student.studentId,
      studentName: student.studentName,
      universityEmail: student.universityEmail,
      batchId: student.batchId,
      degreeLevel: student.degreeLevel,
      department: student.department,
      currentSemesterResult,
      previousSemestersData: previousSemesters,
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error("Error fetching student results:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getTimeTable = async (req, res) => {
  try {
    const studentId = req.session?.user?.id;

    if (!studentId) {
      return res.status(400).json({ message: "Student ID is required in session" });
    }

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const academicProgress = student.academicProgress || [];
    const currentSemester = academicProgress.length
      ? Math.max(...academicProgress.map((s) => s.semesterNumber))
      : student.currentSemester || 1;

    const timetable = await TimeTable.findOne({
      semester: currentSemester,
      isActive: true,
    });

    if (!timetable) {
      return res.status(404).json({
        message: "No timetable found for your semester & batch",
      });
    }

    const formattedSlots = timetable.timeSlots.map((slot) => ({
      id: slot._id,
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      courseCode: slot.courseCode,
      courseName: slot.courseName,
      sectionName: slot.sectionName,
      classType: slot.classType,
      room: slot.room,
      facultyName: slot.facultyName,
      facultyId: slot.facultyId,
      lastFacultySync: slot.lastFacultySync,
      isActive: slot.isActive,
    }));

    return res.status(200).json({
      studentId: student.studentId,
      studentName: student.studentName,
      department: student.department,
      degreeLevel: student.degreeLevel,
      batchId: student.batchId,
      semester: currentSemester,

      meta: {
        timetableName: timetable.timetableName,
        academicYear: timetable.academicYear,
        description: timetable.description,
        department: timetable.department,
        degreeLevel: timetable.degreeLevel,
        semester: timetable.semester,
      },

      timeSlots: formattedSlots,
    });
  } catch (err) {
    console.error("Error fetching timetable:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getStudentAttendance = async (req, res) => {
  try {
    var studentId = req.session.user.id;

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const academic = student.academicProgress;
    if (!academic) return res.status(400).json({ message: "Academic progress not found" });

    const currentSemesterNumber = academic.currentSemester;

    const attendanceDoc = await StudentAttendances.findOne({
      studentId: student.studentId  
    });
    if (!attendanceDoc) return res.status(404).json({ message: "Attendance not found" });

    const semesterAttendance = attendanceDoc.semesters.find(
      s => s.semesterNumber === currentSemesterNumber
    );

    if (!semesterAttendance) return res.status(404).json({ message: "Current semester attendance not found" });

    const response = {
      studentId: studentId,
      currentSemester: currentSemesterNumber,
      courses: semesterAttendance.courses.map(course => ({
        courseCode: course.courseCode,
        courseName: course.courseName,
        attendanceRecords: course.attendanceRecords || [],
        percentage: course.percentage || 0
      }))
    };
    return res.status(200).json(response);

  } catch (err) {
    console.error("Error fetching student attendance:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.session?.user?.id || req.user?.id || req.params?.id;
    if (!studentId) {
      return res.status(400).json({ message: 'Student id not found in session or request' });
    }

    let student;
    try {
      student = await Student.findById(studentId)
        .populate('academicProgress.semesters.courses.course')
        .lean();
    } catch (popErr) {
      student = await Student.findById(studentId).lean();
    }

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const studentInfo = {
      _id: student._id,
      studentId: student.studentId || student.username,
      username: student.username,
      universityEmail: student.universityEmail,
      name: {
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName || ''} ${student.lastName || ''}`.trim()
      },
      contactNumber: student.contactNumber,
      personalEmail: student.personalEmail,
      department: student.department,
      departmentCode: student.departmentCode,
      batch: student.batch,
      section: student.section,
      degreeLevel: student.degreeLevel,
      studyMode: student.studyMode,
      admissionType: student.admissionType,
      scholarship: {
        isApplicant: !!student.isScholarshipApplicant,
        percentage: student.scholarshipPercentage || 0
      },
      status: student.status,
      role: student.role,
      photoPath: student.photoPath,
      address: {
        address: student.address,
        city: student.city,
        province: student.province,
        country: student.country,
        postalCode: student.postalCode
      },
      createdAt: student.createdAt,
      updatedAt: student.updatedAt
    };

    const academic = student.academicProgress || {};
    const currentSemesterNumber = academic.currentSemester || student.currentSemester || 1;

    const currentSemObj = (academic.semesters || []).find(
      (s) => Number(s.semesterNumber) === Number(currentSemesterNumber)
    );

    const courses = (currentSemObj?.courses || []).map((c) => {
      const courseDoc = c.course && typeof c.course === 'object' ? c.course : null;

      return {
        courseId: courseDoc?._id || c.course,
        courseCode: c.courseCode || courseDoc?.courseCode || null,
        courseName: c.courseName || courseDoc?.courseName || courseDoc?.title || null,
        semesterTaken: c.semesterTaken,
        status: c.status,
        grade: c.grade,
        creditsEarned: c.creditsEarned,
        attendance: c.attendance
      };
    });

    const allSemesters = (academic.semesters || []).map((s) => ({
      semesterNumber: s.semesterNumber,
      status: s.status,
      startDate: s.startDate,
      endDate: s.endDate,
      semesterGPA: s.semesterGPA,
      creditsAttempted: s.creditsAttempted,
      creditsEarned: s.creditsEarned || s.creditsEarned,
      qualityPoints: s.qualityPoints,
      courses: (s.courses || []).map((c) => ({
        courseId: c.course && typeof c.course === 'object' ? c.course._id : c.course,
        courseCode: c.courseCode,
        courseName: c.courseName,
        status: c.status,
        grade: c.grade,
        creditsEarned: c.creditsEarned,
        attendance: c.attendance
      }))
    }));

    const response = {
      student: studentInfo,
      academicProgress: {
        currentSemester: currentSemesterNumber,
        totalCreditsEarned: academic.totalCreditsEarned || student.totalCreditsEarned || 0,
        totalCreditsRequired: academic.totalCreditsRequired || student.totalCreditsRequired || 0,
        cumulativeGPA: academic.cumulativeGPA || student.cumulativeGPA || 0,
        completionPercentage: academic.completionPercentage || student.completionPercentage || 0,
        totalQualityPoints: academic.totalQualityPoints || student.totalQualityPoints || 0,
        currentSemesterDetails: currentSemObj
          ? {
              semesterNumber: currentSemObj.semesterNumber,
              semesterGPA: currentSemObj.semesterGPA || 0,
              creditsAttempted: currentSemObj.creditsAttempted || 0,
              creditsEarned: currentSemObj.creditsEarned || 0,
              qualityPoints: currentSemObj.qualityPoints || 0,
              startDate: currentSemObj.startDate,
              endDate: currentSemObj.endDate,
              courses 
            }
          : {
              message: 'Current semester record not found',
              courses: []
            },
        allSemesters
      },
      meta: {
        fetchedAt: new Date()
      }
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error('Error in getStudentDashboard:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.enrollStudent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const formData = req.body;
    const files = req.files;

    let matricQualification = {};
    let intermediateQualification = {};

    try {
      matricQualification = JSON.parse(formData.matricQualification || '{}');
      intermediateQualification = JSON.parse(formData.intermediateQualification || '{}');

      const requiredMatricFields = {
        institution: 'Institution name',
        year: 'Year of completion',
        totalMarks: 'Total marks',
        obtainedMarks: 'Obtained marks',
        boardUniversity: 'Board/University'
      };

      const missingMatricFields = Object.entries(requiredMatricFields)
        .filter(([field]) => !matricQualification[field] || matricQualification[field].toString().trim() === '')
        .map(([_, name]) => name);

      if (missingMatricFields.length > 0) {
        throw new Error(`Matric: Missing ${missingMatricFields.join(', ')}`);
      }

      const requiredIntermediateFields = {
        institution: 'Institution name',
        year: 'Year of completion',
        totalMarks: 'Total marks',
        obtainedMarks: 'Obtained marks',
        boardUniversity: 'Board/University'
      };

      const missingIntermediateFields = Object.entries(requiredIntermediateFields)
        .filter(([field]) => !intermediateQualification[field] || intermediateQualification[field].toString().trim() === '')
        .map(([_, name]) => name);

      if (missingIntermediateFields.length > 0) {
        throw new Error(`Intermediate: Missing ${missingIntermediateFields.join(', ')}`);
      }

      matricQualification.totalMarks = Number(matricQualification.totalMarks);
      matricQualification.obtainedMarks = Number(matricQualification.obtainedMarks);
      intermediateQualification.totalMarks = Number(intermediateQualification.totalMarks);
      intermediateQualification.obtainedMarks = Number(intermediateQualification.obtainedMarks);

      if (isNaN(matricQualification.totalMarks) || isNaN(matricQualification.obtainedMarks) ||
        isNaN(intermediateQualification.totalMarks) || isNaN(intermediateQualification.obtainedMarks)) {
        throw new Error('Marks must be valid numbers');
      }

      if (matricQualification.obtainedMarks > matricQualification.totalMarks ||
        intermediateQualification.obtainedMarks > intermediateQualification.totalMarks) {
        throw new Error('Obtained marks cannot exceed total marks');
      }

    } catch (err) {
      cleanupUploads(files);
      return res.status(400).json({
        success: false,
        message: err.message || 'Invalid qualification data',
        errorType: 'qualification_validation'
      });
    }

    const requiredFields = {
      firstName: 'First name',
      lastName: 'Last name',
      fatherFirstName: "Father's first name",
      fatherLastName: "Father's last name",
      gender: 'Gender',
      cnic: 'CNIC',
      birthDate: 'Date of birth',
      personalEmail: 'Personal email',
      contactNumber: 'Contact number',
      emergencyContact: 'Emergency contact',
      address: 'Address',
      city: 'City',
      province: 'Province',
      degreeLevel: 'Degree level',
      department: 'Department',
      batch: 'Batch',
      currentSemester: 'Current semester'
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([field]) => !formData[field] || formData[field].toString().trim() === '')
      .map(([_, name]) => name);

    if (missingFields.length > 0) {
      cleanupUploads(files);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        errorType: 'missing_fields'
      });
    }

    const cleanedCNIC = formData.cnic.replace(/-/g, '');
    if (!/^\d{13}$/.test(cleanedCNIC)) {
      cleanupUploads(files);
      return res.status(400).json({
        success: false,
        message: 'CNIC must be 13 digits without dashes',
        errorType: 'invalid_cnic'
      });
    }

    if (!validator.isEmail(formData.personalEmail)) {
      cleanupUploads(files);
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
        errorType: 'invalid_email'
      });
    }

    const phoneRegex = /^\d{11}$/;
    if (!phoneRegex.test(formData.contactNumber) || !phoneRegex.test(formData.emergencyContact)) {
      cleanupUploads(files);
      return res.status(400).json({
        success: false,
        message: 'Contact numbers must be 11 digits',
        errorType: 'invalid_phone'
      });
    }

    const requiredDocuments = {
      photo: 'Student photo',
      domicile: 'Domicile certificate',
      matricDocument: 'Matriculation certificate',
      intermediateDocument: 'Intermediate certificate'
    };

    const missingDocuments = Object.entries(requiredDocuments)
      .filter(([key]) => !files?.[key]?.[0])
      .map(([_, docName]) => docName);

    if (missingDocuments.length > 0) {
      cleanupUploads(files);
      return res.status(400).json({
        success: false,
        message: `Missing required documents: ${missingDocuments.join(', ')}`,
        errorType: 'missing_documents'
      });
    }

    const department = await Department.findOne({
      departmentName: formData.department,
      degreeLevel: formData.degreeLevel
    }).session(session);

    if (!department) {
      cleanupUploads(files);
      return res.status(400).json({
        success: false,
        message: 'Department not found for selected degree level',
        errorType: 'invalid_department'
      });
    }

    const batch = await Batch.findById(formData.batch).session(session);
    if (!batch) {
      cleanupUploads(files);
      return res.status(400).json({
        success: false,
        message: 'Batch not found',
        errorType: 'invalid_batch'
      });
    }

    if (batch.enrollmentStatus !== 'open') {
      cleanupUploads(files);
      return res.status(400).json({
        success: false,
        message: 'Batch enrollment is closed',
        errorType: 'closed_batch'
      });
    }

    const currentSemester = parseInt(formData.currentSemester, 10);
    if (isNaN(currentSemester) || currentSemester < 1 || currentSemester > batch.totalSemesters) {
      cleanupUploads(files);
      return res.status(400).json({
        success: false,
        message: `Semester must be between 1 and ${batch.totalSemesters}`,
        errorType: 'invalid_semester'
      });
    }

    const courseEntry = await CourseEntry.findOne({
      degreeLevel: formData.degreeLevel,
      department: department.departmentName
    }).session(session);

    if (!courseEntry) {
      cleanupUploads(files);
      return res.status(400).json({
        success: false,
        message: 'Course structure not found for selected program',
        errorType: 'missing_course_structure'
      });
    }

    const existingStudent = await Student.findOne({
      cnic: cleanedCNIC,
      batch: batch._id
    }).session(session);

    if (existingStudent) {
      cleanupUploads(files);
      return res.status(400).json({
        success: false,
        message: 'Student already enrolled in this batch',
        errorType: 'duplicate_student'
      });
    }

    const enrollmentYear = batch.enrollmentYear || new Date().getFullYear();
    const yearShort = enrollmentYear.toString().slice(-2);
    const depCode = department.departmentCode.toUpperCase();
    const seq = await generateStudentSequence(depCode, yearShort, session);
    const username = `${depCode}-${yearShort}-${seq}`;
    const universityEmail = `${username.toLowerCase()}@university.edu.pk`;
    const hashedPassword = await bcrypt.hash('student123', 12);

    const academicProgress = {
      currentSemester,
      totalCreditsRequired: courseEntry.semesters.reduce((sum, sem) =>
        sum + sem.courses.reduce((s, c) => s + c.creditHrs, 0), 0),
      totalCreditsEarned: 0,
      cumulativeGPA: 0,
      completionPercentage: 0,
      semesters: [{
        semesterNumber: currentSemester,
        status: 'upcoming',
        courses: [],
        semesterGPA: 0,
        creditsAttempted: 0,
        creditsEarned: 0
      }]
    };

    const student = new Student({
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      fatherFirstName: formData.fatherFirstName.trim(),
      fatherLastName: formData.fatherLastName.trim(),
      gender: formData.gender,
      cnic: cleanedCNIC,
      birthDate: formData.birthDate,
      bloodGroup: formData.bloodGroup || 'A+',
      maritalStatus: formData.maritalStatus || 'Single',
      religion: formData.religion || 'Islam',
      personalEmail: formData.personalEmail,
      contactNumber: formData.contactNumber,
      emergencyContact: formData.emergencyContact,
      address: formData.address,
      city: formData.city,
      province: formData.province,
      country: formData.country || 'Pakistan',
      postalCode: formData.postalCode || '',
      degreeLevel: formData.degreeLevel,
      department: department.departmentName,
      departmentCode: department.departmentCode,
      batch: batch._id,
      currentSemester,
      admissionType: formData.admissionType || 'Regular',
      studyMode: formData.studyMode || 'FullTime',
      domicileProvince: formData.domicileProvince || formData.province,
      isScholarshipApplicant: formData.isScholarshipApplicant === 'true' || formData.isScholarshipApplicant === true,
      scholarshipPercentage: Number(formData.scholarshipPercentage) || 0,
      status: 'active',
      matricQualification: {
        institution: matricQualification.institution,
        year: matricQualification.year,
        totalMarks: matricQualification.totalMarks,
        obtainedMarks: matricQualification.obtainedMarks,
        boardUniversity: matricQualification.boardUniversity,
        documentPath: files.matricDocument[0].path
      },
      intermediateQualification: {
        institution: intermediateQualification.institution,
        year: intermediateQualification.year,
        totalMarks: intermediateQualification.totalMarks,
        obtainedMarks: intermediateQualification.obtainedMarks,
        boardUniversity: intermediateQualification.boardUniversity,
        documentPath: files.intermediateDocument[0].path
      },
      photoPath: files.photo[0].path,
      domicilePath: files.domicile[0].path,
      studentId: username,
      universityEmail,
      username,
      password: hashedPassword,
      role: "student",
      academicProgress
    });

    const savedStudent = await student.save({ session });

    const sectionStudentData = {
      studentId: savedStudent.studentId,
      firstName: savedStudent.firstName,
      lastName: savedStudent.lastName,
      photoPath: savedStudent.photoPath,
      universityEmail: savedStudent.universityEmail,
      contactNumber: savedStudent.contactNumber,
      status: savedStudent.status,
      scholarshipPercentage: savedStudent.scholarshipPercentage
    };

    if (batch.graduationStatus === 'graduated') {
      await session.abortTransaction();
      cleanupUploads(files);
      return res.status(400).json({
        success: false,
        message: 'Cannot enroll student in graduated batch',
        errorType: 'graduated_batch'
      });
    }

    const assignedSection = await batch.assignStudentOptimally(sectionStudentData, session);

    await Student.findByIdAndUpdate(
      savedStudent._id,
      {
        section: assignedSection,
        currentSemester: batch.currentSemester,
        degreeLevel: batch.degreeLevel,
        department: batch.departmentName,
        departmentCode: batch.departmentCode
      },
      { session }
    );

    await batch.save({ session });

    let feeRecord = null;
    try {
      console.log('AUTOMATICALLY generating fee record for new student...');
      feeRecord = await autoGenerateStudentFeeRecord(savedStudent, session);
      if (feeRecord) {
        console.log(` Fee record automatically created for student ${savedStudent.studentId}`);
      } else {
        console.log(`No fee structure found for student ${savedStudent.studentId}`);
      }
    } catch (feeError) {
      console.error(`Error generating fee record for student ${savedStudent.studentId}:`, feeError);
    }

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      data: {
        studentId: savedStudent.studentId,
        universityEmail: savedStudent.universityEmail,
        name: `${savedStudent.firstName} ${savedStudent.lastName}`,
        batch: batch.batchName,
        department: savedStudent.department,
        currentSemester: savedStudent.currentSemester,
        section: assignedSection,
        status: savedStudent.status,
        feeRecordGenerated: !!feeRecord,
        feeRecord: feeRecord ? {
          totalDegreeFee: feeRecord.totalDegreeFee,
          totalDue: feeRecord.totalDue,
          scholarshipPercentage: feeRecord.scholarshipPercentage
        } : null,
        distribution: {
          currentSectionSize: batch.sections.find(s => s.name === assignedSection).currentStrength,
          averageSectionSize: (batch.totalStudentsEnrolled / batch.sections.length).toFixed(1),
          minSectionSize: Math.min(...batch.sections.map(s => s.currentStrength)),
          maxSectionSize: Math.max(...batch.sections.map(s => s.currentStrength))
        }
      }
    });

  } catch (err) {
    await session.abortTransaction();
    cleanupUploads(req.files);

    if (err.code === 11000) {
      const duplicateField = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${duplicateField} already exists`,
        errorType: 'duplicate_field',
        conflictField: duplicateField
      });
    }

    if (err.name === 'ValidationError') {
      const errors = {};
      for (const key in err.errors) {
        errors[key] = err.errors[key].message;
      }
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errorType: 'validation_error',
        errors
      });
    }

    console.error('Enrollment error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Enrollment failed due to server error',
      errorType: 'server_error'
    });
  } finally {
    session.endSession();
  }
};
exports.enrollFreshCourse = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { courseCode, originalSemester, reason } = req.body;

    console.log('🎓 Fresh enrollment request:', { studentId, courseCode, originalSemester, reason });

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const result = await student.enrollFreshCourse(courseCode, originalSemester, reason);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error enrolling fresh course:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.getAvailableFreshCourses = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const availableCourses = await student.getAvailableFreshCourses();

    res.json({
      success: true,
      data: availableCourses
    });
  } catch (error) {
    console.error('Error fetching available fresh courses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available fresh courses: ' + error.message
    });
  }
};

exports.repeatCourse = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { courseCode, originalSemester, reason } = req.body;

    console.log(` Repeat course request:`, { studentId, courseCode, originalSemester });

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const result = await student.repeatCourse(courseCode, originalSemester, reason);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error repeating course:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};



exports.unfreezeSemester = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { semesterNumber, newBatchId } = req.body;

    console.log(` Unfreeze semester request:`, { studentId, semesterNumber, newBatchId });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const student = await Student.findById(studentId).session(session);
      if (!student) {
        throw new Error('Student not found');
      }

      let targetBatch;
      if (newBatchId) {
        targetBatch = await Batch.findById(newBatchId).session(session);
      } else {
        targetBatch = await student.findBatchWithActiveSemester(semesterNumber, session);
      }

      if (!targetBatch) {
        throw new Error('No suitable batch found for unfreezing');
      }

      const newFeeStructure = await FeeStructure.findOne({
        degreeLevel: student.degreeLevel,
        department: student.department,
        batch: targetBatch.batchName,
        isActive: true
      }).session(session);

      if (!newFeeStructure) {
        throw new Error(`No fee structure found for target batch ${targetBatch.batchName}`);
      }

      const unfreezeResult = await student.unfreezeSemester(semesterNumber, newBatchId, session);

      const studentFee = await StudentFee.findOne({ studentId }).session(session);
      if (studentFee) {
        await studentFee.unfreezeSemesterFeesWithTransfer(
          semesterNumber,
          targetBatch,
          newFeeStructure,
          'Semester unfreeze with batch transfer',
          session
        );
      }

      await session.commitTransaction();

      res.json({
        success: true,
        data: {
          ...unfreezeResult,
          feesTransferred: !!studentFee,
          newBatch: targetBatch.batchName
        }
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error) {
    console.error('Error unfreezing semester:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};



exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('batch', 'batchName currentSemester totalSemesters graduationStatus')
      .populate({
        path: 'academicProgress.semesters.courses.course',
        select: 'courseName courseCode creditHrs'
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...student.toObject(),
        batchGraduated: student.batch?.graduationStatus === 'graduated'
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.updateStudent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const updates = req.body;

    const student = await Student.findById(id).session(session);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (updates.status && updates.status !== student.status) {
      const batch = await Batch.findById(student.batch).session(session);
      if (batch) {
        await batch.updateStudentStatus(
          student.studentId,
          student.status,
          updates.status,
          session
        );
      }
    }

    if (updates.section && updates.section !== student.section) {
      const batch = await Batch.findById(student.batch).session(session);
      if (!batch) {
        return res.status(400).json({
          success: false,
          message: 'Associated batch not found'
        });
      }

      if (student.section) {
        const oldSection = batch.sections.find(s => s.name === student.section);
        if (oldSection) {
          const studentIndex = oldSection.students.findIndex(s => s.studentId === student.studentId);
          if (studentIndex !== -1) {
            oldSection.students.splice(studentIndex, 1);
            oldSection.currentStrength -= 1;
          }
        }
      }

      let targetSection = batch.sections.find(s => s.name === updates.section);
      if (!targetSection) {
        return res.status(400).json({
          success: false,
          message: 'Target section not found'
        });
      }
      if (targetSection.currentStrength >= batch.sectionRules.maxStudents) {
        return res.status(400).json({
          success: false,
          message: 'Target section is full'
        });
      }

      targetSection.students.push({
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        photo: student.photoPath,
        universityEmail: student.universityEmail,
        contact: student.contactNumber,
        status: student.status,
        enrollmentDate: student.createdAt
      });
      targetSection.currentStrength += 1;

      await batch.save({ session });
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      updates,
      { new: true, session }
    );

    await session.commitTransaction();

    res.json({
      success: true,
      data: updatedStudent
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: err.message
    });
  } finally {
    session.endSession();
  }
};

exports.getDocument = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const documentTypes = {
      photo: student.photoPath,
      domicile: student.domicilePath,
      matric: student.matricQualification?.documentPath,
      intermediate: student.intermediateQualification?.documentPath
    };

    const filePath = documentTypes[req.params.documentType];
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.pdf': 'application/pdf'
    }[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve document'
    });
  }
};

exports.listStudents = async (req, res) => {
  try {
    const { batch, department, section, status, semester, graduationStatus } = req.query;
    const filter = {};

    if (batch) filter.batch = batch;
    if (department) filter.department = department;
    if (section) filter.section = section;
    if (status) filter.status = status;
    if (semester) filter.currentSemester = semester;

    if (graduationStatus === 'graduated') {
      filter.status = 'graduated';
    } else if (graduationStatus === 'active') {
      filter.status = { $ne: 'graduated' };
    }

    const students = await Student.find(filter)
      .populate({
        path: 'batch',
        select: 'batchName graduationStatus'
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.deleteStudent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const student = await Student.findById(req.params.id).session(session);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const batch = await Batch.findById(student.batch).session(session);
    if (batch) {
      const removed = await batch.removeStudent(student.studentId, student.status, session);

      if (!removed) {
        console.warn(`Student ${student.studentId} not found in batch sections during deletion`);
      }
    }

    await Student.findByIdAndDelete(req.params.id).session(session);

    await session.commitTransaction();

    const documents = [
      student.photoPath,
      student.domicilePath,
      student.matricQualification?.documentPath,
      student.intermediateQualification?.documentPath
    ];

    documents.forEach(doc => {
      if (doc && fs.existsSync(doc)) {
        fs.unlinkSync(doc);
      }
    });

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: err.message
    });
  } finally {
    session.endSession();
  }
};

exports.submitGrade = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { courseId, grade } = req.body;

    if (!courseId || !grade) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Course ID and grade are required'
      });
    }

    const student = await Student.findById(req.params.studentId).session(session);
    if (!student) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const progressionOccurred = await student.updateCourseGrade(courseId, grade, session);
    await student.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Grade submitted successfully',
      data: {
        academicProgress: student.academicProgress,
        semesterAdvanced: progressionOccurred,
        newSemester: progressionOccurred ? student.academicProgress.currentSemester : null
      }
    });
  } catch (err) {
    await session.abortTransaction();

    if (err.message.includes('No active semester') ||
      err.message.includes('Course not found') ||
      err.message.includes('Course status cannot be changed')) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    res.status(500).json({
      success: false,
      message: err.message || 'Failed to submit grade'
    });
  } finally {
    session.endSession();
  }
};

exports.checkGraduationEligibility = async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const eligibility = student.checkGraduationEligibility();

    res.json({
      success: true,
      data: eligibility
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAcademicSummary = async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId)
      .populate({
        path: 'batch',
        select: 'batchName graduationStatus'
      })
      .populate({
        path: 'academicProgress.semesters.courses.course',
        select: 'courseName courseCode creditHrs type'
      });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const response = {
      studentId: student.studentId,
      name: `${student.firstName} ${student.lastName}`,
      degree: student.degreeLevel,
      department: student.department,
      batch: student.batch?.batchName,
      batchGraduated: student.batch?.graduationStatus === 'graduated',
      status: student.status,
      currentSemester: student.academicProgress.currentSemester,
      credits: {
        earned: student.academicProgress.totalCreditsEarned,
        required: student.academicProgress.totalCreditsRequired,
        remaining: student.academicProgress.totalCreditsRequired -
          student.academicProgress.totalCreditsEarned,
        completionPercentage: student.academicProgress.completionPercentage
      },
      gpa: {
        cumulative: student.academicProgress.cumulativeGPA,
        lastSemester: student.academicProgress.semesters
          .find(s => s.status === 'completed' &&
            s.semesterNumber === student.academicProgress.currentSemester - 1)
          ?.semesterGPA || 0
      },
      completedSemesters: student.academicProgress.semesters
        .filter(s => s.status === 'completed')
        .map(s => ({
          semesterNumber: s.semesterNumber,
          gpa: s.semesterGPA,
          creditsAttempted: s.creditsAttempted,
          creditsEarned: s.creditsEarned,
          courses: s.courses.map(c => ({
            courseName: c.course?.courseName || c.courseName,
            courseCode: c.course?.courseCode || c.courseCode,
            status: c.status,
            grade: c.grade,
            credits: c.creditsEarned
          }))
        })),
      currentSemesterCourses: student.academicProgress.semesters
        .find(s => s.semesterNumber === student.academicProgress.currentSemester)
        ?.courses.map(c => ({
          courseName: c.course?.courseName || c.courseName,
          courseCode: c.course?.courseCode || c.courseCode,
          status: c.status,
          credits: c.creditsEarned
        })) || []
    };

    res.json({ success: true, data: response });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStudentsBySection = async (req, res) => {
  try {
    const { batchId, sectionName } = req.params;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const section = batch.sections.find(s => s.name === sectionName);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found in batch' });
    }

    const students = await Student.find({
      batch: batchId,
      section: sectionName,
      status: { $in: ['active', 'graduated'] }
    }).select('studentId firstName lastName universityEmail contactNumber status currentSemester');

    res.json({
      success: true,
      data: {
        section: sectionName,
        batch: batch.batchName,
        batchStatus: batch.graduationStatus,
        maxStudents: batch.sectionRules.maxStudents,
        currentStrength: section.currentStrength,
        studentCount: students.length,
        students,
        distribution: {
          average: (batch.totalStudentsEnrolled / batch.totalSections).toFixed(1),
          min: Math.min(...batch.sections.map(s => s.currentStrength)),
          max: Math.max(...batch.sections.map(s => s.currentStrength))
        },
        statusBreakdown: {
          active: students.filter(s => s.status === 'active').length,
          graduated: students.filter(s => s.status === 'graduated').length
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.semesterProgressionJob = schedule.scheduleJob('0 0 * * *', async () => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      console.log('Running semester progression job...');

      const batches = await Batch.find({
        isActive: true,
        graduationStatus: 'active'
      }).session(session);

      for (const batch of batches) {
        const currentSemesterData = batch.academicCalendar?.find(
          sem => sem.semester === batch.currentSemester
        );

        if (currentSemesterData && isAfter(new Date(), currentSemesterData.endDate)) {
          if (batch.currentSemester >= batch.totalSemesters) {
            await batch.markAsGraduated();
            console.log(`Batch ${batch.batchName} has graduated`);

            await Student.updateMany(
              {
                batch: batch._id,
                status: 'active'
              },
              {
                $set: { status: 'graduated' }
              },
              { session }
            );
          } else {
            batch.currentSemester += 1;
            await batch.save({ session });
            console.log(`Advanced batch ${batch.batchName} to semester ${batch.currentSemester}`);
          }
        }
      }

      const students = await Student.find({
        status: { $in: ['active'] },
        'academicProgress.currentSemester': { $exists: true }
      }).populate({
        path: 'batch',
        match: { graduationStatus: 'active' }
      }).session(session);

      let progressedStudents = 0;
      let graduatedStudents = 0;

      for (const student of students) {
        try {
          if (!student.batch) continue;

          const currentSemester = student.academicProgress.semesters.find(
            s => s.semesterNumber === student.academicProgress.currentSemester
          );

          if (currentSemester?.status === 'in-progress') {
            const incompleteCourses = currentSemester.courses.filter(
              c => !['completed', 'failed', 'dropped'].includes(c.status)
            );

            const semesterEnded = (currentSemester.endDate && isAfter(new Date(), currentSemester.endDate)) ||
              (student.batch?.currentSemester > student.academicProgress.currentSemester);

            if (incompleteCourses.length === 0 && semesterEnded) {
              currentSemester.status = 'completed';
              student.updateAcademicProgress();

              if (student.academicProgress.currentSemester < student.batch.totalSemesters) {
                await student.advanceToNextSemester(session);
                progressedStudents++;
                console.log(`Advanced student ${student.studentId} to semester ${student.academicProgress.currentSemester}`);
              } else if (student.academicProgress.completionPercentage >= 100) {
                student.status = 'graduated';
                graduatedStudents++;
                console.log(`Graduated student ${student.studentId}`);

                const batch = await Batch.findById(student.batch).session(session);
                if (batch) {
                  await batch.updateStudentStatus(
                    student.studentId,
                    'active',
                    'graduated',
                    session
                  );
                }
              }

              await student.save({ session });
            }
          }
        } catch (err) {
          console.error(`Error processing student ${student.studentId}:`, err);
        }
      }

      console.log(`Semester progression job completed. ${progressedStudents} students advanced, ${graduatedStudents} graduated.`);
    });
  } catch (error) {
    console.error('Error in semester progression job:', error);
  } finally {
    session.endSession();
  }
});

exports.getStudentCount = async (req, res) => {
  try {
    const count = await Student.countDocuments();
    res.json({
      success: true,
      count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getStudentsEnrolledAfter = async (req, res) => {
  try {
    const { enrolledAfter } = req.query;

    if (!enrolledAfter) {
      return res.status(400).json({
        success: false,
        message: 'enrolledAfter parameter is required'
      });
    }

    const filter = {
      createdAt: { $gte: new Date(enrolledAfter) }
    };

    const count = await Student.countDocuments(filter);

    res.json({
      success: true,
      count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getEnrollmentTrend = async (req, res) => {
  try {
    const { period = 'monthly', limit = 12 } = req.query;

    const endDate = new Date();
    let startDate = new Date();

    if (period === 'monthly') {
      startDate.setMonth(startDate.getMonth() - parseInt(limit));
    } else if (period === 'quarterly') {
      startDate.setMonth(startDate.getMonth() - (parseInt(limit) * 3));
    } else if (period === 'yearly') {
      startDate.setFullYear(startDate.getFullYear() - parseInt(limit));
    }

    const enrollmentData = await Student.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      },
      {
        $project: {
          period: {
            $concat: [
              {
                $switch: {
                  branches: [
                    { case: { $eq: ["$_id.month", 1] }, then: "Jan" },
                    { case: { $eq: ["$_id.month", 2] }, then: "Feb" },
                    { case: { $eq: ["$_id.month", 3] }, then: "Mar" },
                    { case: { $eq: ["$_id.month", 4] }, then: "Apr" },
                    { case: { $eq: ["$_id.month", 5] }, then: "May" },
                    { case: { $eq: ["$_id.month", 6] }, then: "Jun" },
                    { case: { $eq: ["$_id.month", 7] }, then: "Jul" },
                    { case: { $eq: ["$_id.month", 8] }, then: "Aug" },
                    { case: { $eq: ["$_id.month", 9] }, then: "Sep" },
                    { case: { $eq: ["$_id.month", 10] }, then: "Oct" },
                    { case: { $eq: ["$_id.month", 11] }, then: "Nov" },
                    { case: { $eq: ["$_id.month", 12] }, then: "Dec" }
                  ],
                  default: "Unknown"
                }
              },
              " ",
              { $toString: "$_id.year" }
            ]
          },
          count: 1,
          _id: 0
        }
      }
    ]);

    res.json({
      success: true,
      data: enrollmentData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateStudentStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { studentId } = req.params;
    const { newStatus } = req.body;

    if (!newStatus) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'New status is required'
      });
    }

    const student = await Student.findById(studentId).session(session);
    if (!student) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const batch = await Batch.findById(student.batch).session(session);
    if (!batch) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const updated = await batch.updateStudentStatus(
      student.studentId,
      student.status,
      newStatus,
      session
    );

    if (!updated) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Student not found in batch'
      });
    }

    student.status = newStatus;
    await student.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Student status updated successfully',
      data: {
        studentId: student.studentId,
        newStatus: student.status,
        batchStatus: batch.statusCounts
      }
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: err.message
    });
  } finally {
    session.endSession();
  }
};

exports.fixMissingFeeRecords = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { batchId } = req.body;

    if (!batchId) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Batch ID is required'
      });
    }

    const students = await Student.find({
      batch: batchId,
      status: 'active'
    }).populate('batch').session(session);

    console.log(` Found ${students.length} active students in batch`);

    const studentIds = students.map(s => s.studentId);

    const existingFeeRecords = await StudentFee.find({
      studentId: { $in: studentIds }
    }).session(session);

    const studentsWithFees = existingFeeRecords.map(fee => fee.studentId);
    const studentsWithoutFees = students.filter(student =>
      !studentsWithFees.includes(student.studentId)
    );

    console.log(`Students with fees: ${studentsWithFees.length}`);
    console.log(`Students without fees: ${studentsWithoutFees.length}`);

    const results = {
      totalStudents: students.length,
      studentsWithFees: studentsWithFees.length,
      studentsWithoutFees: studentsWithoutFees.length,
      generated: 0,
      errors: 0,
      details: []
    };

    for (const student of studentsWithoutFees) {
      try {
        const feeRecord = await autoGenerateStudentFeeRecord(student, session);
        if (feeRecord) {
          results.generated++;
          results.details.push({
            studentId: student.studentId,
            status: 'created',
            message: `Fee record created (Total: Rs. ${feeRecord.totalDegreeFee})`
          });
          console.log(` Generated fee record for student ${student.studentId}`);
        } else {
          results.errors++;
          results.details.push({
            studentId: student.studentId,
            status: 'error',
            message: 'No fee structure found for batch'
          });
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          studentId: student.studentId,
          status: 'error',
          message: error.message
        });
        console.error(` Error generating fee for student ${student.studentId}:`, error);
      }
    }

    await session.commitTransaction();

    res.json({
      success: true,
      message: `Generated ${results.generated} fee records for students without fees`,
      data: results
    });

  } catch (err) {
    await session.abortTransaction();
    console.error('Error fixing missing fee records:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fix missing fee records: ' + err.message
    });
  } finally {
    session.endSession();
  }
};

exports.populateAcademicProgressForBatch = async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID is required'
      });
    }

    const students = await Student.find({ batch: batchId })
      .populate('batch');

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students found in this batch'
      });
    }

    const results = {
      totalStudents: students.length,
      updated: 0,
      errors: 0,
      details: []
    };

    for (const student of students) {
      try {
        const { updateStudentAcademicProgress } = require('../scripts/populateAcademicProgress');
        await updateStudentAcademicProgress(student);

        results.updated++;
        results.details.push({
          studentId: student.studentId,
          status: 'success',
          message: `Academic progress populated for semester ${student.currentSemester}`
        });
      } catch (error) {
        results.errors++;
        results.details.push({
          studentId: student.studentId,
          status: 'error',
          message: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Academic progress populated for ${results.updated} students`,
      data: results
    });

  } catch (error) {
    console.error('Error populating academic progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to populate academic progress: ' + error.message
    });
  }
};

exports.getStudentAcademicProgress = async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId)
      .populate('batch', 'batchName currentSemester totalSemesters graduationStatus')
      .populate({
        path: 'academicProgress.semesters.courses.course',
        select: 'courseName courseCode creditHrs type'
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (!student.academicProgress || student.academicProgress.semesters.length === 0) {
      const { updateStudentAcademicProgress } = require('../scripts/populateAcademicProgress');
      await updateStudentAcademicProgress(student);

      const updatedStudent = await Student.findById(req.params.studentId)
        .populate('batch', 'batchName currentSemester totalSemesters graduationStatus')
        .populate({
          path: 'academicProgress.semesters.courses.course',
          select: 'courseName courseCode creditHrs type'
        });

      return res.json({
        success: true,
        data: updatedStudent.academicProgress,
        message: 'Academic progress generated successfully'
      });
    }

    res.json({
      success: true,
      data: student.academicProgress
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getStudentCreditLimits = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const degreeLevel = student.degreeLevel;
    const degreeInfo = {
      Undergraduate: {
        maxSemesters: 8,
        maxDepartmentCredits: 133,
        creditRange: [1, 4],
        semesterLimits: { 1: 18, 2: 18, 3: 18, 4: 18, 5: 17, 6: 17, 7: 15, 8: 12 }
      },
      Graduate: {
        maxSemesters: 6,
        maxDepartmentCredits: 72,
        creditRange: [1, 3],
        semesterLimits: { 1: 12, 2: 12, 3: 12, 4: 12, 5: 12, 6: 12 }
      },
      PhD: {
        maxSemesters: 8,
        maxDepartmentCredits: 48,
        creditRange: [1, 3],
        semesterLimits: { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9 }
      }
    }[degreeLevel];

    if (!degreeInfo) {
      return res.status(400).json({
        success: false,
        message: `Invalid degree level: ${degreeLevel}`
      });
    }

    const creditLimits = {};
    const totalSemesters = degreeInfo.maxSemesters;

    for (let i = 1; i <= totalSemesters; i++) {
      try {
        const semesterLimit = degreeInfo.semesterLimits[i] || 18;

        const semester = student.academicProgress?.semesters?.find(
          s => s.semesterNumber === i
        );

        const currentCredits = semester ?
          semester.courses.reduce((sum, course) => {
            if (course.status !== 'dropped' && !course.isReplaced) {
              return sum + (course.creditsEarned || 0);
            }
            return sum;
          }, 0) : 0;

        const available = Math.max(0, semesterLimit - currentCredits);

        creditLimits[i] = {
          canAdd: available > 0,
          available: available,
          current: currentCredits,
          limit: semesterLimit,
          semester: i
        };
      } catch (error) {
        console.error(`Error processing semester ${i}:`, error);
        creditLimits[i] = {
          canAdd: false,
          available: 0,
          current: 0,
          limit: degreeInfo.semesterLimits[i] || 18,
          semester: i,
          error: error.message
        };
      }
    }

    res.json({
      success: true,
      data: {
        creditLimits,
        degreeLevel: student.degreeLevel,
        degreeInfo: {
          maxSemesters: degreeInfo.maxSemesters,
          maxDepartmentCredits: degreeInfo.maxDepartmentCredits,
          creditRange: degreeInfo.creditRange
        },
        studentInfo: {
          studentId: student.studentId,
          currentSemester: student.currentSemester,
          totalCreditsEarned: student.academicProgress?.totalCreditsEarned || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching credit limits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch credit limits: ' + error.message
    });
  }
};

exports.freezeSemester = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { semesterNumber, reason } = req.body;

    console.log(`Freeze semester request:`, { studentId, semesterNumber, reason });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const student = await Student.findById(studentId).session(session);
      if (!student) {
        throw new Error('Student not found');
      }

      const freezeResult = await student.freezeSemester(semesterNumber, reason, session);

      const studentFee = await StudentFee.findOne({ studentId }).session(session);
      if (studentFee) {
        await studentFee.freezeSemesterFees(semesterNumber, reason, session);
      }

      await session.commitTransaction();

      res.json({
        success: true,
        data: {
          ...freezeResult,
          feesFrozen: !!studentFee
        }
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error) {
    console.error('Error freezing semester:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.dropCourse = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { courseCode, semesterNumber, reason } = req.body;

    console.log(` Drop course request:`, { studentId, courseCode, semesterNumber, reason });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const student = await Student.findById(studentId).session(session);
      if (!student) {
        throw new Error('Student not found');
      }

      const dropResult = await student.dropCourse(courseCode, semesterNumber, reason, session);

      const studentFee = await StudentFee.findOne({ studentId }).session(session);
      if (studentFee) {
        const course = student.academicProgress.semesters
          .find(s => s.semesterNumber === semesterNumber)
          ?.courses.find(c => c.courseCode === courseCode);

        if (course) {
          const creditHrs = course.creditsEarned || 3;
          await studentFee.adjustFeeForDroppedCourse(courseCode, semesterNumber, creditHrs, session);
        }
      }

      await session.commitTransaction();

      res.json({
        success: true,
        data: {
          ...dropResult,
          feeAdjusted: !!studentFee
        }
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error) {
    console.error(' Error in drop course controller:', error.message);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.getRepeatableCourses = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const repeatableCourses = student.getRepeatableCourses();

    res.json({
      success: true,
      data: repeatableCourses
    });
  } catch (error) {
    console.error('Error fetching repeatable courses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch repeatable courses: ' + error.message
    });
  }
};

exports.getStudentAcademicStatus = async (req, res) => {
  console.log('=== getStudentAcademicStatus called ===');
  console.log('Student ID:', req.params.studentId);

  try {
    const { studentId } = req.params;

    if (!studentId) {
      console.log('No student ID provided');
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    console.log('Fetching student from database...');

    const student = await Student.findById(studentId)
      .populate('batch', 'batchName currentSemester totalSemesters graduationStatus enrollmentStatus')
      .lean();

    if (!student) {
      console.log('Student not found with ID:', studentId);
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    console.log('Student found:', student.studentId);

    const academicProgress = student.academicProgress || {
      currentSemester: 1,
      semesters: [],
      totalCreditsEarned: 0,
      totalCreditsRequired: 0,
      cumulativeGPA: 0,
      completionPercentage: 0
    };

    console.log('Academic progress semesters count:', academicProgress.semesters?.length || 0);

    const creditLimits = {};
    const defaultLimits = { 1: 18, 2: 18, 3: 18, 4: 18, 5: 17, 6: 17, 7: 15, 8: 12 };

    const totalSemesters = student.batch?.totalSemesters || 8;
    console.log('Total semesters to process:', totalSemesters);

    for (let i = 1; i <= totalSemesters; i++) {
      try {
        const semesterLimit = defaultLimits[i] || 18;
        const semester = academicProgress.semesters?.find(s => s.semesterNumber === i);

        const currentCredits = semester ? (semester.creditsAttempted || 0) : 0;
        const available = Math.max(0, semesterLimit - currentCredits);

        creditLimits[i] = {
          canAdd: available > 0,
          available: available,
          current: currentCredits,
          limit: semesterLimit
        };

        console.log(`Semester ${i}: ${currentCredits}/${semesterLimit} credits`);
      } catch (semesterError) {
        console.log(`Error processing semester ${i}:`, semesterError.message);
        creditLimits[i] = {
          canAdd: false,
          available: 0,
          current: 0,
          limit: defaultLimits[i] || 18
        };
      }
    }

    const frozenSemesters = academicProgress.semesters
      ?.filter(s => s.status === 'frozen')
      .map(s => s.semesterNumber) || [];

    const repeatedCourses = academicProgress.semesters
      ?.flatMap(s => (s.courses || []).filter(c => c && c.isRepeated))
      .map(c => ({
        courseCode: c.courseCode || 'Unknown',
        courseName: c.courseName || 'Unknown Course',
        originalSemester: c.originalSemester || 1,
        newSemester: c.semesterTaken || 1
      })) || [];

    const availableSemesters = academicProgress.semesters
      ?.filter(s => s && ['upcoming', 'in-progress'].includes(s.status))
      .map(s => s.semesterNumber) || [];

    console.log('Preparing final response...');

    const response = {
      studentId: student.studentId,
      name: `${student.firstName} ${student.lastName}`,
      batch: student.batch?.batchName || 'Unknown Batch',
      currentSemester: academicProgress.currentSemester || 1,
      status: student.status,
      academicProgress: academicProgress,
      creditLimits: creditLimits,
      frozenSemesters: frozenSemesters,
      repeatedCourses: repeatedCourses,
      availableSemesters: availableSemesters
    };

    console.log('=== Successfully prepared response ===');

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('=== CRITICAL ERROR in getStudentAcademicStatus ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch academic status: ' + error.message,
      errorDetails: {
        name: error.name,
        message: error.message
      }
    });
  }
};

exports.getStudentsByBatch = async (req, res) => {
  try {
    const { degreeLevel, department, batch } = req.query;

    if (!degreeLevel || !department || !batch) {
      return res.status(400).json({
        success: false,
        message: 'Degree level, department and batch are required'
      });
    }

    const batchDoc = await Batch.findOne({
      batchName: batch,
      departmentName: department,
      degreeLevel: degreeLevel.toLowerCase()
    });

    if (!batchDoc) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const students = await Student.find({
      batch: batchDoc._id,
      status: { $in: ['active', 'inactive'] }
    })
      .select('studentId firstName lastName universityEmail currentSemester section status contactNumber')
      .sort({ firstName: 1 });

    res.json({
      success: true,
      data: {
        students: students,
        batchInfo: {
          batchName: batchDoc.batchName,
          currentSemester: batchDoc.currentSemester,
          totalStudents: batchDoc.totalStudentsEnrolled
        }
      }
    });
  } catch (error) {
    console.error('Error fetching students by batch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students: ' + error.message
    });
  }
};
exports.debugCourseEnrollment = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { courseCode, semester } = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    console.log('=== DEBUG COURSE ENROLLMENT ===');

    const debugResults = await student.debugBatchSearch(courseCode, semester);

    const foundBatch = await student.findActiveBatchForCourse(courseCode, semester);

    res.json({
      success: true,
      data: {
        student: {
          id: student.studentId,
          degreeLevel: student.degreeLevel,
          department: student.department,
          currentSemester: student.currentSemester
        },
        course: {
          code: courseCode,
          targetSemester: semester
        },
        debugSearches: debugResults,
        foundBatch: foundBatch ? {
          id: foundBatch._id,
          name: foundBatch.batchName,
          currentSemester: foundBatch.currentSemester
        } : null,
        recommendation: foundBatch ?
          `Use batch: ${foundBatch.batchName}` :
          'No suitable batch found'
      }
    });

  } catch (error) {
    console.error('Debug enrollment error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


exports.getAcademicOperations = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      studentId,
      studentName,
      operationType,
      status,
      startDate,
      endDate
    } = req.query;

    console.log('Fetching academic operations with filters:', {
      page, limit, studentId, studentName, operationType, status, startDate, endDate
    });

    const studentFilter = {};
    if (studentId) {
      studentFilter.studentId = { $regex: studentId, $options: 'i' };
    }
    if (studentName) {
      studentFilter.$or = [
        { firstName: { $regex: studentName, $options: 'i' } },
        { lastName: { $regex: studentName, $options: 'i' } }
      ];
    }

    const students = await Student.find(studentFilter)
      .populate('batch', 'batchName departmentName degreeLevel')
      .lean();

    console.log(`Found ${students.length} students matching filters`);

    let allOperations = [];
    students.forEach(student => {
      const operations = extractAllOperationDetails(student);
      allOperations = allOperations.concat(operations);
    });

    console.log(`Total operations found: ${allOperations.length}`);

    let filteredOperations = allOperations;

    if (operationType) {
      filteredOperations = filteredOperations.filter(op => op.operationType === operationType);
    }

    if (status) {
      filteredOperations = filteredOperations.filter(op => op.status === status);
    }

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      filteredOperations = filteredOperations.filter(op => {
        const opDate = new Date(op.operationDate);
        if (start && end) return opDate >= start && opDate <= end;
        if (start) return opDate >= start;
        if (end) return opDate <= end;
        return true;
      });
    }

    console.log(`Operations after filtering: ${filteredOperations.length}`);

    filteredOperations.sort((a, b) => new Date(b.operationDate) - new Date(a.operationDate));

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const paginatedOperations = filteredOperations.slice(skip, skip + limitNum);

    res.json({
      success: true,
      data: paginatedOperations,
      pagination: {
        current: pageNum,
        pageSize: limitNum,
        totalRecords: filteredOperations.length,
        totalPages: Math.ceil(filteredOperations.length / limitNum)
      }
    });

  } catch (error) {
    console.error('Error fetching academic operations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch academic operations: ' + error.message
    });
  }
};

const extractAllOperationDetails = (student) => {
  const operations = [];
  const academicProgress = student.academicProgress || { semesters: [] };

  academicProgress.semesters.forEach(semester => {
    if (!semester) return;

    if (semester.status === 'frozen' && semester.frozenAt) {
      operations.push({
        _id: `${student._id}_freeze_${semester.semesterNumber}_${semester.frozenAt.getTime()}`,
        studentId: student.studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        batch: student.batch?.batchName || 'Unknown',
        department: student.department,
        currentSemester: student.currentSemester,
        operationType: 'freeze',
        semesterNumber: semester.semesterNumber,
        operationDate: semester.frozenAt,
        status: 'completed',
        reason: semester.freezeReason || 'Academic freeze',
        details: `Semester ${semester.semesterNumber} frozen`
      });
    }

    if (semester.unfrozenAt) {
      operations.push({
        _id: `${student._id}_unfreeze_${semester.semesterNumber}_${semester.unfrozenAt.getTime()}`,
        studentId: student.studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        batch: student.batch?.batchName || 'Unknown',
        department: student.department,
        currentSemester: student.currentSemester,
        operationType: 'unfreeze',
        semesterNumber: semester.semesterNumber,
        operationDate: semester.unfrozenAt,
        status: 'completed',
        reason: semester.unfreezeReason || 'Academic continuation',
        details: `Semester ${semester.semesterNumber} unfrozen`
      });
    }

    if (semester.courses && Array.isArray(semester.courses)) {
      semester.courses.forEach(course => {
        if (!course) return;

        if (course.status === 'dropped' && course.droppedAt) {
          operations.push({
            _id: `${student._id}_drop_${course.courseCode}_${course.droppedAt.getTime()}`,
            studentId: student.studentId,
            studentName: `${student.firstName} ${student.lastName}`,
            batch: student.batch?.batchName || 'Unknown',
            department: student.department,
            currentSemester: student.currentSemester,
            operationType: 'drop',
            courseCode: course.courseCode,
            courseName: course.courseName,
            semesterNumber: semester.semesterNumber,
            operationDate: course.droppedAt,
            status: 'completed',
            reason: course.dropReason || 'Course dropped',
            details: `Course ${course.courseCode} dropped from semester ${semester.semesterNumber}`
          });
        }

        if (course.isFresh && course.enrolledAt) {
          operations.push({
            _id: `${student._id}_fresh_${course.courseCode}_${course.enrolledAt.getTime()}`,
            studentId: student.studentId,
            studentName: `${student.firstName} ${student.lastName}`,
            batch: student.batch?.batchName || 'Unknown',
            department: student.department,
            currentSemester: student.currentSemester,
            operationType: 'fresh',
            courseCode: course.courseCode,
            courseName: course.courseName,
            semesterNumber: semester.semesterNumber,
            operationDate: course.enrolledAt,
            status: 'completed',
            reason: course.freshEnrollmentReason || 'Fresh course enrollment',
            details: `Course ${course.courseCode} enrolled as fresh course in semester ${semester.semesterNumber}`,
            isCrossBatch: course.isCrossBatch || false
          });
        }
      });
    }
  });

  return operations;
};

exports.getAcademicOperationsStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    console.log('Fetching academic operations statistics');

    const students = await Student.find({})
      .populate('batch', 'batchName departmentName degreeLevel')
      .lean();

    console.log(`Processing ${students.length} students for statistics`);

    let totalOperations = 0;
    let freezeOperations = 0;
    let unfreezeOperations = 0;
    let dropOperations = 0;
    let freshOperations = 0;

    students.forEach(student => {
      const operations = extractAllOperationDetails(student);

      operations.forEach(op => {
        if (startDate || endDate) {
          const opDate = new Date(op.operationDate);
          const start = startDate ? new Date(startDate) : null;
          const end = endDate ? new Date(endDate) : null;

          if (start && opDate < start) return;
          if (end && opDate > end) return;
        }

        totalOperations++;

        switch (op.operationType) {
          case 'freeze':
            freezeOperations++;
            break;
          case 'unfreeze':
            unfreezeOperations++;
            break;
          case 'drop':
            dropOperations++;
            break;
          case 'fresh':
            freshOperations++;
            break;
        }
      });
    });

    const statistics = {
      totalOperations,
      freezeOperations,
      unfreezeOperations,
      dropOperations,
      freshOperations,
      pendingOperations: 0,
      completedOperations: totalOperations
    };

    console.log('Statistics calculated:', statistics);

    res.json({
      success: true,
      data: {
        summary: statistics
      }
    });

  } catch (error) {
    console.error('Error fetching operations statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch operations statistics: ' + error.message
    });
  }
};

exports.getOperationDetails = async (req, res) => {
  try {
    const { operationId } = req.params;

    console.log('Fetching operation details for:', operationId);

    const parts = operationId.split('_');
    if (parts.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Invalid operation ID format'
      });
    }

    const studentId = parts[0];
    const operationType = parts[1];

    const student = await Student.findById(studentId)
      .populate('batch', 'batchName currentSemester totalSemesters departmentName degreeLevel academicCalendar')
      .lean();

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const allOperations = extractAllOperationDetails(student);
    const operation = allOperations.find(op => op._id === operationId);

    if (!operation) {
      return res.status(404).json({
        success: false,
        message: 'Operation not found'
      });
    }

    const batchInfo = student.batch ? {
      batchName: student.batch.batchName,
      currentSemester: student.batch.currentSemester,
      totalSemesters: student.batch.totalSemesters,
      departmentName: student.batch.departmentName,
      degreeLevel: student.batch.degreeLevel
    } : null;

    const statusHistory = [{
      status: operation.status,
      timestamp: operation.operationDate,
      note: operation.details
    }];

    res.json({
      success: true,
      data: {
        operation,
        student: {
          studentId: student.studentId,
          name: `${student.firstName} ${student.lastName}`,
          batch: student.batch?.batchName,
          department: student.department,
          currentSemester: student.currentSemester,
          status: student.status,
          contactNumber: student.contactNumber,
          universityEmail: student.universityEmail
        },
        batchInfo,
        statusHistory
      }
    });

  } catch (error) {
    console.error('Error fetching operation details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch operation details: ' + error.message
    });
  }
};

exports.getStudentsWithRecentOperations = async (req, res) => {
  try {
    const { days = 30, limit = 10 } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const students = await Student.find({
      'academicProgress.semesters': {
        $elemMatch: {
          $or: [
            { status: 'frozen', frozenAt: { $gte: cutoffDate } },
            { unfrozenAt: { $gte: cutoffDate } },
            { 'courses.droppedAt': { $gte: cutoffDate } }
          ]
        }
      }
    })
      .select('studentId firstName lastName batch department currentSemester academicProgress status')
      .populate('batch', 'batchName')
      .limit(parseInt(limit))
      .sort({ 'academicProgress.semesters.frozenAt': -1 })
      .lean();

    const studentsWithOperations = students.map(student => {
      const recentOperations = extractOperationDetails(student).filter(op =>
        op.timestamp >= cutoffDate
      );

      return {
        studentId: student.studentId,
        name: `${student.firstName} ${student.lastName}`,
        batch: student.batch?.batchName,
        department: student.department,
        currentSemester: student.currentSemester,
        status: student.status,
        recentOperations: recentOperations.length,
        lastOperation: recentOperations[0] ? {
          type: recentOperations[0].type,
          date: recentOperations[0].timestamp,
          details: recentOperations[0].details
        } : null
      };
    }).filter(student => student.recentOperations > 0);

    res.json({
      success: true,
      data: studentsWithOperations
    });

  } catch (error) {
    console.error('Error fetching students with recent operations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students with recent operations: ' + error.message
    });
  }
};
exports.getStudentsByCourse = async (req, res) => {
  try {
    const { courseCode } = req.params;
    const { batchId, section } = req.query;

    if (!courseCode || !batchId || !section) {
      return res.status(400).json({ message: 'courseCode, batchId, and section are required' });
    }

   
    const students = await Student.find({
      batch: batchId,
      section: section,
      status: 'active', 
      'academicProgress.semesters.courses.courseCode': courseCode
    }).select('studentId firstName lastName batch section academicProgress status');

    const formattedStudents = students.map((s) => ({
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      fullName: `${s.firstName} ${s.lastName}`,
      batchName: s.batchName || '', 
      section: s.section,
      assessments: {}, 
    }));

    res.json({ students: formattedStudents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch students' });
  }
};
