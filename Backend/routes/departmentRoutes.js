const express = require('express');
const router = express.Router();
const { createDepartment ,getDepartmentsByDegreeLevel,getDepartmentCount} = require('../controllers/departmentController');
router.get('/count', getDepartmentCount);

router.post('/', createDepartment);

router.get('/by-degree', getDepartmentsByDegreeLevel);
module.exports = router;
