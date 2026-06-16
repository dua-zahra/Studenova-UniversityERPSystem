const Department = require('../models/Department');

exports.createDepartment = async (req, res) => {
  try {
    let { degreeLevel, departmentName, departmentCode } = req.body;

    if (!degreeLevel || !departmentName || !departmentCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    degreeLevel = degreeLevel.trim();
    departmentName = departmentName.trim().toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    departmentCode = departmentCode.trim().toUpperCase();

    const alphaOnly = /^[A-Za-z]+$/;
    const alphaWithSpace = /^[A-Za-z ]+$/;

    if (!alphaWithSpace.test(departmentName)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Department name must contain only letters and spaces' 
      });
    }

    if (!alphaOnly.test(departmentCode)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Department code must contain only letters' 
      });
    }

    const existingCode = await Department.findOne({ departmentCode });
    if (existingCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Department code already exists' 
      });
    }

    const existingName = await Department.findOne({ 
      degreeLevel, 
      departmentName 
    });
    if (existingName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Department name already exists for this degree level' 
      });
    }

    const department = await Department.create({ 
      degreeLevel, 
      departmentName, 
      departmentCode 
    });

    res.status(201).json({ 
      success: true, 
      department 
    });

  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Duplicate entry detected' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};
exports.getDepartmentsByDegreeLevel = async (req, res) => {
  try {
    const { degreeLevel } = req.query;

    if (!degreeLevel) {
      return res.status(400).json({ 
        message: 'degreeLevel is required' 
      });
    }

    const departments = await Department.find({ degreeLevel })
      .select('departmentName departmentCode _id');
      
    res.json({ departments });
  } catch (error) {
    res.status(500).json({ 
      message: 'Internal server error' 
    });
  }
};
exports.getBatchAcademicCalendar = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId)
      .select('batchName academicCalendar currentSemester');
    
    if (!batch) {
      return res.status(404).json({ 
        success: false, 
        message: 'Batch not found' 
      });
    }

    res.json({
      success: true,
      batchName: batch.batchName,
      currentSemester: batch.currentSemester,
      academicCalendar: batch.academicCalendar
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};
exports.getDepartmentCount = async (req, res) => {
  try {
    const count = await Department.countDocuments();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};