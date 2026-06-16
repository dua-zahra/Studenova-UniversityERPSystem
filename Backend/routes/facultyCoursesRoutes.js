const express = require("express");
const router = express.Router();
const { 
  getAssignedCourses, 
  getCoursesByStatus,
  getTeachingHistory,
  testRoute
} = require("../controllers/facultyCoursesController");

// Test route
router.get("/test", testRoute);

// Main routes
router.get("/courses", getAssignedCourses);
router.get("/courses/status", getCoursesByStatus);
router.get("/teaching-history", getTeachingHistory);

module.exports = router;