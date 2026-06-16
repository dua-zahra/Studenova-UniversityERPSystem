// const express = require('express');
// const router = express.Router();
// const {
//   enrollStudent,
//   getDocument,
//   // getStudentProfile,
//   submitGrade,
//   checkGraduationEligibility,
//   getAcademicSummary,
//   listStudents,
//   deleteStudent,
//   updateStudent,
//   getStudentCount,        
//   getStudentsEnrolledAfter,
//   getEnrollmentTrend,
//   fixMissingFeeRecords,
//   populateAcademicProgressForBatch,
//   getStudentAcademicProgress,
//   freezeSemester,
//   unfreezeSemester,
//   dropCourse,
//   getStudentCreditLimits,
//   repeatCourse,
//   enrollFreshCourse,
//   getStudentAcademicStatus,
//   getStudentsByBatch

// } = require('../controllers/studentController');
// const upload = require('../config/multer');

// router.post(
//   '/enroll',
//   upload.fields([
//     { name: 'photo', maxCount: 1 },
//     { name: 'domicile', maxCount: 1 },
//     { name: 'matricDocument', maxCount: 1 },
//     { name: 'intermediateDocument', maxCount: 1 }
//   ]),
//   enrollStudent
// );
// router.get('/by-batch', getStudentsByBatch);
// // router.get('/by-batch', getStudentsByBatch);
// router.get('/count', getStudentCount);
// router.get('/recent/count', getStudentsEnrolledAfter);
// router.get('/enrollment-trend', getEnrollmentTrend);
// router.get('/', listStudents);
// // router.get('/:id', getStudentById);
// router.get('/:id/documents/:documentType', getDocument);
// // router.get('/:studentId/profile', getStudentProfile);
// router.post('/:studentId/grades', submitGrade);
// router.get('/:studentId/graduation-eligibility', checkGraduationEligibility);
// router.get('/:studentId/academic-summary', getAcademicSummary);
// router.put('/:id', updateStudent);
// router.delete('/:id', deleteStudent);
// router.post('/fix-missing-fee-records',fixMissingFeeRecords);



// router.get('/:studentId/credit-limits', getStudentCreditLimits);
// router.post('/batch/:batchId/populate-academic-progress', populateAcademicProgressForBatch);
// router.get('/:studentId/academic-progress', getStudentAcademicProgress);



// // In studentRoutes.js

// router.post('/:studentId/freeze-semester',freezeSemester);
// router.post('/:studentId/unfreeze-semester',unfreezeSemester);
// router.post('/:studentId/drop-course', dropCourse);
// router.post('/:studentId/repeat-course', repeatCourse);
// router.post('/:studentId/enroll-fresh-course', enrollFreshCourse);
// router.get('/:studentId/academic-status', getStudentAcademicStatus);
// module.exports = router;
const express = require('express');
const router = express.Router();
const studentController = require("../controllers/studentController");
const path = require("path");
const fs = require("fs");
const {
  enrollStudent,
  getDocument,
  submitGrade,
  checkGraduationEligibility,
  getAcademicSummary,
  listStudents,
  deleteStudent,
  updateStudent,
  getStudentCount,        
  getStudentsEnrolledAfter,
  getEnrollmentTrend,
  fixMissingFeeRecords,
  populateAcademicProgressForBatch,
  getStudentAcademicProgress,
  freezeSemester,
  unfreezeSemester,
  dropCourse,
  getStudentCreditLimits,
  repeatCourse,
  enrollFreshCourse,
  getStudentAcademicStatus,
  getStudentsByBatch,
  getRepeatableCourses,
  debugCourseEnrollment,
  getAvailableFreshCourses,
  getAcademicOperations,
  getAcademicOperationsStatistics,
  getStudentsWithRecentOperations,
  getOperationDetails,
  getStudentsByCourse,
  getStudentDashboard,
  getStudentAttendance,
  getStudentResults,
  getTimeTable,
  
  getStudentFee,
  getStudentTasks,
  getStudentExpenses
} = require('../controllers/studentController');
const upload = require('../config/multer');

router.post(
  '/enroll',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'domicile', maxCount: 1 },
    { name: 'matricDocument', maxCount: 1 },
    { name: 'intermediateDocument', maxCount: 1 }
  ]),
  enrollStudent
);
router.get("/taskfile/:filename", (req, res) => {
  const { filename } = req.params;

  if (!filename) {
    return res.status(400).json({ success: false, message: "Filename is required" });
  }

  // Build the absolute path to the file
  const filePath = path.join(__dirname, "..", "uploads", "tasks", filename);

  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    // Serve the file
    res.sendFile(filePath);
  });
});
router.get("/expenses", getStudentExpenses);
router.get("/getStudentTasks", getStudentTasks);


router.get("/getStudentFee", getStudentFee);


router.get("/gettimetable", getTimeTable);

router.get("/getstudentresults", getStudentResults);
router.get("/getstudentattendance", getStudentAttendance);

router.get('/getStudentDashboard', getStudentDashboard);
router.get('/:studentId/available-fresh-courses', getAvailableFreshCourses);
router.post('/:studentId/enroll-fresh-course', enrollFreshCourse);
router.post('/:studentId/repeat-course', repeatCourse);

router.get('/by-batch', getStudentsByBatch);
router.get('/count', getStudentCount);
router.get('/recent/count', getStudentsEnrolledAfter);
router.get('/enrollment-trend', getEnrollmentTrend);
router.get('/', listStudents);
router.post('/:studentId/grades', submitGrade);
router.get('/:studentId/graduation-eligibility', checkGraduationEligibility);
router.get('/:studentId/academic-summary', getAcademicSummary);
router.put('/:id', updateStudent);
router.delete('/:id', deleteStudent);
router.post('/fix-missing-fee-records', fixMissingFeeRecords);

router.get('/:studentId/credit-limits', getStudentCreditLimits);
router.post('/batch/:batchId/populate-academic-progress', populateAcademicProgressForBatch);
router.get('/:studentId/academic-progress', getStudentAcademicProgress);

router.post('/:studentId/freeze-semester', freezeSemester);
router.post('/:studentId/drop-course', dropCourse);
router.get('/:studentId/repeatable-courses', getRepeatableCourses);
router.get('/:studentId/academic-status', getStudentAcademicStatus);
router.post('/:studentId/debug-enrollment', debugCourseEnrollment);

router.get('/academic-operations', getAcademicOperations);
router.get('/academic-operations/statistics', getAcademicOperationsStatistics);
router.get('/academic-operations/recent', getStudentsWithRecentOperations);
router.get('/academic-operations/:operationId/details', getOperationDetails);
// ---------------- Students by Course ----------------
// Must come before '/:id' to avoid conflict
router.get("/by-course/:courseCode", studentController.getStudentsByCourse);
module.exports = router;
router.get('/:id/documents/:documentType', getDocument);
