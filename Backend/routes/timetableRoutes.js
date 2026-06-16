const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetableController');

router.get('/degree-levels', timetableController.getDegreeLevels);
router.get('/departments/by-degree', timetableController.getDepartmentsByDegree);
router.get('/batches', timetableController.getBatchesByDepartment);

router.get('/published-timetables', timetableController.getPublishedTimetables);

router.get('/batches/:batchId/current-semester-dates', timetableController.getCurrentSemesterDates);
router.get('/batches/:batchId/semesters/:semester/courses', timetableController.getCoursesForTimetable);
router.get('/batches/:batchId/semesters/:semester/timetable', timetableController.getTimetableWithFaculty);

router.post('/batches/:batchId/semesters/:semester/timetable', timetableController.createOrUpdateTimetable);
router.post('/timetables/:timetableId/slots', timetableController.addTimeSlot);
router.put('/timetables/:timetableId/slots/:slotId', timetableController.updateTimeSlot);
router.delete('/timetables/:timetableId/slots/:slotId', timetableController.deleteTimeSlot);

router.get('/timetables/:timetableId/sync-status', timetableController.getSyncStatus);
router.post('/timetables/:timetableId/sync-faculty', timetableController.autoSyncFacultyAssignments);
router.post('/batches/:batchId/semesters/:semester/trigger-sync', timetableController.triggerAutoSyncForBatch);

router.post('/timetables/:timetableId/publish', timetableController.publishTimetable);
router.post('/timetables/:timetableId/republish', timetableController.republishTimetable);
router.get('/timetables/:timetableId/changes-since-publish', timetableController.getChangesSincePublish);

router.delete('/faculty/:facultyId/remove-from-timetables', timetableController.removeFacultyFromAllTimetables);
router.delete('/batches/:batchId/semesters/:semester/courses/:courseCode/sections/:sectionName/remove-from-timetable', timetableController.removeCourseSectionFromTimetable);



router.get('/faculty-timetables/department/:department', timetableController.getFacultyTimetablesByDepartment);
router.get('/faculty-timetables/department/:department', timetableController.getFacultyTimetablesByDepartmentV2); // Use V2 for better performance
router.get('/faculty-timetables/:facultyId', timetableController.getFacultyTimetableById);
module.exports = router;