const Faculty = require('../models/Faculty');
const mongoose = require('mongoose');
const { isAfter, isWithinInterval } = require('date-fns');

class FacultyAssignmentService {
 
  static async assignCourse(facultyId, assignmentData, session = null) {
    try {
      const { 
        batchId, 
        batchName, 
        semester, 
        courseCode, 
        courseName, 
        sectionName, 
        creditHrs,
        degreeLevel,
        department,
        batchStatus,
        teachingStatus = 'in-progress'
      } = assignmentData;
      
      const facultyExists = await Faculty.exists({ _id: facultyId }).session(session);
      if (!facultyExists) {
        throw new Error('Faculty not found');
      }

      const existingAssignment = await Faculty.findOne({
        _id: facultyId,
        'assignedCourses': {
          $elemMatch: {
            batchId: new mongoose.Types.ObjectId(batchId),
            semester: semester,
            courseCode: courseCode,
            sectionName: sectionName,
            isActive: true,
            teachingStatus: 'in-progress'
          }
        }
      }).session(session);

      if (existingAssignment) {
        throw new Error('This assignment already exists for the faculty member');
      }

      if (teachingStatus === 'in-progress') {
        await this.validateFacultyAvailability(facultyId, creditHrs);
      }

      const isActive = teachingStatus === 'in-progress';

      const update = {
        $push: {
          assignedCourses: {
            batchId,
            batchName,
            semester,
            courseCode,
            courseName,
            sectionName,
            creditHrs,
            degreeLevel,
            department,
            batchStatus: batchStatus || 'pending',
            teachingStatus: teachingStatus,
            isActive: isActive,
            assignedAt: new Date()
          }
        }
      };

      if (isActive) {
        update.$inc = { currentWorkload: creditHrs };
      }

      const options = { 
        new: true,
        runValidators: true 
      };
      
      if (session) options.session = session;

      const updatedFaculty = await Faculty.findByIdAndUpdate(facultyId, update, options);
      
      await this.cleanupFacultyAssignments(facultyId, session);
      
      return updatedFaculty;
    } catch (error) {
      console.error('Error in assignCourse:', error);
      throw error;
    }
  }

  static async unassignCourse(facultyId, assignmentData, session = null) {
    try {
      const { 
        batchId, 
        semester, 
        courseCode, 
        sectionName,
        creditHrs 
      } = assignmentData;
      
      const faculty = await Faculty.findById(facultyId).session(session);
      if (!faculty) {
        console.warn(`Faculty ${facultyId} not found - skipping unassignment`);
        return null;
      }

      const assignmentIndex = faculty.assignedCourses.findIndex(course =>
        course.batchId.toString() === batchId.toString() &&
        course.semester === semester &&
        course.courseCode === courseCode &&
        course.sectionName === sectionName &&
        course.isActive
      );

      if (assignmentIndex === -1) {
        console.warn('Active assignment not found for removal');
        return null;
      }

      faculty.assignedCourses[assignmentIndex].isActive = false;
      faculty.assignedCourses[assignmentIndex].teachingStatus = 'removed';
      faculty.assignedCourses[assignmentIndex].removedAt = new Date();
      
      if (faculty.assignedCourses[assignmentIndex].teachingStatus === 'in-progress') {
        faculty.currentWorkload = Math.max(0, faculty.currentWorkload - creditHrs);
      }

      await faculty.save({ session });
      console.log(`Successfully removed assignment for faculty ${facultyId}`);
      
      return faculty;
    } catch (error) {
      console.error('Error in unassignCourse:', error);
      throw error;
    }
  }

  static async completeCourseAssignment(facultyId, assignmentData, session = null) {
    try {
      const { 
        batchId, 
        semester, 
        courseCode, 
        sectionName,
        creditHrs 
      } = assignmentData;
      
      const faculty = await Faculty.findById(facultyId).session(session);
      if (!faculty) {
        throw new Error('Faculty not found');
      }

      const assignmentIndex = faculty.assignedCourses.findIndex(course =>
        course.batchId.toString() === batchId.toString() &&
        course.semester === semester &&
        course.courseCode === courseCode &&
        course.sectionName === sectionName &&
        course.isActive &&
        course.teachingStatus === 'in-progress'
      );

      if (assignmentIndex === -1) {
        console.warn('Active in-progress assignment not found for completion');
        return null;
      }

      faculty.assignedCourses[assignmentIndex].teachingStatus = 'completed';
      faculty.assignedCourses[assignmentIndex].isActive = false;
      faculty.assignedCourses[assignmentIndex].completedAt = new Date();
      
      faculty.currentWorkload = Math.max(0, faculty.currentWorkload - creditHrs);

      await faculty.save({ session });
      console.log(`Successfully completed assignment for faculty ${facultyId}`);
      
      return faculty;
    } catch (error) {
      console.error('Error in completeCourseAssignment:', error);
      throw error;
    }
  }

  static async getFacultyWorkload(facultyId, showAll = false) {
    try {
      const faculty = await Faculty.findById(facultyId)
        .select('firstName lastName assignedCourses currentWorkload department designation degreeLevel')
        .populate({
          path: 'assignedCourses.batchId',
          select: 'batchName currentSemester academicCalendar graduationStatus'
        });
      
      if (!faculty) {
        throw new Error('Faculty not found');
      }

      const batchIds = [...new Set(faculty.assignedCourses.map(c => c.batchId))];
      const Batch = mongoose.model('Batch');
      const batches = await Batch.find({ _id: { $in: batchIds } })
        .select('academicCalendar graduationStatus batchName');

      const filteredAssignments = showAll 
        ? faculty.assignedCourses
        : faculty.assignedCourses.filter(c => c.isActive || c.teachingStatus === 'completed');

      const assignments = filteredAssignments.map(course => {
        const batch = batches.find(b => b._id.equals(course.batchId));
        const semesterData = batch?.academicCalendar?.find(s => s.semester === course.semester);
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

        const shouldBeCompleted = semesterStatus === 'past' || batch?.graduationStatus === 'graduated';
        const needsStatusUpdate = course.teachingStatus === 'in-progress' && shouldBeCompleted;

        return {
          _id: course._id,
          batchId: course.batchId,
          batchName: course.batchName || batch?.batchName,
          semester: course.semester,
          semesterName: this.getSemesterName(batch, course.semester),
          semesterStatus: semesterStatus,
          courseCode: course.courseCode,
          courseName: course.courseName,
          sectionName: course.sectionName,
          creditHrs: course.creditHrs,
          degreeLevel: course.degreeLevel,
          department: course.department,
          assignedAt: course.assignedAt,
          removedAt: course.removedAt,
          completedAt: course.completedAt,
          teachingStatus: course.teachingStatus,
          isActive: course.isActive,
          batchStatus: course.batchStatus || batch?.graduationStatus,
          isCurrent: batch?.currentSemester === course.semester,
          needsStatusUpdate,
          semesterEndDate: semesterData?.endDate,
          canRemove: course.teachingStatus === 'in-progress' && course.isActive && semesterStatus !== 'past'
        };
      });
      
      const calculatedWorkload = faculty.assignedCourses
        .filter(c => c.isActive && c.teachingStatus === 'in-progress')
        .reduce((sum, course) => sum + course.creditHrs, 0);

 
      const activeAssignments = faculty.assignedCourses.filter(c => 
        c.isActive && c.teachingStatus === 'in-progress'
      );
      
      const completedAssignments = faculty.assignedCourses.filter(c => 
        c.teachingStatus === 'completed'
      );

      const removedAssignments = faculty.assignedCourses.filter(c => 
        c.teachingStatus === 'removed'
      );

      return {
        facultyId: faculty._id,
        facultyName: `${faculty.firstName} ${faculty.lastName}`,
        department: faculty.department,
        degreeLevel: faculty.degreeLevel,
        designation: faculty.designation,
        currentWorkload: faculty.currentWorkload,
        calculatedWorkload,
        maxWorkload: 24,
        workloadPercentage: Math.round((faculty.currentWorkload / 24) * 100),
        needsWorkloadSync: Math.abs(faculty.currentWorkload - calculatedWorkload) > 0.1,
        activeAssignmentsCount: activeAssignments.length,
        completedAssignmentsCount: completedAssignments.length,
        removedAssignmentsCount: removedAssignments.length,
        totalAssignmentsCount: faculty.assignedCourses.length,
        assignments: assignments.sort((a, b) => {
          if (a.semester !== b.semester) return a.semester - b.semester;
          return a.courseCode.localeCompare(b.courseCode);
        }),
        summary: {
          inProgress: activeAssignments.length,
          completed: completedAssignments.length,
          removed: removedAssignments.length,
          needsUpdate: assignments.filter(a => a.needsStatusUpdate).length
        }
      };
    } catch (error) {
      console.error('Error in getFacultyWorkload:', error);
      throw error;
    }
  }

 
  static getSemesterName(batch, semesterNumber) {
    if (!batch?.academicCalendar) return `Semester ${semesterNumber}`;
    const semester = batch.academicCalendar.find(s => s.semester === semesterNumber);
    return semester?.name || `Semester ${semesterNumber}`;
  }


  static async validateFacultyAvailability(facultyId, newCreditHrs) {
    try {
      const faculty = await Faculty.findById(facultyId)
        .select('currentWorkload');
      
      if (!faculty) {
        throw new Error('Faculty not found');
      }

      if (faculty.currentWorkload + newCreditHrs > 24) {
        throw new Error(`Faculty workload would exceed maximum limit (current: ${faculty.currentWorkload}, new: ${newCreditHrs})`);
      }

      return true;
    } catch (error) {
      console.error('Error in validateFacultyAvailability:', error);
      throw error;
    }
  }

  static async cleanupFacultyAssignments(facultyId, session = null) {
    try {
      const faculty = await Faculty.findById(facultyId).session(session);
      if (!faculty) {
        throw new Error('Faculty not found');
      }

      const actualWorkload = faculty.assignedCourses
        .filter(c => c.isActive && c.teachingStatus === 'in-progress')
        .reduce((sum, course) => sum + course.creditHrs, 0);

      if (Math.abs(faculty.currentWorkload - actualWorkload) > 0.1) {
        faculty.currentWorkload = actualWorkload;
        await faculty.save({ session });
        console.log(`Updated workload for faculty ${facultyId}: ${actualWorkload}`);
      }

      return faculty;
    } catch (error) {
      console.error('Error in cleanupFacultyAssignments:', error);
      throw error;
    }
  }

  static async updateTeachingStatusForCompletedSemesters(facultyId, session = null) {
    try {
      const faculty = await Faculty.findById(facultyId).session(session);
      if (!faculty) {
        throw new Error('Faculty not found');
      }

      const batchIds = [...new Set(faculty.assignedCourses.map(c => c.batchId))];
      const Batch = mongoose.model('Batch');
      const batches = await Batch.find({ _id: { $in: batchIds } })
        .select('academicCalendar graduationStatus');

      const now = new Date();
      let updatedCount = 0;
      let workloadReduction = 0;

      faculty.assignedCourses.forEach(course => {
        if (course.teachingStatus === 'in-progress' && course.isActive) {
          const batch = batches.find(b => b._id.equals(course.batchId));
          const semesterData = batch?.academicCalendar?.find(s => s.semester === course.semester);
          
          const shouldComplete = 
            batch?.graduationStatus === 'graduated' ||
            (semesterData && isAfter(now, semesterData.endDate));

          if (shouldComplete) {
            course.teachingStatus = 'completed';
            course.isActive = false;
            course.completedAt = new Date();
            updatedCount++;
            workloadReduction += course.creditHrs;
          }
        }
      });

      if (updatedCount > 0) {
        faculty.currentWorkload = Math.max(0, faculty.currentWorkload - workloadReduction);
        await faculty.save({ session });
        console.log(`Updated ${updatedCount} assignments for faculty ${facultyId}, reduced workload by ${workloadReduction}`);
      }

      return {
        updatedCount,
        workloadReduction,
        newWorkload: faculty.currentWorkload
      };
    } catch (error) {
      console.error('Error in updateTeachingStatusForCompletedSemesters:', error);
      throw error;
    }
  }

  static async getFacultyTeachingSummary(facultyId) {
    try {
      const faculty = await Faculty.findById(facultyId)
        .select('firstName lastName assignedCourses currentWorkload department designation')
        .populate({
          path: 'assignedCourses.batchId',
          select: 'batchName academicCalendar graduationStatus currentSemester'
        });

      if (!faculty) {
        throw new Error('Faculty not found');
      }

      const now = new Date();
      const activeAssignments = [];
      const completedAssignments = [];
      const removedAssignments = [];
      const upcomingCompletions = [];

      // Categorize assignments
      faculty.assignedCourses.forEach(course => {
        const assignment = {
          _id: course._id,
          batchId: course.batchId,
          batchName: course.batchName || course.batchId?.batchName,
          semester: course.semester,
          courseCode: course.courseCode,
          courseName: course.courseName,
          sectionName: course.sectionName,
          creditHrs: course.creditHrs,
          teachingStatus: course.teachingStatus,
          isActive: course.isActive,
          assignedAt: course.assignedAt,
          completedAt: course.completedAt,
          removedAt: course.removedAt
        };

        if (course.teachingStatus === 'completed') {
          completedAssignments.push(assignment);
        } else if (course.teachingStatus === 'removed') {
          removedAssignments.push(assignment);
        } else if (course.teachingStatus === 'in-progress' && course.isActive) {
          activeAssignments.push(assignment);

          // Check for upcoming completions
          const batch = course.batchId;
          const semesterData = batch?.academicCalendar?.find(s => s.semester === course.semester);
          
          if (semesterData && semesterData.endDate) {
            const daysUntilCompletion = Math.ceil(
              (semesterData.endDate - now) / (1000 * 60 * 60 * 24)
            );
            
            if (daysUntilCompletion > 0 && daysUntilCompletion <= 30) {
              upcomingCompletions.push({
                ...assignment,
                daysUntilCompletion,
                semesterEndDate: semesterData.endDate
              });
            }
          }
        }
      });

      return {
        facultyId: faculty._id,
        facultyName: `${faculty.firstName} ${faculty.lastName}`,
        department: faculty.department,
        designation: faculty.designation,
        currentWorkload: faculty.currentWorkload,
        maxWorkload: 24,
        workloadPercentage: Math.round((faculty.currentWorkload / 24) * 100),
        assignments: {
          active: activeAssignments,
          completed: completedAssignments,
          removed: removedAssignments,
          upcomingCompletion: upcomingCompletions.sort((a, b) => a.daysUntilCompletion - b.daysUntilCompletion)
        },
        counts: {
          active: activeAssignments.length,
          completed: completedAssignments.length,
          removed: removedAssignments.length,
          upcoming: upcomingCompletions.length
        }
      };
    } catch (error) {
      console.error('Error in getFacultyTeachingSummary:', error);
      throw error;
    }
  }

  /**
   * Check if faculty can accept additional assignment
   */
  static async canAcceptAssignment(facultyId, additionalCredits) {
    try {
      const workload = await this.getFacultyWorkload(facultyId);
      return (workload.currentWorkload + additionalCredits) <= 24;
    } catch (error) {
      console.error('Error in canAcceptAssignment:', error);
      throw error;
    }
  }


  static async bulkCompleteSemesterAssignments(batchId, semester, session = null) {
    try {
      const facultyWithAssignments = await Faculty.find({
        'assignedCourses.batchId': batchId,
        'assignedCourses.semester': semester,
        'assignedCourses.teachingStatus': 'in-progress',
        'assignedCourses.isActive': true
      }).session(session);

      let totalUpdated = 0;
      let totalWorkloadReduction = 0;

      for (const faculty of facultyWithAssignments) {
        const assignmentsToComplete = faculty.assignedCourses.filter(course =>
          course.batchId.toString() === batchId.toString() &&
          course.semester === semester &&
          course.teachingStatus === 'in-progress' &&
          course.isActive
        );

        for (const assignment of assignmentsToComplete) {
          assignment.teachingStatus = 'completed';
          assignment.isActive = false;
          assignment.completedAt = new Date();
          totalUpdated++;
          totalWorkloadReduction += assignment.creditHrs;
        }

        faculty.currentWorkload = Math.max(0, faculty.currentWorkload - 
          assignmentsToComplete.reduce((sum, course) => sum + course.creditHrs, 0)
        );

        await faculty.save({ session });
      }

      return {
        facultyCount: facultyWithAssignments.length,
        assignmentsUpdated: totalUpdated,
        workloadReduction: totalWorkloadReduction
      };
    } catch (error) {
      console.error('Error in bulkCompleteSemesterAssignments:', error);
      throw error;
    }
  }

  static async getActiveFacultyAssignments(facultyId) {
    try {
      const faculty = await Faculty.findById(facultyId)
        .select('assignedCourses')
        .populate({
          path: 'assignedCourses.batchId',
          select: 'batchName academicCalendar graduationStatus'
        });

      if (!faculty) {
        throw new Error('Faculty not found');
      }

      const activeAssignments = faculty.assignedCourses.filter(course => 
        course.isActive && course.teachingStatus === 'in-progress'
      );

      return activeAssignments.map(course => ({
        _id: course._id,
        batchId: course.batchId,
        batchName: course.batchName || course.batchId?.batchName,
        semester: course.semester,
        courseCode: course.courseCode,
        courseName: course.courseName,
        sectionName: course.sectionName,
        creditHrs: course.creditHrs,
        teachingStatus: course.teachingStatus,
        isActive: course.isActive,
        assignedAt: course.assignedAt
      }));
    } catch (error) {
      console.error('Error in getActiveFacultyAssignments:', error);
      throw error;
    }
  }

  static async syncAllFacultyWorkloads(session = null) {
    try {
      const facultyList = await Faculty.find({ isActive: true })
        .select('assignedCourses currentWorkload firstName lastName')
        .session(session);

      let syncedCount = 0;
      const results = [];

      for (const faculty of facultyList) {
        const calculatedWorkload = faculty.assignedCourses
          .filter(c => c.isActive && c.teachingStatus === 'in-progress')
          .reduce((total, course) => total + (course.creditHrs || 0), 0);

        if (Math.abs(faculty.currentWorkload - calculatedWorkload) > 0.1) {
          const previousWorkload = faculty.currentWorkload;
          faculty.currentWorkload = calculatedWorkload;
          await faculty.save({ session });
          syncedCount++;
          
          results.push({
            facultyId: faculty._id,
            facultyName: `${faculty.firstName} ${faculty.lastName}`,
            previousWorkload,
            newWorkload: calculatedWorkload
          });
        }
      }

      return {
        syncedCount,
        totalFaculty: facultyList.length,
        results
      };
    } catch (error) {
      console.error('Error in syncAllFacultyWorkloads:', error);
      throw error;
    }
  }
}

async function getFacultyAssignments(req, res) {
  try {
    const { facultyId } = req.params;
    const { showAll } = req.query;
    
    const result = await FacultyAssignmentService.getFacultyWorkload(
      facultyId, 
      showAll === 'true'
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in getFacultyAssignments:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error'
    });
  }
}

async function getFacultyTeachingSummary(req, res) {
  try {
    const { facultyId } = req.params;
    
    const result = await FacultyAssignmentService.getFacultyTeachingSummary(facultyId);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in getFacultyTeachingSummary:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error'
    });
  }
}

async function updateFacultyTeachingStatus(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { facultyId } = req.params;
    
    const result = await FacultyAssignmentService.updateTeachingStatusForCompletedSemesters(facultyId, session);
    
    await session.commitTransaction();
    
    res.json({ 
      success: true, 
      message: `Updated ${result.updatedCount} assignments`,
      data: result
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in updateFacultyTeachingStatus:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error'
    });
  } finally {
    session.endSession();
  }
}

async function getActiveFacultyAssignments(req, res) {
  try {
    const { facultyId } = req.params;
    
    const result = await FacultyAssignmentService.getActiveFacultyAssignments(facultyId);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in getActiveFacultyAssignments:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error'
    });
  }
}

async function syncAllFacultyWorkloads(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await FacultyAssignmentService.syncAllFacultyWorkloads(session);
    
    await session.commitTransaction();
    
    res.json({
      success: true,
      message: `Synced workloads for ${result.syncedCount} out of ${result.totalFaculty} faculty members`,
      data: result
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in syncAllFacultyWorkloads:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error'
    });
  } finally {
    session.endSession();
  }
}

module.exports = {
  FacultyAssignmentService,
  getFacultyAssignments,
  getFacultyTeachingSummary,
  updateFacultyTeachingStatus,
  getActiveFacultyAssignments,
  syncAllFacultyWorkloads
};