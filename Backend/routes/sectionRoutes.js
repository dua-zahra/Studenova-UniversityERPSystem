const express = require('express');
const router = express.Router();
const sectionController = require('../controllers/sectionController');

router.get('/:batchId/sections', sectionController.getBatchSections);

module.exports = router;