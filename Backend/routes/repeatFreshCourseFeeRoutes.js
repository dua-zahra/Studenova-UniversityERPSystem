const express = require('express');
const router = express.Router();
const RepeatFreshCourseFeeController = require('../controllers/repeatFreshCourseFeeController');

router.post('/', RepeatFreshCourseFeeController.createCourseFee);
router.get('/', RepeatFreshCourseFeeController.getCourseFees);
router.get('/stats', RepeatFreshCourseFeeController.getCourseFeeStats);

router.get('/student/:studentId', RepeatFreshCourseFeeController.getStudentCourseFees);

router.get('/:id', RepeatFreshCourseFeeController.getCourseFeeById);
router.put('/:id', RepeatFreshCourseFeeController.updateCourseFee);
router.delete('/:id', RepeatFreshCourseFeeController.deleteCourseFee);
router.post('/:id/payment', RepeatFreshCourseFeeController.recordPayment);
router.get('/:id/invoice', RepeatFreshCourseFeeController.generateInvoice);

module.exports = router;