const express = require('express');
const router = express.Router();
const UniversityExpenseController = require('../controllers/universityExpenseController');

router.post('/student-expense', UniversityExpenseController.createStudentExpense);
router.get('/students-by-batch', UniversityExpenseController.getStudentsByBatch);
router.get('/student-history/:studentId', UniversityExpenseController.getStudentExpenseHistory);

router.get('/invoices/student/:studentId', UniversityExpenseController.getStudentInvoices);
router.get('/invoices/:id/:invoiceNumber', UniversityExpenseController.getInvoiceDetails);
router.get('/invoices/:id/:invoiceNumber/download', UniversityExpenseController.generateIndividualInvoice);
router.post('/invoices/:id/:invoiceNumber/payment', UniversityExpenseController.recordInvoicePayment);

router.get('/expenses', UniversityExpenseController.getAllExpenses);
router.get('/expenses/:id', UniversityExpenseController.getExpenseById);
router.put('/expenses/:id', UniversityExpenseController.updateExpense);
router.delete('/expenses/:id', UniversityExpenseController.deleteExpense);
router.post('/expenses/:id/payment', UniversityExpenseController.recordPayment);

router.get('/invoices/:id', UniversityExpenseController.getInvoiceData);
router.get('/invoices/:id/download', UniversityExpenseController.generateInvoice);

router.get('/expenses/revenue-stats', UniversityExpenseController.getExpenseRevenueStats);
module.exports = router;

