const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const facultyTaskController = require("../controllers/facultyTaskController");

router.post("/", upload.single("assignmentFile"), facultyTaskController.createTask);

router.get("/", facultyTaskController.getFacultyTasks);

module.exports = router;
