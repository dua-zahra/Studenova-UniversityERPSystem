const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');
const invoiceController = require('../controllers/invoiceController');

router.get('/courses-for-fees', feeController.getCoursesForFeeAssignment);
router.post('/save-course-fees', feeController.saveCourseFees);
router.get('/assigned-course-fees', feeController.getAssignedCourseFees);
router.get('/existing-fee-structure', feeController.getExistingFeeStructure);
router.get('/fee-structure-by-batch', feeController.getFeeStructureByBatch);
router.get('/structure', feeController.getFeeStructure); 
router.post('/structure', feeController.saveFeeStructure);
router.post('/calculate-student-fees', feeController.calculateStudentFees); 
router.put('/update-installment', feeController.updateInstallmentStatus); 
router.get('/student/:studentId', feeController.getStudentFeeDetails); 
router.get('/student/:studentId/structure', feeController.getStudentFeeStructure);
router.get('/student/:studentId/current-semester', feeController.getCurrentSemesterFees);
router.get('/student/:studentId/overview', feeController.getStudentFeeOverview);
router.get('/students-for-batch', feeController.getStudentsForBatchFee);
router.post('/generate-student-records', feeController.generateStudentFeeRecords);
router.get('/all-student-fees', feeController.getAllStudentFees);
router.post('/recalculate-student-fees', feeController.recalculateStudentFees);
router.post('/update-student-fees', feeController.updateExistingStudentFees);
router.get('/fee-structure-summary', feeController.getFeeStructureSummary);
router.post('/delete-fee-structure', feeController.deleteFeeStructure);
router.post('/invoices/generate-student', invoiceController.generateStudentInvoices);
router.post('/invoices/generate-batch', invoiceController.generateBatchInvoices);
router.post('/invoices/auto-generate-fines', invoiceController.autoGenerateFineInvoices);
router.get('/invoices/student/:studentId', invoiceController.getStudentInvoices);
router.get('/invoices/download/:studentId/:invoiceNumber', invoiceController.downloadInvoice);
router.post('/invoices/mark-paid', invoiceController.markInvoiceAsPaid);
router.post('/invoices/cleanup-duplicates', invoiceController.cleanupDuplicates);
router.post('/invoices/cleanup-duplicate-fines', invoiceController.cleanupDuplicateFines);
router.post('/invoices/generate-active-semester', (req, res) => {
  req.body.semesterType = 'current';
  req.body.includeFines = true;
  return invoiceController.generateBatchInvoices(req, res);
});

router.post('/invoices/generate-past-semesters', (req, res) => {
  req.body.semesterType = 'past';
  req.body.includeFines = true;
  return invoiceController.generateBatchInvoices(req, res);
});

router.post('/invoices/generate-past-current', (req, res) => {
  req.body.semesterType = 'past_current';
  req.body.includeFines = true;
  return invoiceController.generateBatchInvoices(req, res);
});

router.post('/invoices/generate-batch', (req, res) => {
  req.body.semesterType = 'all';
  req.body.includeFines = true;
  return invoiceController.generateBatchInvoices(req, res);
});
router.post('/invoices/generate-current-semester', (req, res) => {
  req.body.semesterType = 'current';
  req.body.includeFines = false;
  return invoiceController.generateBatchInvoices(req, res);
});

router.post('/invoices/cleanup', invoiceController.cleanupInvoiceNumbers);
router.post('/invoices/generate-all-students', invoiceController.generateAllStudentsInvoices);
router.get('/batch-totals', feeController.getBatchFeeTotals);

router.get('/fees/revenue-stats', feeController.getFeeRevenueStats);
module.exports = router;
