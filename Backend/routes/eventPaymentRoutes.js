const express = require('express');
const router = express.Router();
const eventPaymentController = require('../controllers/eventPaymentController');
const dashboardController = require('../controllers/dashboardController');
router.post('/', eventPaymentController.createEventPayment);
router.get('/', eventPaymentController.getEventPayments);
router.get('/:id', eventPaymentController.getEventPaymentDetails);
router.put('/:id/status', eventPaymentController.updateEventPaymentStatus);
router.post('/:id/record-payment', eventPaymentController.recordEventPayment);
router.delete('/:id', eventPaymentController.deleteEventPayment);
router.get('/student/:studentId', eventPaymentController.getStudentEventPayments);


router.get('/:id/invoice/:studentId', eventPaymentController.generateEventInvoice);
router.get('/:id/invoices/all', eventPaymentController.downloadAllEventInvoices);




router.get('/dashboard/revenue-stats', dashboardController.getDashboardRevenueStats);
router.get('/events/revenue-stats', eventPaymentController.getEventRevenueStats);
router.get('/events/upcoming', eventPaymentController.getUpcomingEvents);
module.exports = router;