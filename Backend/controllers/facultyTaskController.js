const FacultyTask = require("../models/FacultyTask");

exports.createTask = async (req, res) => {
  try {
    const {
      facultyName,
      courseCode,
      courseName,
      batchName,
      sectionName,
      semester,
      taskTitle,
      taskDescription
    } = req.body;

    const newTask = new FacultyTask({
      facultyName,
      courseCode,
      courseName,
      batchName,
      sectionName,
      semester,
      taskTitle,
      taskDescription,
      assignmentFile: req.file ? req.file.filename : null
    });

    await newTask.save();
    res.status(201).json({ success: true, task: newTask, message: "Task saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

exports.getFacultyTasks = async (req, res) => {
  try {
    const facultyUser = JSON.parse(req.cookies?.user || "{}");
    const facultyName = facultyUser?.fullName || facultyUser?.name || "unknown";

    const tasks = await FacultyTask.find({ facultyName });
    res.json({ success: true, tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
