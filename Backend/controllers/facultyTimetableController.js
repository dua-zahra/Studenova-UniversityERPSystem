const FacultyTimetable = require("../models/FacultyTimetable");

exports.getCourseTimeSlots = async (req, res) => {
  try {
    const { facultyId, courseCode, batchId, sectionName } = req.query;

    if (!facultyId || !courseCode || !batchId || !sectionName) {
      return res.status(400).json({ message: "Missing required query parameters" });
    }

    const timetable = await FacultyTimetable.findOne({
      facultyId,
      isActive: true,
      "timeSlots.courseCode": courseCode,
      "timeSlots.batchId": batchId,
      "timeSlots.sectionName": sectionName,
    });

    if (!timetable) return res.json({ timeSlots: [] });

    const slots = timetable.timeSlots.filter(
      (slot) =>
        slot.isActive &&
        slot.courseCode === courseCode &&
        slot.batchId.toString() === batchId &&
        slot.sectionName === sectionName
    );

    res.json({ timeSlots: slots });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching course time slots" });
  }
};
