const express = require("express");
const router = express.Router();
const {
  saveFacultyResults,
  updateResults,
  getStudentResults,
  getResultsByCourse,
  getResultsWithTeacher,
  deleteResults
} = require("../controllers/resultController");

// Save results
router.post("/save", saveFacultyResults);

// Update results
router.put("/update", updateResults);

// Get student results
router.get("/student/:studentId", getStudentResults);

// Get results by course
router.get("/course/:courseCode/:batchName/:sectionName", getResultsByCourse);


// Get results with teacher info
router.get("/by-course-section-with-teacher", getResultsWithTeacher);

// Delete results
router.post("/delete", deleteResults);

module.exports = router;
