const mongoose = require('mongoose');
const Batch = require('../models/Batch');
const Student = require('../models/Student');
const { addDays, isWeekend, nextMonday, previousFriday, isAfter } = require('date-fns');

const generateSectionLetter = (index) => {
  return String.fromCharCode(65 + index); 
};

exports.createBatch = async (req, res) => {
  try {
    const { departmentName, degreeLevel, enrollmentYear, semesterStart, maxStudents, minStudents, totalSemesters, admissionStartDate, admissionEndDate } = req.body;

    if (!departmentName || !degreeLevel || !enrollmentYear || !semesterStart) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const department = await mongoose.model('Department').findOne({
      departmentName: { $regex: new RegExp(`^${departmentName}$`, 'i') },
      degreeLevel: { $regex: new RegExp(`^${degreeLevel}$`, 'i') }
    });

    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    const batchName = `${department.departmentCode}-${semesterStart.toUpperCase()}-${enrollmentYear}`;
    const existingBatch = await Batch.findOne({ batchName });
    if (existingBatch) {
      return res.status(400).json({ success: false, message: 'Batch already exists' });
    }

    const durations = { undergraduate: 4, graduate: 2, phd: 4 };
    const degreeLevelLower = degreeLevel.toLowerCase();
    const degreeDuration = durations[degreeLevelLower] || 4;
    const gradYear = Number(enrollmentYear) + degreeDuration;

    const batch = new Batch({
      batchName,
      departmentName: department.departmentName,
      departmentCode: department.departmentCode,
      department: department._id,
      degreeLevel: degreeLevelLower,
      enrollmentYear: Number(enrollmentYear),
      graduationYear: gradYear,
      semesterStart: semesterStart.toLowerCase(),
      totalSemesters: totalSemesters || degreeDuration * 2,
      sectionRules: {
        maxStudents: maxStudents || 20,
        minStudents: minStudents || 15,
        assignmentMethod: 'enrollmentDate'
      },
      admissionStartDate: admissionStartDate || null,
      admissionEndDate: admissionEndDate || null,
      sections: [],  
      totalSections: 0,
      totalStudentsEnrolled: 0,
      statusCounts: {
        active: 0,
        inactive: 0,
        dropped: 0,
        graduated: 0,
        suspended: 0
      }
    });

    await batch.save();

    res.status(201).json({ success: true, data: batch, message: 'Batch created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllBatches = async (req, res) => {
  try {
    console.log('Fetching batches with query:', req.query); 
    
    const batches = await Batch.find(req.query)
      .sort({ enrollmentYear: -1 })
      .populate('department', 'departmentName departmentCode')
      .lean(); 
    
    console.log('Found batches:', batches.length);
    
    if (!batches || batches.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No batches found' 
      });
    }

    const batchesWithStatus = batches.map(batch => ({
      ...batch,
      status: batch.graduationStatus === 'graduated' ? 'graduated' : 
              batch.enrollmentStatus === 'closed' ? 'closed' : 'active'
    }));

    res.json({ 
      success: true, 
      count: batches.length, 
      data: batchesWithStatus 
    });
  } catch (err) {
    console.error('Error fetching batches:', err); 
    res.status(500).json({ 
      success: false, 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    });
  }
};

exports.getBatchById = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id)
      .populate('department', 'departmentName departmentCode');
    
    if (!batch) {
      return res.status(404).json({ 
        success: false, 
        message: 'Batch not found' 
      });
    }

    res.json({ 
      success: true, 
      data: batch 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

exports.updateBatch = async (req, res) => {
  try {
    if (req.body.sectionRules) {
      delete req.body.sectionRules;
    }

    const updatedBatch = await Batch.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedBatch) {
      return res.status(404).json({ 
        success: false, 
        message: 'Batch not found' 
      });
    }

    res.json({ 
      success: true, 
      data: updatedBatch 
    });
  } catch (err) {
    res.status(400).json({ 
      success: false, 
      message: err.message 
    });
  }
};

exports.getBatchSections = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id)
      .select('batchName sections totalStudentsEnrolled sectionRules statusCounts');
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    res.json({
      success: true,
      data: {
        batchName: batch.batchName,
        totalStudents: batch.totalStudentsEnrolled,
        statusBreakdown: batch.statusCounts,
        activeStudents: batch.statusCounts.active,
        maxPerSection: batch.sectionRules.maxStudents,
        minPerSection: batch.sectionRules.minStudents,
        assignmentMethod: batch.sectionRules.assignmentMethod,
        sections: batch.sections.map(s => ({
          name: s.name,
          studentCount: s.currentStrength,
          students: s.students.map(st => ({
            id: st.studentId,
            name: `${st.firstName} ${st.lastName}`,
            email: st.universityEmail,
            enrollmentDate: st.enrollmentDate,
            status: st.status
          }))
        })),
        distributionSummary: {
          average: (batch.totalStudentsEnrolled / batch.sections.length).toFixed(1),
          min: Math.min(...batch.sections.map(s => s.currentStrength)),
          max: Math.max(...batch.sections.map(s => s.currentStrength))
        }
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.deleteBatch = async (req, res) => {
  try {
    const batch = await Batch.findByIdAndDelete(req.params.id);
    
    if (!batch) {
      return res.status(404).json({ 
        success: false, 
        message: 'Batch not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Batch deleted successfully' 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

exports.getBatchesOpenForEnrollment = async (req, res) => {
  try {
    const { department, degreeLevel } = req.query;
    const currentDate = new Date();
    
    console.log('Searching for batches with params:', {
      department,
      degreeLevel,
      currentDate
    });

    const query = {
      departmentName: department,
      degreeLevel: degreeLevel?.toLowerCase(),
      enrollmentStatus: 'open',
      graduationStatus: { $ne: 'graduated' }, // Only exclude graduated batches
      $or: [
        { admissionEndDate: { $gte: currentDate } },
        { admissionEndDate: null }
      ]
    };

    console.log('Query:', JSON.stringify(query, null, 2));

    const batches = await Batch.find(query)
      .sort({ enrollmentYear: -1, semesterStart: 1 })
      .lean();

    console.log('Found batches:', batches.length);
    console.log('Batch details:', batches.map(b => ({
      id: b._id,
      name: b.batchName,
      enrollmentStatus: b.enrollmentStatus,
      graduationStatus: b.graduationStatus,
      admissionEndDate: b.admissionEndDate
    })));

    res.status(200).json({
      success: true,
      data: batches
    });
  } catch (err) {
    console.error('Error fetching batches:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.advanceBatchSemester = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    if (batch.graduationStatus === 'graduated') {
      return res.status(400).json({
        success: false,
        message: 'Batch has already graduated'
      });
    }

    const wasAdvanced = await batch.checkAndAdvanceSemester();
    
    if (!wasAdvanced) {
      return res.json({
        success: true,
        message: 'Batch not ready for advancement',
        data: batch
      });
    }

    if (batch.graduationStatus === 'graduated') {
      return res.json({
        success: true,
        message: 'Batch has graduated',
        data: batch
      });
    }

    res.json({
      success: true,
      message: 'Batch advanced to next semester',
      data: batch
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.triggerRebalance = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const result = await batch.rebalanceSections(session);
      await session.commitTransaction();

      res.json({
        success: true,
        rebalanced: result.rebalanced,
        studentsMoved: result.changes,
        distribution: batch.sections.map(s => ({
          name: s.name,
          students: s.currentStrength
        }))
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.closeExpiredBatchEnrollments = async () => {
  try {
    const currentDate = new Date();
    const result = await Batch.updateMany(
      {
        admissionEndDate: { $lt: currentDate },
        enrollmentStatus: 'open',
        graduationStatus: 'active' 
      },
      { $set: { enrollmentStatus: 'closed' } }
    );
    
    console.log(`Closed enrollment for ${result.nModified} batches`);
    return result;
  } catch (err) {
    console.error('Error closing batch enrollments:', err);
    throw err;
  }
};

exports.getCurrentSemesterDates = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId)
      .select('academicCalendar currentSemester');
    
    if (!batch) {
      return res.status(404).json({ 
        success: false, 
        message: 'Batch not found' 
      });
    }

    const currentSemester = batch.academicCalendar.find(
      s => s.semester === batch.currentSemester
    );

    res.json({
      success: true,
      data: {
        currentSemester: batch.currentSemester,
        startDate: currentSemester?.startDate,
        endDate: currentSemester?.endDate
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: err.message 
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

exports.getBatchCount = async (req, res) => {
  try {
    const count = await Batch.countDocuments();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getGraduatedBatches = async (req, res) => {
  try {
    const batches = await Batch.find({ graduationStatus: 'graduated' })
      .sort({ enrollmentYear: -1 })
      .populate('department', 'departmentName departmentCode');
    
    res.json({
      success: true,
      count: batches.length,
      data: batches
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.updateStudentStatusInBatch = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { batchId, studentId } = req.params;
    const { oldStatus, newStatus } = req.body;

    if (!oldStatus || !newStatus) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Old status and new status are required'
      });
    }

    const batch = await Batch.findById(batchId).session(session);
    if (!batch) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const updated = await batch.updateStudentStatus(studentId, oldStatus, newStatus, session);
    
    if (!updated) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Student not found in batch'
      });
    }

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Student status updated successfully',
      data: {
        totalStudentsEnrolled: batch.totalStudentsEnrolled,
        statusCounts: batch.statusCounts
      }
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: err.message
    });
  } finally {
    session.endSession();
  }
};

exports.removeStudentFromBatch = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { batchId, studentId } = req.params;
    const { status } = req.body;

    const batch = await Batch.findById(batchId).session(session);
    if (!batch) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const removed = await batch.removeStudent(studentId, status, session);
    
    if (!removed) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Student not found in batch'
      });
    }

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Student removed from batch successfully',
      data: {
        totalStudentsEnrolled: batch.totalStudentsEnrolled,
        statusCounts: batch.statusCounts,
        totalSections: batch.totalSections
      }
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: err.message
    });
  } finally {
    session.endSession();
  }
};

exports.getBatchEnrollmentStats = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id)
      .select('batchName totalStudentsEnrolled statusCounts sections');
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const activeStudentsBySection = batch.sections.map(section => ({
      section: section.name,
      totalStudents: section.currentStrength,
      activeStudents: section.students.filter(s => s.status === 'active').length,
      inactiveStudents: section.students.filter(s => s.status === 'inactive').length,
      droppedStudents: section.students.filter(s => s.status === 'dropped').length,
      graduatedStudents: section.students.filter(s => s.status === 'graduated').length,
      suspendedStudents: section.students.filter(s => s.status === 'suspended').length
    }));

    res.json({
      success: true,
      data: {
        batchName: batch.batchName,
        totalStudentsEnrolled: batch.totalStudentsEnrolled,
        statusBreakdown: batch.statusCounts,
        sectionBreakdown: activeStudentsBySection,
        activePercentage: ((batch.statusCounts.active / batch.totalStudentsEnrolled) * 100).toFixed(1),
        utilizationRate: ((batch.statusCounts.active / (batch.sections.length * batch.sectionRules.maxStudents)) * 100).toFixed(1)
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.getBatchStudentsWithSections = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { status, section, includeInactive = false } = req.query;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID is required'
      });
    }

    const batch = await Batch.findById(batchId)
      .select('batchName departmentName degreeLevel sections totalStudentsEnrolled sectionRules statusCounts currentSemester graduationStatus enrollmentStatus');

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const studentFilter = {
      batch: batchId
    };

    if (status) {
      studentFilter.status = status;
    } else if (!includeInactive) {
      studentFilter.status = 'active';
    }

    if (section) {
      studentFilter.section = section;
    }

    const students = await Student.find(studentFilter)
      .select('studentId firstName lastName universityEmail contactNumber currentSemester status section scholarshipPercentage createdAt')
      .sort({ section: 1, firstName: 1 });

    const sectionsData = batch.sections.map(section => {
      const sectionStudents = students.filter(student => 
        student.section === section.name
      );

      return {
        sectionName: section.name,
        currentStrength: section.currentStrength,
        maxStudents: batch.sectionRules.maxStudents,
        utilization: ((section.currentStrength / batch.sectionRules.maxStudents) * 100).toFixed(1),
        students: sectionStudents.map(student => ({
          studentId: student.studentId,
          name: `${student.firstName} ${student.lastName}`,
          email: student.universityEmail,
          contactNumber: student.contactNumber,
          currentSemester: student.currentSemester,
          status: student.status,
          scholarshipPercentage: student.scholarshipPercentage,
          enrollmentDate: student.createdAt
        })),
        studentCount: sectionStudents.length,
        statusBreakdown: {
          active: sectionStudents.filter(s => s.status === 'active').length,
          inactive: sectionStudents.filter(s => s.status === 'inactive').length,
          dropped: sectionStudents.filter(s => s.status === 'dropped').length,
          graduated: sectionStudents.filter(s => s.status === 'graduated').length,
          suspended: sectionStudents.filter(s => s.status === 'suspended').length
        }
      };
    });

    const unassignedStudents = students.filter(student => 
      !student.section || student.section === ''
    );

    const response = {
      success: true,
      data: {
        batch: {
          id: batch._id,
          name: batch.batchName,
          department: batch.departmentName,
          degreeLevel: batch.degreeLevel,
          currentSemester: batch.currentSemester,
          graduationStatus: batch.graduationStatus,
          enrollmentStatus: batch.enrollmentStatus,
          totalStudents: batch.totalStudentsEnrolled,
          sectionRules: batch.sectionRules,
          statusCounts: batch.statusCounts
        },
        sections: sectionsData,
        unassignedStudents: {
          count: unassignedStudents.length,
          students: unassignedStudents.map(student => ({
            studentId: student.studentId,
            name: `${student.firstName} ${student.lastName}`,
            email: student.universityEmail,
            status: student.status,
            currentSemester: student.currentSemester
          }))
        },
        summary: {
          totalSections: batch.sections.length,
          totalStudents: students.length,
          assignedStudents: students.length - unassignedStudents.length,
          unassignedStudents: unassignedStudents.length,
          averageSectionSize: (students.length / batch.sections.length).toFixed(1),
          minSectionSize: Math.min(...sectionsData.map(s => s.studentCount)),
          maxSectionSize: Math.max(...sectionsData.map(s => s.studentCount)),
          overallUtilization: ((students.length / (batch.sections.length * batch.sectionRules.maxStudents)) * 100).toFixed(1)
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching batch students with sections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch batch students: ' + error.message
    });
  }
};

exports.getStudentsBySection = async (req, res) => {
  try {
    const { batchId, sectionName } = req.params;
    const { status } = req.query;

    if (!batchId || !sectionName) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID and Section Name are required'
      });
    }

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const sectionExists = batch.sections.some(s => s.name === sectionName);
    if (!sectionExists) {
      return res.status(404).json({
        success: false,
        message: 'Section not found in this batch'
      });
    }

    const studentFilter = {
      batch: batchId,
      section: sectionName
    };

    if (status) {
      studentFilter.status = status;
    }

    const students = await Student.find(studentFilter)
      .select('studentId firstName lastName universityEmail contactNumber currentSemester status scholarshipPercentage photoPath createdAt')
      .sort({ firstName: 1 });

    const section = batch.sections.find(s => s.name === sectionName);

    res.json({
      success: true,
      data: {
        batch: {
          id: batch._id,
          name: batch.batchName,
          department: batch.departmentName
        },
        section: {
          name: sectionName,
          currentStrength: section.currentStrength,
          maxStudents: batch.sectionRules.maxStudents,
          utilization: ((section.currentStrength / batch.sectionRules.maxStudents) * 100).toFixed(1)
        },
        students: students.map(student => ({
          studentId: student.studentId,
          name: `${student.firstName} ${student.lastName}`,
          email: student.universityEmail,
          contactNumber: student.contactNumber,
          currentSemester: student.currentSemester,
          status: student.status,
          scholarshipPercentage: student.scholarshipPercentage,
          enrollmentDate: student.createdAt,
          photo: student.photoPath
        })),
        summary: {
          totalStudents: students.length,
          statusBreakdown: {
            active: students.filter(s => s.status === 'active').length,
            inactive: students.filter(s => s.status === 'inactive').length,
            dropped: students.filter(s => s.status === 'dropped').length,
            graduated: students.filter(s => s.status === 'graduated').length,
            suspended: students.filter(s => s.status === 'suspended').length
          },
          averageScholarship: students.length > 0 ? 
            (students.reduce((sum, s) => sum + (s.scholarshipPercentage || 0), 0) / students.length).toFixed(1) : 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching section students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch section students: ' + error.message
    });
  }
};