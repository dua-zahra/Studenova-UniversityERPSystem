const express = require("express");
const router = express.Router();
const { getCourseTimeSlots } = require("../controllers/facultyTimetableController");

router.get("/course-slots", getCourseTimeSlots);

module.exports = router;
