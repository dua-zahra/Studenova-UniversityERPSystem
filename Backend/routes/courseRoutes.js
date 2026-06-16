const express = require('express');
const router = express.Router();
const {
  addOrUpdateCourseEntry,
  getSemesterCredits,
  getCourses,
  getDegreeLevels,
  getDepartments,
  getSemesters,
  getDegreeConfig,
  getCourseEntries,
  getAllSemesterCourseCounts,
  getCoursesForFeeAssignment

} = require('../controllers/courseController');
router.get('/counts', getAllSemesterCourseCounts);
router.get('/degree-config', getDegreeConfig);
router.post('/courses', addOrUpdateCourseEntry);
router.get('/courses/semester', getCourses);
router.get('/semester-credits', getSemesterCredits);
router.get('/degree-levels', getDegreeLevels);
router.get('/departments', getDepartments);
router.get('/semesters', getSemesters);
router.get('/course-entries', getCourseEntries);
router.get('/courses-for-fees', getCoursesForFeeAssignment);
module.exports = router;
