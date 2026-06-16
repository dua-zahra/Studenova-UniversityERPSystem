const express = require("express");
const router = express.Router();
const { saveFacultyAttendance, getAttendanceByDate, getAttendanceByCourseSection, updateAttendance } = require("../controllers/attendanceController");

router.post("/save", saveFacultyAttendance);
router.get("/by-date", getAttendanceByDate);
router.get("/by-course-section", getAttendanceByCourseSection);
router.post("/attendance/update", updateAttendance);





module.exports = router;
