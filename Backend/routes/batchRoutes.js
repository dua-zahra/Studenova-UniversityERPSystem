const express = require('express');
const batchController = require('../controllers/batchController');
const router = express.Router();

router.get('/count', batchController.getBatchCount);

router.post('/', batchController.createBatch);
// router.patch('/:id/graduate', batchController.markBatchAsGraduated);
router.get('/', batchController.getAllBatches);
// router.get('/active', batchController.getAllActiveBatches);
router.get('/:id', batchController.getBatchById);
router.put('/:id', batchController.updateBatch);
router.get('/graduated', batchController.getGraduatedBatches);
router.delete('/:id', batchController.deleteBatch);
router.get('/open/enrollment', batchController.getBatchesOpenForEnrollment); 
router.get('/:batchId/sections', batchController.getBatchSections);
router.post('/close-expired-enrollments', batchController.closeExpiredBatchEnrollments); 
router.post('/:id/advance-semester', batchController.advanceBatchSemester);
router.get('/:batchId/calendar', batchController.getBatchAcademicCalendar);
router.get('/:batchId/students/sections', batchController.getBatchStudentsWithSections);
router.get('/:batchId/sections/:sectionName/students', batchController.getStudentsBySection);
module.exports = router;