const express = require('express');
const router = express.Router();
const {
  getActiveBatches,
  getBatchDetails,
  getCoursesForAssignment,
  assignTeacher,
  removeAssignment,
  getAvailableFaculty,
  advanceSemesters,  
  cleanupSections,
  checkSemesterAdvancement,
  getFacultyWorkload,
  getFacultyAssignments,
  getBatchSemesterAssignments,
  updateTeachingStatus,
  getBatchAllSemesters,
  getAllFacultyWithTeachingStatus,
  getSemesterAssignmentsOverview,
  syncFacultyWorkloads,
  getBatchSections,
  getTeachingStatusSummary,
  getActiveBatchAssignments
} = require('../controllers/TeacherAssignmentController');

// Batch routes
router.get('/batches/active', getActiveBatches);
router.get('/batches/:batchId', getBatchDetails);
router.get('/batches/:batchId/sections', getBatchSections);
router.get('/batches/:batchId/all-semesters', getBatchAllSemesters);
router.get('/batches/:batchId/semester-overview', getSemesterAssignmentsOverview);
router.get('/batches/:batchId/semester-assignments', getBatchSemesterAssignments);
router.get('/batches/:batchId/check-advancement', checkSemesterAdvancement);
router.post('/batches/advance-semesters', advanceSemesters);  
router.post('/batches/:batchId/cleanup-sections', cleanupSections);
router.post('/batches/:batchId/update-teaching-status', updateTeachingStatus);

// Semester and course routes
router.get('/batches/:batchId/semesters/:semester/courses', getCoursesForAssignment);
router.put('/batches/:batchId/semesters/:semester/courses/:courseCode/sections/:sectionName', assignTeacher);
router.delete('/batches/:batchId/semesters/:semester/courses/:courseCode/sections/:sectionName', removeAssignment);

// Faculty routes
router.get('/faculty/available', getAvailableFaculty);
router.get('/faculty/with-teaching-status', getAllFacultyWithTeachingStatus);
router.get('/faculty/:facultyId/workload', getFacultyWorkload);
router.get('/faculty/:facultyId/assignments', getFacultyAssignments);
router.post('/faculty/sync-workloads', syncFacultyWorkloads);

// Summary and overview routes
router.get('/teaching-status/summary', getTeachingStatusSummary);
router.get('/active-batch-assignments', getActiveBatchAssignments);

module.exports = router;