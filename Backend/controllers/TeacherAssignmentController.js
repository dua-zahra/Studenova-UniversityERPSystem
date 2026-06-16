const express = require('express');
const mongoose = require('mongoose');
const TeacherAssignment = require('../models/TeacherCourseAssignment');
const Batch = require('../models/Batch');
const Faculty = require('../models/Faculty');
const CourseEntry = require('../models/CourseEntry');
const { FacultyAssignmentService } = require('../services/FacultyAssignmentService');
const { isAfter, isBefore, isWithinInterval } = require('date-fns');


exports.getActiveBatches = async (req, res) => {
  try {
    const { degreeLevel, department } = req.query;
    
    const query = { 
      isActive: true,
      graduationStatus: 'pending' 
    };
    if (degreeLevel) query.degreeLevel = degreeLevel.toLowerCase();
    if (department) query.departmentName = department;
    
    const batches = await Batch.find(query)
      .select('batchName departmentName degreeLevel enrollmentYear currentSemester totalSemesters academicCalendar graduationStatus statusCounts totalStudentsEnrolled sections')
      .sort({ enrollmentYear: -1 });
    
    const now = new Date();
    const batchesWithStatus = batches.map(batch => {
      const currentSemesterData = batch.academicCalendar.find(
        sem => sem.semester === batch.currentSemester
      );
      
      return {
        ...batch.toObject(),
        status: batch.graduationStatus,
        currentSemesterName: currentSemesterData?.name || `Semester ${batch.currentSemester}`,
        currentSemesterEndDate: currentSemesterData?.endDate,
        activeStudents: batch.statusCounts?.active || 0,
        totalStudents: batch.totalStudentsEnrolled,
        sectionCount: batch.sections.length
      };
    });
    
    res.json({
      success: true,
      count: batchesWithStatus.length,
      data: batchesWithStatus
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};


exports.getBatchDetails = async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const batch = await Batch.findById(batchId)
      .select('batchName currentSemester totalSemesters sections academicCalendar isActive graduationStatus statusCounts totalStudentsEnrolled departmentName degreeLevel');
    
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
        department: batch.departmentName,
        degreeLevel: batch.degreeLevel,
        totalSemesters: batch.totalSemesters,
        currentSemester: batch.currentSemester,
        sections: batch.sections,
        academicCalendar: batch.academicCalendar,
        isActive: batch.isActive,
        graduationStatus: batch.graduationStatus,
        statusCounts: batch.statusCounts,
        totalStudents: batch.totalStudentsEnrolled
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};


function getSemesterStatus(semesterData) {
  if (!semesterData) return 'unknown';
  
  const now = new Date();
  if (isAfter(now, semesterData.endDate)) return 'past';
  if (isWithinInterval(now, { start: semesterData.startDate, end: semesterData.endDate })) return 'current';
  return 'future';
}


exports.updateTeachingStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { batchId } = req.params;
    
    const batch = await Batch.findById(batchId).session(session);
    if (!batch) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: 'Batch not found' 
      });
    }

    const now = new Date();
    let totalUpdated = 0;

    for (let semester = 1; semester <= batch.totalSemesters; semester++) {
      const semesterData = batch.academicCalendar.find(
        sem => sem.semester === semester
      );
      
      if (semesterData && isAfter(now, semesterData.endDate)) {
        const result = await TeacherAssignment.handleSemesterCompletion(batchId, semester, session);
        if (result) {
          totalUpdated++;
        }
      }
    }

    await session.commitTransaction();
    
    res.json({
      success: true,
      message: `Updated teaching status for ${totalUpdated} semesters`,
      data: { updatedSemesters: totalUpdated }
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

exports.getCoursesForAssignment = async (req, res) => {
  try {
    const { batchId, semester } = req.params;
    const semesterNum = parseInt(semester);
    
    const batch = await Batch.findById(batchId);
    if (!batch || batch.graduationStatus === 'graduated') {
      return res.status(404).json({ 
        success: false,
        message: 'Batch not found or has graduated' 
      });
    }

    const semesterData = batch.academicCalendar.find(
      sem => sem.semester === semesterNum
    );
    
    if (!semesterData) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid semester number' 
      });
    }
    
    const assignment = await TeacherAssignment.getOrCreateBatchAssignment(batchId);
    
    const semesterKey = semesterNum.toString();
    if (!assignment.semesterAssignments.has(semesterKey)) {
      return res.status(404).json({ 
        success: false,
        message: 'Semester not found in assignments' 
      });
    }

    const semesterAssignment = assignment.semesterAssignments.get(semesterKey);
    
    const now = new Date();
    const isSemesterCompleted = isAfter(now, semesterData.endDate);

    const coursesWithAssignments = semesterAssignment.assignments.map(course => {
      return {
        courseName: course.courseName,
        courseCode: course.courseCode,
        creditHrs: course.creditHrs,
        type: course.type || 'Core',
        semesterStatus: getSemesterStatus(semesterData),
        currentSemester: batch.currentSemester,
        sections: batch.sections.map(section => {
          const sectionAssignment = course.sections.find(
            s => s.sectionName === section.name
          );
          
          const activeStudents = section.students.filter(s => s.status === 'active').length;
          const teachingStatus = sectionAssignment?.teachingStatus || 'in-progress';
          
          return {
            sectionName: section.name,
            facultyId: sectionAssignment?.facultyId || null,
            facultyName: sectionAssignment?.facultyName || null,
            assignedAt: sectionAssignment?.assignedAt,
            teachingStatus: teachingStatus,
            status: sectionAssignment?.status || 'inactive',
            studentCount: section.currentStrength,
            activeStudents: activeStudents,
            canAssign: getSemesterStatus(semesterData) === 'current' && 
                      batch.graduationStatus === 'pending' && 
                      !isSemesterCompleted
          };
        })
      };
    });

    res.json({
      success: true,
      data: coursesWithAssignments,
      batchStatus: batch.graduationStatus,
      semesterStatus: getSemesterStatus(semesterData),
      currentSemester: batch.currentSemester
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};


exports.getFacultyAssignments = async (req, res) => {
  try {
    const { facultyId } = req.params;
    
    const faculty = await Faculty.findById(facultyId)
      .select('assignedCourses firstName lastName department designation currentWorkload isActive');
    
    if (!faculty) {
      return res.status(404).json({ 
        success: false,
        message: 'Faculty not found' 
      });
    }
    
    const batchIds = [...new Set(
      faculty.assignedCourses.map(c => c.batchId)
    )];
    
    const batches = await Batch.find({ _id: { $in: batchIds } })
      .select('batchName academicCalendar graduationStatus');
    
    const assignments = faculty.assignedCourses.map(course => {
      const batch = batches.find(b => b._id.equals(course.batchId));
      const semesterData = batch?.academicCalendar.find(
        sem => sem.semester === course.semester
      );
      
      const now = new Date();
      let semesterStatus = 'unknown';
      
      if (batch?.graduationStatus === 'graduated') {
        semesterStatus = 'graduated';
      } else if (semesterData) {
        semesterStatus = 
          isAfter(now, semesterData.endDate) ? 'past' :
          isWithinInterval(now, { start: semesterData.startDate, end: semesterData.endDate }) ? 'current' :
          'future';
      }
      
      return {
        ...course.toObject(),
        batchName: batch?.batchName || 'Unknown',
        batchStatus: batch?.graduationStatus || 'unknown',
        semesterName: semesterData?.name || `Semester ${course.semester}`,
        semesterStatus,
        semesterStartDate: semesterData?.startDate,
        semesterEndDate: semesterData?.endDate,
        isActive: semesterStatus === 'current' && batch?.graduationStatus === 'pending' && course.isActive
      };
    });
    
    res.json({
      success: true,
      data: {
        facultyId: faculty._id,
        facultyName: `${faculty.firstName} ${faculty.lastName}`,
        department: faculty.department,
        designation: faculty.designation,
        isActive: faculty.isActive,
        currentWorkload: faculty.currentWorkload,
        assignments: assignments,
        activeAssignments: assignments.filter(a => a.isActive && a.teachingStatus === 'in-progress').length,
        completedAssignments: assignments.filter(a => a.teachingStatus === 'completed').length
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.advanceSemesters = async (req, res) => {
  try {
    const batches = await Batch.find({ 
      isActive: true, 
      graduationStatus: 'pending' 
    });
    const now = new Date();
    
    const results = await Promise.all(
      batches.map(async batch => {
        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
          const currentSemesterData = batch.academicCalendar.find(
            sem => sem.semester === batch.currentSemester
          );
          
          if (!currentSemesterData || !isAfter(now, currentSemesterData.endDate)) {
            await session.abortTransaction();
            return {
              batchId: batch._id,
              batchName: batch.batchName,
              status: 'not_ready',
              currentSemester: batch.currentSemester
            };
          }
          
          if (batch.currentSemester >= batch.totalSemesters) {
            await batch.markAsGraduated();
            
            for (let sem = 1; sem <= batch.totalSemesters; sem++) {
              await TeacherAssignment.handleSemesterCompletion(batch._id, sem, session);
            }
            
            await TeacherAssignment.handleBatchGraduation(batch._id, session);
            
            await session.commitTransaction();
            return {
              batchId: batch._id,
              batchName: batch.batchName,
              status: 'graduated',
              currentSemester: batch.currentSemester
            };
          }
          
          const previousSemester = batch.currentSemester;
          
          await TeacherAssignment.handleSemesterCompletion(batch._id, previousSemester, session);
          
          batch.currentSemester += 1;
          await batch.save({ session });
          
          const assignment = await TeacherAssignment.getOrCreateBatchAssignment(batch._id);
          assignment.currentSemester = batch.currentSemester;
          
          for (let [semesterKey, semesterAssignment] of assignment.semesterAssignments.entries()) {
            const semesterNum = parseInt(semesterKey);
            const semesterData = batch.academicCalendar.find(s => s.semester === semesterNum);
            
            if (semesterData) {
              if (isAfter(now, semesterData.endDate)) {
                semesterAssignment.status = 'past';
                semesterAssignment.isActive = false;
              } else if (semesterNum === batch.currentSemester) {
                semesterAssignment.status = 'current';
                semesterAssignment.isActive = true;
              } else {
                semesterAssignment.status = 'future';
                semesterAssignment.isActive = false;
              }
              
              assignment.semesterAssignments.set(semesterKey, semesterAssignment);
            }
          }
          
          await assignment.save({ session });
          await session.commitTransaction();
          
          return {
            batchId: batch._id,
            batchName: batch.batchName,
            status: 'advanced',
            fromSemester: previousSemester,
            toSemester: batch.currentSemester
          };
        } catch (err) {
          await session.abortTransaction();
          console.error(`Error advancing batch ${batch.batchName}:`, err);
          return {
            batchId: batch._id,
            batchName: batch.batchName,
            status: 'error',
            error: err.message
          };
        } finally {
          session.endSession();
        }
      })
    );
    
    res.json({
      success: true,
      message: 'Semester advancement processed',
      results
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.checkSemesterAdvancement = async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ 
        success: false,
        message: 'Batch not found' 
      });
    }
    
    const currentSemesterData = batch.academicCalendar.find(
      sem => sem.semester === batch.currentSemester
    );
    
    const now = new Date();
    const canAdvance = currentSemesterData && 
      isAfter(now, currentSemesterData.endDate) &&
      batch.currentSemester < batch.totalSemesters &&
      batch.graduationStatus === 'pending';
    
    res.json({ 
      success: true,
      data: {
        canAdvance,
        currentSemester: batch.currentSemester,
        semesterEndDate: currentSemesterData?.endDate,
        isGraduated: batch.graduationStatus === 'graduated',
        batchStatus: batch.graduationStatus
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getAvailableFaculty = async (req, res) => {
  try {
    const { department, courseCode, exclude } = req.query;
    
    const query = { 
      department,
      isActive: true
    };

    if (exclude) {
      query._id = { $ne: exclude };
    }
    
    let facultyList = await Faculty.find(query)
      .select('firstName lastName employeeId designation currentWorkload assignedCourses isActive')
      .lean();
    
    const availableFaculty = facultyList.map(faculty => {
      const courseCredit = 3; 
      const newWorkload = (faculty.currentWorkload || 0) + courseCredit;
      
      const activeAssignments = faculty.assignedCourses?.filter(c => 
        c.isActive && c.teachingStatus === 'in-progress'
      ) || [];
      
      return {
        ...faculty,
        name: `${faculty.firstName} ${faculty.lastName}`,
        currentWorkload: faculty.currentWorkload || 0,
        currentCourses: activeAssignments.length,
        activeAssignments: activeAssignments,
        isOverloaded: newWorkload > 24,
        available: newWorkload <= 24 && faculty.isActive
      };
    }).filter(faculty => faculty.available);
    
    res.json({
      success: true,
      data: availableFaculty,
      count: availableFaculty.length
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.cleanupSections = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { batchId } = req.params;
    
    const batch = await Batch.findById(batchId).session(session);
    if (!batch) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: 'Batch not found' 
      });
    }

    const currentSections = batch.sections.map(s => s.name);
    const assignment = await TeacherAssignment.findOne({ batchId }).session(session);
    
    if (assignment) {
      for (let [semesterKey, semesterAssignment] of assignment.semesterAssignments.entries()) {
        semesterAssignment.assignments.forEach(course => {
          course.sections = course.sections.filter(section => 
            currentSections.includes(section.sectionName)
          );
        });
        assignment.semesterAssignments.set(semesterKey, semesterAssignment);
      }
      
      await assignment.save({ session });
    }

    await session.commitTransaction();
    res.json({ 
      success: true,
      message: 'Section cleanup completed',
      data: {
        remainingSections: currentSections,
        batchStatus: batch.graduationStatus
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

exports.getFacultyWorkload = async (req, res) => {
  try {
    const { facultyId } = req.params;
    
    const faculty = await Faculty.findById(facultyId)
      .select('firstName lastName currentWorkload assignedCourses department designation isActive');
    
    if (!faculty) {
      return res.status(404).json({ 
        success: false,
        message: 'Faculty not found' 
      });
    }

    const batchIds = [...new Set(faculty.assignedCourses.map(c => c.batchId))];
    const batches = await Batch.find({ _id: { $in: batchIds } })
      .select('batchName academicCalendar graduationStatus');

    const activeAssignments = faculty.assignedCourses
      .filter(c => c.isActive && c.teachingStatus === 'in-progress')
      .map(course => {
        const batch = batches.find(b => b._id.equals(course.batchId));
        const semesterData = batch?.academicCalendar.find(s => s.semester === course.semester);
        const now = new Date();
        const isCompleted = semesterData ? isAfter(now, semesterData.endDate) : false;

        return {
          ...course.toObject(),
          batchName: batch?.batchName || 'Unknown',
          semesterEndDate: semesterData?.endDate,
          isSemesterCompleted: isCompleted,
          canAutoComplete: isCompleted
        };
      });
    
    const completedAssignments = faculty.assignedCourses
      .filter(c => c.teachingStatus === 'completed')
      .map(course => {
        const batch = batches.find(b => b._id.equals(course.batchId));
        return {
          ...course.toObject(),
          batchName: batch?.batchName || 'Unknown'
        };
      });

    const calculatedWorkload = activeAssignments.reduce((total, assignment) => {
      return total + (assignment.creditHrs || 0);
    }, 0);

    res.json({
      success: true,
      data: {
        facultyId: faculty._id,
        facultyName: `${faculty.firstName} ${faculty.lastName}`,
        department: faculty.department,
        designation: faculty.designation,
        isActive: faculty.isActive,
        currentWorkload: faculty.currentWorkload,
        calculatedWorkload,
        maxWorkload: 24,
        activeAssignments,
        completedAssignments,
        activeAssignmentCount: activeAssignments.length,
        completedAssignmentCount: completedAssignments.length,
        workloadPercentage: Math.round((faculty.currentWorkload / 24) * 100),
        needsWorkloadSync: Math.abs(faculty.currentWorkload - calculatedWorkload) > 0.1
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.removeAssignment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { batchId, semester, courseCode, sectionName } = req.params;
    const decodedSectionName = decodeURIComponent(sectionName);
    const semesterNum = parseInt(semester);

    const batch = await Batch.findById(batchId).session(session);
    if (!batch || batch.graduationStatus === 'graduated') {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: 'Batch not found or has graduated' 
      });
    }

    const semesterData = batch.academicCalendar.find(s => s.semester === semesterNum);
    const now = new Date();
    if (semesterData && isAfter(now, semesterData.endDate)) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false,
        message: 'Cannot remove assignments for past semesters' 
      });
    }

    const result = await TeacherAssignment.removeFacultyAssignment(
      batchId,
      semesterNum,
      courseCode,
      decodedSectionName,
      session
    );

    if (result.removedSection.facultyId) {
      try {
        await FacultyAssignmentService.unassignCourse(
          result.removedSection.facultyId,
          {
            batchId,
            semester: semesterNum,
            courseCode,
            sectionName: decodedSectionName,
            creditHrs: result.creditHrs
          },
          session
        );
      } catch (error) {
        console.warn('Faculty assignment removal warning:', error.message);
      }
    }

    await session.commitTransaction();
    
    return res.json({
      success: true,
      message: 'Assignment removed successfully',
      data: {
        courseCode,
        sectionName: decodedSectionName,
        semester: semesterNum,
        batchStatus: batch.graduationStatus
      }
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  } finally {
    session.endSession();
  }
};

exports.assignTeacher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { batchId, semester, courseCode, sectionName } = req.params;
    const { facultyId, allowFutureSemester = false } = req.body;

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      throw new Error('Invalid batch ID format');
    }
    if (!mongoose.Types.ObjectId.isValid(facultyId)) {
      throw new Error('Invalid faculty ID format');
    }

    const semesterNum = parseInt(semester);
    if (isNaN(semesterNum)) {
      throw new Error('Semester must be a number');
    }

    const decodedSectionName = decodeURIComponent(sectionName);

    const batch = await Batch.findById(batchId).session(session);
    if (!batch || batch.graduationStatus === 'graduated') {
      throw new Error('Batch not found or has already graduated');
    }

    if (!batch.sections.some(s => s.name === decodedSectionName)) {
      throw new Error(`Section ${decodedSectionName} not found in batch`);
    }

    const semesterData = batch.academicCalendar?.find(s => s.semester === semesterNum);
    const now = new Date();
    const isSemesterCompleted = semesterData && isAfter(now, semesterData.endDate);
    
    if (!allowFutureSemester && isSemesterCompleted) {
      throw new Error('Cannot modify assignments for completed semesters');
    }

    const faculty = await Faculty.findById(facultyId).session(session);
    if (!faculty) {
      throw new Error('Faculty not found');
    }

    if (!faculty.isActive) {
      throw new Error('Cannot assign inactive faculty member');
    }

    const result = await TeacherAssignment.assignFacultyToSection(
      batchId,
      semesterNum,
      courseCode,
      decodedSectionName,
      facultyId,
      `${faculty.firstName} ${faculty.lastName}`,
      session
    );

    if (result.previousFacultyId && result.previousFacultyId !== facultyId.toString()) {
      await FacultyAssignmentService.unassignCourse(
        result.previousFacultyId,
        {
          batchId,
          semester: semesterNum,
          courseCode,
          sectionName: decodedSectionName,
          creditHrs: result.creditHrs
        },
        session
      );
    }

    if (!result.isSemesterCompleted) {
      await FacultyAssignmentService.assignCourse(
        facultyId,
        {
          batchId,
          batchName: batch.batchName,
          semester: semesterNum,
          courseCode,
          courseName: result.assignment.semesterAssignments.get(semesterNum.toString())
            .assignments.find(c => c.courseCode === courseCode)?.courseName,
          sectionName: decodedSectionName,
          creditHrs: result.creditHrs,
          degreeLevel: batch.degreeLevel,
          department: batch.departmentName,
          batchStatus: batch.graduationStatus,
          teachingStatus: result.teachingStatus
        },
        session
      );
    }

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: 'Teacher assigned successfully',
      data: {
        courseCode,
        courseName: result.assignment.semesterAssignments.get(semesterNum.toString())
          .assignments.find(c => c.courseCode === courseCode)?.courseName,
        sectionName: decodedSectionName,
        facultyId: faculty._id,
        facultyName: `${faculty.firstName} ${faculty.lastName}`,
        semester: semesterNum,
        teachingStatus: result.teachingStatus,
        batchStatus: batch.graduationStatus,
        canTeach: batch.graduationStatus === 'pending' && !result.isSemesterCompleted
      }
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  } finally {
    session.endSession();
  }
};

exports.getBatchSections = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId)
      .select('degreeLevel departmentName totalSemesters batchName currentSemester totalStudentsEnrolled totalSections sections statusCounts graduationStatus');
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const transformedSections = batch.sections.map(section => ({
      name: section.name,
      studentCount: section.currentStrength,
      activeStudents: section.students.filter(s => s.status === 'active').length,
      students: section.students.map(student => ({
        studentId: student.studentId,
        photo: student.photo,
        universityEmail: student.universityEmail,
        contact: student.contact,
        status: student.status
      }))
    }));

    res.json({
      success: true,
      data: {
        degreeLevel: batch.degreeLevel,
        department: batch.departmentName,
        totalSemesters: batch.totalSemesters,
        batchName: batch.batchName,
        currentSemester: batch.currentSemester,
        totalStudents: batch.totalStudentsEnrolled,
        activeStudents: batch.statusCounts?.active || 0,
        totalSections: batch.totalSections,
        graduationStatus: batch.graduationStatus,
        sections: transformedSections
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.getAllFacultyWithTeachingStatus = async (req, res) => {
  try {
    const { department } = req.query;
    
    const query = { isActive: true };
    if (department) query.department = department;
    
    const facultyList = await Faculty.find(query)
      .select('firstName lastName employeeId designation currentWorkload assignedCourses department isActive')
      .lean();
    
    const facultyWithStatus = facultyList.map(faculty => {
      const activeAssignments = faculty.assignedCourses?.filter(
        c => c.isActive && c.teachingStatus === 'in-progress'
      ) || [];
      
      const completedAssignments = faculty.assignedCourses?.filter(
        c => c.teachingStatus === 'completed'
      ) || [];
      
      return {
        ...faculty,
        name: `${faculty.firstName} ${faculty.lastName}`,
        activeAssignmentsCount: activeAssignments.length,
        completedAssignmentsCount: completedAssignments.length,
        activeAssignments: activeAssignments,
        completedAssignments: completedAssignments
      };
    });
    
    res.json({
      success: true,
      data: facultyWithStatus,
      count: facultyWithStatus.length
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.syncFacultyWorkloads = async (req, res) => {
  try {
    const facultyList = await Faculty.find({ isActive: true })
      .select('assignedCourses currentWorkload firstName lastName isActive');

    let syncedCount = 0;
    const results = [];

    for (const faculty of facultyList) {
      const calculatedWorkload = faculty.assignedCourses
        .filter(c => c.isActive && c.teachingStatus === 'in-progress')
        .reduce((total, course) => total + (course.creditHrs || 0), 0);

      if (Math.abs(faculty.currentWorkload - calculatedWorkload) > 0.1) {
        faculty.currentWorkload = calculatedWorkload;
        await faculty.save();
        syncedCount++;
        
        results.push({
          facultyId: faculty._id,
          facultyName: `${faculty.firstName} ${faculty.lastName}`,
          previousWorkload: faculty.currentWorkload,
          newWorkload: calculatedWorkload
        });
      }
    }

    res.json({
      success: true,
      message: `Synced workloads for ${syncedCount} faculty members`,
      data: {
        syncedCount,
        results
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getSemesterAssignmentsOverview = async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ 
        success: false,
        message: 'Batch not found' 
      });
    }

    const assignment = await TeacherAssignment.getOrCreateBatchAssignment(batchId);

    const semesterOverview = [];
    const now = new Date();

    for (let sem = 1; sem <= batch.totalSemesters; sem++) {
      const semesterKey = sem.toString();
      const semesterData = batch.academicCalendar.find(s => s.semester === sem);
      const semesterAssignment = assignment.semesterAssignments.get(semesterKey);
      
      const isCompleted = semesterData ? isAfter(now, semesterData.endDate) : false;
      const isCurrent = semesterData ? 
        isWithinInterval(now, { start: semesterData.startDate, end: semesterData.endDate }) : 
        false;

      let assignedSections = 0;
      let totalSections = 0;
      let assignedFaculty = new Set();

      if (semesterAssignment) {
        semesterAssignment.assignments.forEach(course => {
          course.sections.forEach(section => {
            totalSections++;
            if (section.facultyId) {
              assignedSections++;
              assignedFaculty.add(section.facultyId.toString());
            }
          });
        });
      }

      semesterOverview.push({
        semester: sem,
        semesterName: semesterData?.name || `Semester ${sem}`,
        startDate: semesterData?.startDate,
        endDate: semesterData?.endDate,
        status: isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming',
        assignmentExists: !!semesterAssignment,
        assignedSections,
        totalSections: batch.sections.length * (semesterAssignment?.assignments.length || 0),
        assignedFacultyCount: assignedFaculty.size,
        completionPercentage: totalSections > 0 ? Math.round((assignedSections / totalSections) * 100) : 0,
        canModify: !isCompleted && batch.graduationStatus === 'pending'
      });
    }

    res.json({
      success: true,
      data: {
        batchId: batch._id,
        batchName: batch.batchName,
        currentSemester: batch.currentSemester,
        graduationStatus: batch.graduationStatus,
        totalStudents: batch.totalStudentsEnrolled,
        activeStudents: batch.statusCounts?.active || 0,
        sections: batch.sections.length,
        semesters: semesterOverview
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getBatchSemesterAssignments = async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const assignment = await TeacherAssignment.getOrCreateBatchAssignment(batchId);
    const allAssignments = [];

    for (let [semesterKey, semesterAssignment] of assignment.semesterAssignments.entries()) {
      const semesterNum = parseInt(semesterKey);
      
      semesterAssignment.assignments.forEach(course => {
        course.sections.forEach(section => {
          if (section.facultyId) {
            allAssignments.push({
              batchId: assignment.batchId,
              batchName: assignment.batchName,
              semester: semesterNum,
              semesterStartDate: semesterAssignment.startDate,
              semesterEndDate: semesterAssignment.endDate,
              courseCode: course.courseCode,
              courseName: course.courseName,
              creditHrs: course.creditHrs,
              sectionName: section.sectionName,
              facultyId: section.facultyId,
              facultyName: section.facultyName,
              teachingStatus: section.teachingStatus,
              assignedAt: section.assignedAt,
              degreeLevel: assignment.degreeLevel,
              department: assignment.department
            });
          }
        });
      });
    }

    res.json({
      success: true,
      data: allAssignments,
      count: allAssignments.length
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getBatchAllSemesters = async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const assignment = await TeacherAssignment.getOrCreateBatchAssignment(batchId);
    const batch = await Batch.findById(batchId);
    
    if (!batch) {
      return res.status(404).json({ 
        success: false,
        message: 'Batch not found' 
      });
    }

    const semesterData = [];
    const now = new Date();

    for (let [semesterKey, semesterAssignment] of assignment.semesterAssignments.entries()) {
      const semesterNum = parseInt(semesterKey);
      const academicSemester = batch.academicCalendar.find(s => s.semester === semesterNum);
      
      const isCompleted = academicSemester ? isAfter(now, academicSemester.endDate) : false;
      const isCurrent = academicSemester ? 
        isWithinInterval(now, { start: academicSemester.startDate, end: academicSemester.endDate }) : 
        false;

      let assignedCourses = 0;
      let totalCourses = semesterAssignment.assignments.length;
      let assignedSections = 0;
      let totalSections = totalCourses * batch.sections.length;

      semesterAssignment.assignments.forEach(course => {
        if (course.sections.length > 0) {
          assignedCourses++;
        }
        assignedSections += course.sections.length;
      });

      semesterData.push({
        semester: semesterNum,
        semesterName: academicSemester?.name || `Semester ${semesterNum}`,
        startDate: academicSemester?.startDate,
        endDate: academicSemester?.endDate,
        status: isCompleted ? 'past' : isCurrent ? 'current' : 'future',
        isActive: semesterAssignment.isActive,
        totalCourses,
        assignedCourses,
        totalSections,
        assignedSections,
        completionPercentage: totalSections > 0 ? Math.round((assignedSections / totalSections) * 100) : 0,
        canAssign: !isCompleted && batch.graduationStatus === 'pending'
      });
    }

    res.json({
      success: true,
      data: {
        batchId: batch._id,
        batchName: batch.batchName,
        currentSemester: batch.currentSemester,
        graduationStatus: batch.graduationStatus,
        semesters: semesterData.sort((a, b) => a.semester - b.semester)
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getTeachingStatusSummary = async (req, res) => {
  try {
    const batches = await Batch.find({ 
      isActive: true, 
      graduationStatus: 'pending' 
    });
    
    const summary = {
      totalBatches: batches.length,
      totalActiveAssignments: 0,
      totalCompletedAssignments: 0,
      totalFacultyAssigned: new Set(),
      batches: []
    };
    
    for (const batch of batches) {
      const assignment = await TeacherAssignment.getOrCreateBatchAssignment(batch._id);
      
      let batchActive = 0;
      let batchCompleted = 0;
      const batchFaculty = new Set();
      
      for (let [semesterKey, semesterAssignment] of assignment.semesterAssignments.entries()) {
        semesterAssignment.assignments.forEach(course => {
          course.sections.forEach(section => {
            if (section.facultyId) {
              batchFaculty.add(section.facultyId.toString());
              
              if (section.teachingStatus === 'in-progress') {
                batchActive++;
              } else if (section.teachingStatus === 'completed') {
                batchCompleted++;
              }
            }
          });
        });
      }
      
      summary.batches.push({
        batchId: batch._id,
        batchName: batch.batchName,
        currentSemester: batch.currentSemester,
        activeAssignments: batchActive,
        completedAssignments: batchCompleted,
        facultyCount: batchFaculty.size
      });
      
      summary.totalActiveAssignments += batchActive;
      summary.totalCompletedAssignments += batchCompleted;
      batchFaculty.forEach(facultyId => summary.totalFacultyAssigned.add(facultyId));
    }
    
    summary.totalFacultyAssigned = summary.totalFacultyAssigned.size;
    
    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getActiveBatchAssignments = async (req, res) => {
  try {
    const batches = await Batch.find({ 
      isActive: true, 
      graduationStatus: 'pending' 
    });
    
    const activeAssignments = await Promise.all(
      batches.map(async batch => {
        const assignment = await TeacherAssignment.getOrCreateBatchAssignment(batch._id);
        
        return {
          batchId: batch._id,
          batchName: batch.batchName,
          currentSemester: batch.currentSemester,
          graduationStatus: batch.graduationStatus,
          activeStudents: batch.statusCounts?.active || 0,
          assignment: assignment || null
        };
      })
    );
    
    res.json({
      success: true,
      data: activeAssignments,
      count: activeAssignments.length
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getFacultyRealTimeStatus = async (req, res) => {
  try {
    const { facultyId } = req.params;
    
    const faculty = await Faculty.findById(facultyId)
      .select('firstName lastName isActive currentWorkload assignedCourses');
    
    if (!faculty) {
      return res.status(404).json({ 
        success: false,
        message: 'Faculty not found' 
      });
    }

    const activeAssignments = faculty.assignedCourses.filter(c => 
      c.isActive && c.teachingStatus === 'in-progress'
    );

    res.json({
      success: true,
      data: {
        facultyId: faculty._id,
        facultyName: `${faculty.firstName} ${faculty.lastName}`,
        isActive: faculty.isActive,
        currentWorkload: faculty.currentWorkload,
        activeAssignmentsCount: activeAssignments.length,
        hasActiveAssignments: activeAssignments.length > 0
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

module.exports = exports;
