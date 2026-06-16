const express = require('express');
const mongoose = require('mongoose');
const Timetable = require('../models/Timetable');
const Batch = require('../models/Batch');
const TeacherAssignment = require('../models/TeacherCourseAssignment');
const CourseEntry = require('../models/CourseEntry');
const Faculty = require('../models/Faculty');
const FacultyTimetable = require('../models/FacultyTimetable');

exports.getDegreeLevels = async (req, res) => {
  try {
    const degreeLevels = await Batch.distinct('degreeLevel', { isActive: true });
    
    res.json({
      success: true,
      data: degreeLevels
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getDepartmentsByDegree = async (req, res) => {
  try {
    const { degreeLevel } = req.query;
    
    if (!degreeLevel) {
      return res.status(400).json({
        success: false,
        message: 'Degree level is required'
      });
    }

    const departments = await Batch.distinct('departmentName', { 
      degreeLevel: degreeLevel.toLowerCase(),
      isActive: true 
    });
    
    res.json({
      success: true,
      data: departments
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getBatchesByDepartment = async (req, res) => {
  try {
    const { degreeLevel, department } = req.query;
    
    if (!degreeLevel || !department) {
      return res.status(400).json({
        success: false,
        message: 'Degree level and department are required'
      });
    }

    const batches = await Batch.find({
      degreeLevel: degreeLevel.toLowerCase(),
      departmentName: department,
      isActive: true,
      graduationStatus: 'pending'
    })
    .select('batchName enrollmentYear currentSemester totalSemesters sections academicCalendar')
    .sort({ enrollmentYear: -1 });

    res.json({
      success: true,
      data: batches
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getCurrentSemesterDates = async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const currentSemester = batch.currentSemester || 1;
    const currentSemesterData = batch.academicCalendar.find(
      sem => sem.semester === currentSemester
    );

    if (!currentSemesterData) {
      return res.status(404).json({
        success: false,
        message: 'Current semester data not found'
      });
    }

    const startDate = new Date(currentSemesterData.startDate);
    const semesterName = currentSemesterData.name || '';
    let academicYearDisplay = '';
    
    if (semesterName.toLowerCase().includes('fall')) {
      academicYearDisplay = `FALL-${startDate.getFullYear()}`;
    } else if (semesterName.toLowerCase().includes('spring')) {
      academicYearDisplay = `SPRING-${startDate.getFullYear()}`;
    } else {
      const month = startDate.getMonth() + 1;
      if (month >= 8 && month <= 12) {
        academicYearDisplay = `FALL-${startDate.getFullYear()}`;
      } else {
        academicYearDisplay = `SPRING-${startDate.getFullYear()}`;
      }
    }

    res.json({
      success: true,
      data: {
        currentSemester,
        startDate: currentSemesterData.startDate,
        endDate: currentSemesterData.endDate,
        semesterName: currentSemesterData.name,
        academicYearDisplay
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getCoursesForTimetable = async (req, res) => {
  try {
    const { batchId, semester } = req.params;
    const semesterNum = parseInt(semester);

    console.log(`📋 Fetching courses for timetable - Batch: ${batchId}, Semester: ${semesterNum}`);

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const TeacherAssignmentModel = mongoose.model('TeacherAssignment');
    const FacultyModel = mongoose.model('Faculty');
    
    const teacherAssignment = await TeacherAssignmentModel.findOne({
      batchId: batchId
    });

    console.log('Teacher Assignment Found:', teacherAssignment ? 'Yes' : 'No');

    const courseEntry = await CourseEntry.findOne({
      degreeLevel: { $regex: new RegExp(`^${batch.degreeLevel}$`, 'i') },
      department: { $regex: new RegExp(`^${batch.departmentName}$`, 'i') }
    });

    if (!courseEntry) {
      return res.status(404).json({
        success: false,
        message: 'Course structure not found'
      });
    }

    const semesterCourses = courseEntry.semesters.find(
      s => s.semesterNumber === semesterNum
    );

    if (!semesterCourses) {
      return res.json({
        success: true,
        data: []
      });
    }

    const coursesWithFaculty = await Promise.all(
      semesterCourses.courses.map(async (course) => {
        let courseAssignment = null;
        if (teacherAssignment && teacherAssignment.semesterAssignments) {
          const semesterAssignment = teacherAssignment.semesterAssignments.get(semesterNum.toString());
          console.log(` Semester ${semesterNum} assignment:`, semesterAssignment ? 'Found' : 'Not Found');
          
          if (semesterAssignment && semesterAssignment.assignments) {
            courseAssignment = semesterAssignment.assignments.find(
              assignment => assignment.courseCode === course.courseCode
            );
          }
        }

        console.log(` Course: ${course.courseCode}, Assignment:`, courseAssignment ? 'Found' : 'Not Found');

        const sectionsWithFaculty = await Promise.all(
          batch.sections.map(async (section) => {
            let sectionAssignment = null;
            if (courseAssignment && courseAssignment.sections) {
              sectionAssignment = courseAssignment.sections.find(
                s => s.sectionName === section.name
              );
            }

            let facultyId = null;
            let facultyName = 'No Teacher Assigned';
            let isFacultyActive = false;
            let canAssignTimeSlot = false;

            if (sectionAssignment?.facultyId && sectionAssignment.status === 'active') {
              try {
                const faculty = await FacultyModel.findById(sectionAssignment.facultyId);
                
                if (faculty && faculty.isActive) {
                  facultyId = sectionAssignment.facultyId;
                  facultyName = sectionAssignment.facultyName || `${faculty.firstName} ${faculty.lastName}`;
                  isFacultyActive = true;
                  canAssignTimeSlot = true;
                  console.log(` ACTIVE FACULTY: ${facultyName} for ${course.courseCode}-${section.name} - CAN ADD TIME SLOTS`);
                } else {
                  facultyName = 'Teacher Inactive/Blocked';
                  isFacultyActive = false;
                  canAssignTimeSlot = false;
                  console.log(` Faculty inactive: ${sectionAssignment.facultyId} for ${course.courseCode}-${section.name}`);
                }
              } catch (error) {
                console.error(` Error checking faculty status for ${sectionAssignment.facultyId}:`, error);
                facultyName = 'Teacher Status Unknown';
                isFacultyActive = false;
                canAssignTimeSlot = false;
              }
            } else if (!sectionAssignment) {
              console.log(` No section assignment for ${course.courseCode}-${section.name}`);
            } else if (sectionAssignment.status !== 'active') {
              console.log(` Section assignment inactive for ${course.courseCode}-${section.name}`);
            }

            return {
              sectionName: section.name,
              facultyId: facultyId,
              facultyName: facultyName,
              isFacultyActive: isFacultyActive,
              canAssignTimeSlot: canAssignTimeSlot, 
              assignedAt: sectionAssignment?.assignedAt,
              status: sectionAssignment?.status || 'inactive',
              displayName: `${course.courseName} - ${facultyName}`
            };
          })
        );

        return {
          courseCode: course.courseCode,
          courseName: course.courseName,
          creditHrs: course.creditHrs,
          type: course.type || 'Core',
          sections: sectionsWithFaculty
        };
      })
    );

    console.log(`Successfully loaded ${coursesWithFaculty.length} courses with faculty assignments`);

    res.json({
      success: true,
      data: coursesWithFaculty
    });
  } catch (err) {
    console.error(' Error in getCoursesForTimetable:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

async function getCourseWithFaculty(batchId, semester, courseCode, sectionName) {
  try {
    console.log(` Getting faculty for: ${courseCode}-${sectionName}, Batch: ${batchId}, Semester: ${semester}`);
    
    const TeacherAssignmentModel = mongoose.model('TeacherAssignment');
    const FacultyModel = mongoose.model('Faculty');
    
    const teacherAssignment = await TeacherAssignmentModel.findOne({
      batchId: batchId
    });

    if (!teacherAssignment) {
      console.log('No teacher assignment found');
      return {
        courseName: 'Course Name Not Available',
        facultyId: null,
        facultyName: 'No Teacher Assigned',
        canAssign: false
      };
    }

    const semesterAssignment = teacherAssignment.semesterAssignments.get(semester.toString());
    
    if (!semesterAssignment) {
      console.log(`Semester ${semester} not found in assignments`);
      return {
        courseName: 'Course Name Not Available',
        facultyId: null,
        facultyName: 'No Teacher Assigned',
        canAssign: false
      };
    }

    const courseAssignment = semesterAssignment.assignments.find(
      assignment => assignment.courseCode === courseCode
    );

    if (!courseAssignment) {
      console.log(` Course ${courseCode} not found in assignments`);
      return {
        courseName: 'Course Name Not Available',
        facultyId: null,
        facultyName: 'No Teacher Assigned',
        canAssign: false
      };
    }

    const sectionAssignment = courseAssignment.sections.find(
      section => section.sectionName === sectionName
    );

    let facultyId = null;
    let facultyName = 'No Teacher Assigned';
    let canAssign = false;

    if (sectionAssignment?.facultyId && sectionAssignment.status === 'active') {
      try {
        const faculty = await FacultyModel.findById(sectionAssignment.facultyId);
        
        if (faculty && faculty.isActive) {
          facultyId = sectionAssignment.facultyId;
          facultyName = sectionAssignment.facultyName || `${faculty.firstName} ${faculty.lastName}`;
          canAssign = true; 
          console.log(`VALID FACULTY: ${facultyName} (Active: ${faculty.isActive}) - CAN ADD TIME SLOTS`);
        } else {
          facultyName = 'Teacher Inactive/Blocked';
          canAssign = false;
          console.log(`Faculty inactive/blocked: ${sectionAssignment.facultyId}`);
        }
      } catch (error) {
        console.error(`Error checking faculty status:`, error);
        facultyName = 'Teacher Status Unknown';
        canAssign = false;
      }
    } else {
      console.log(`No active faculty assignment for ${courseCode}-${sectionName}`);
      if (sectionAssignment) {
        console.log(`   - Faculty ID: ${sectionAssignment.facultyId}`);
        console.log(`   - Status: ${sectionAssignment.status}`);
        console.log(`   - Faculty Name: ${sectionAssignment.facultyName}`);
      } else {
        console.log(`   - No section assignment found at all`);
      }
    }

    return {
      courseName: courseAssignment.courseName,
      facultyId: facultyId,
      facultyName: facultyName,
      canAssign: canAssign 
    };
  } catch (error) {
    console.error(' Error in getCourseWithFaculty:', error);
    return {
      courseName: 'Course Name Not Available',
      facultyId: null,
      facultyName: 'Error Loading Teacher',
      canAssign: false
    };
  }
}

const calculateWeeklyHoursForCourse = (timeSlots, courseCode, sectionName, excludeSlotId = null) => {
  const courseSlots = timeSlots.filter(slot => {
    if (excludeSlotId && slot._id?.toString() === excludeSlotId.toString()) {
      return false;
    }
    return slot.courseCode === courseCode && 
           slot.sectionName === sectionName && 
           slot.isActive;
  });
  
  let totalMinutes = 0;
  courseSlots.forEach(slot => {
    const [startHour, startMinute] = slot.startTime.split(':').map(Number);
    const [endHour, endMinute] = slot.endTime.split(':').map(Number);
    
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    
    totalMinutes += (endTotalMinutes - startTotalMinutes);
  });
  
  return totalMinutes / 60; 
};

const calculateSlotDuration = (startTime, endTime) => {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;
  
  return (endTotalMinutes - startTotalMinutes) / 60;
};

exports.getTimetableWithFaculty = async (req, res) => {
  try {
    const { batchId, semester } = req.params;
    const semesterNum = parseInt(semester);

    const timetable = await Timetable.findOne({
      batchId,
      semester: semesterNum,
      isActive: true
    }).populate('batchId', 'batchName sections academicCalendar');

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    res.json({
      success: true,
      data: {
        timetable
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.createOrUpdateTimetable = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { batchId, semester } = req.params;
    const { timetableName, academicYear, description, timeSlots } = req.body;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const currentSemesterData = batch.academicCalendar.find(
      sem => sem.semester === parseInt(semester)
    );

    if (currentSemesterData) {
      const now = new Date();
      const endDate = new Date(currentSemesterData.endDate);
      
      if (now > endDate) {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify timetable for expired semester. Please create a new timetable for the current semester.'
        });
      }
    }

    const existingTimetable = await Timetable.findOne({
      batchId,
      semester,
      isActive: true,
      timetableName: { $regex: new RegExp(`^${timetableName}$`, 'i') }
    });

    if (existingTimetable) {
      return res.status(400).json({
        success: false,
        message: 'Timetable with this name already exists'
      });
    }

    let timetable = await Timetable.findOne({
      batchId,
      semester,
      isActive: true
    });

    if (timetable) {
      timetable.timetableName = timetableName;
      timetable.academicYear = academicYear;
      timetable.description = description;
      timetable.timeSlots = timeSlots;
      timetable.status = 'draft';
    } else {
      timetable = new Timetable({
        batchId,
        semester,
        degreeLevel: batch.degreeLevel,
        department: batch.departmentName,
        timetableName,
        academicYear,
        description,
        timeSlots,
        isActive: true,
        status: 'draft',
        generatedBy: req.user?._id
      });
    }

    await timetable.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Timetable saved successfully',
      data: timetable
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

exports.addTimeSlot = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { timetableId } = req.params;
    const timeSlotData = req.body;

    console.log(' Adding time slot with data:', timeSlotData);

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    const batch = await Batch.findById(timetable.batchId);
    const currentSemesterData = batch.academicCalendar.find(
      sem => sem.semester === timetable.semester
    );

    if (currentSemesterData) {
      const now = new Date();
      const endDate = new Date(currentSemesterData.endDate);
      
      if (now > endDate) {
        return res.status(400).json({
          success: false,
          message: 'Cannot add time slots to expired semester timetable. Please create a new timetable for the current semester.'
        });
      }
    }

    const courseInfo = await getCourseWithFaculty(
      timetable.batchId,
      timetable.semester,
      timeSlotData.courseCode,
      timeSlotData.sectionName
    );

    if (!courseInfo) {
      return res.status(404).json({
        success: false,
        message: 'Course not found in course structure'
      });
    }

    if (!courseInfo.canAssign) {
      return res.status(400).json({
        success: false,
        message: `Cannot add time slot: ${courseInfo.facultyName}. Only courses with active assigned teachers can have time slots.`
      });
    }

    console.log(` Faculty validation passed: ${courseInfo.facultyName}`);

    const slotDurationHours = calculateSlotDuration(timeSlotData.startTime, timeSlotData.endTime);

    const currentWeeklyHours = calculateWeeklyHoursForCourse(
      timetable.timeSlots,
      timeSlotData.courseCode,
      timeSlotData.sectionName
    );

    if (currentWeeklyHours + slotDurationHours > 2) {
      return res.status(400).json({
        success: false,
        message: `This course-section already has ${currentWeeklyHours.toFixed(1)} hours per week. Adding this slot would exceed the maximum of 2 hours per week.`
      });
    }

    const newSlot = {
      day: timeSlotData.day,
      startTime: timeSlotData.startTime,
      endTime: timeSlotData.endTime,
      room: timeSlotData.room,
      courseCode: timeSlotData.courseCode,
      sectionName: timeSlotData.sectionName,
      facultyId: courseInfo.facultyId,
      facultyName: courseInfo.facultyName
    };

    const internalConflicts = timetable.checkInternalConflicts(newSlot);
    if (internalConflicts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Scheduling conflicts detected within timetable',
        conflicts: internalConflicts
      });
    }

    const externalConflicts = [];

    const facultyConflicts = await Timetable.checkFacultyConflicts(
      courseInfo.facultyId,
      timeSlotData.day,
      timeSlotData.startTime,
      timeSlotData.endTime,
      timetableId
    );

    if (facultyConflicts.length > 0) {
      facultyConflicts.forEach(conflict => {
        externalConflicts.push({
          type: 'faculty',
          message: `Faculty ${courseInfo.facultyName} is already teaching ${conflict.courseCode} in ${conflict.room} at ${conflict.time}`,
          details: conflict
        });
      });
    }

    const roomConflicts = await Timetable.checkRoomConflicts(
      timeSlotData.room,
      timeSlotData.day,
      timeSlotData.startTime,
      timeSlotData.endTime,
      timetableId
    );

    if (roomConflicts.length > 0) {
      roomConflicts.forEach(conflict => {
        externalConflicts.push({
          type: 'room',
          message: `Room ${timeSlotData.room} is already occupied by ${conflict.courseCode} (${conflict.facultyName}) at ${conflict.time}`,
          details: conflict
        });
      });
    }

    // 3. Section conflicts
    const sectionConflicts = await Timetable.checkSectionConflicts(
      timetable.batchId,
      timeSlotData.sectionName,
      timeSlotData.day,
      timeSlotData.startTime,
      timeSlotData.endTime,
      timetableId
    );

    if (sectionConflicts.length > 0) {
      sectionConflicts.forEach(conflict => {
        externalConflicts.push({
          type: 'section',
          message: `Section ${timeSlotData.sectionName} is already studying ${conflict.courseCode} at ${conflict.time}`,
          details: conflict
        });
      });
    }

    if (externalConflicts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Scheduling conflicts detected with other timetables',
        conflicts: externalConflicts
      });
    }

    // ✅ ALL CHECKS PASSED - Create time slot
    const newTimeSlot = {
      day: timeSlotData.day,
      startTime: timeSlotData.startTime,
      endTime: timeSlotData.endTime,
      room: timeSlotData.room,
      classType: timeSlotData.classType,
      courseCode: timeSlotData.courseCode,
      courseName: courseInfo.courseName,
      sectionName: timeSlotData.sectionName,
      facultyId: courseInfo.facultyId,
      facultyName: courseInfo.facultyName,
      isActive: true,
      lastFacultySync: new Date()
    };

    timetable.timeSlots.push(newTimeSlot);
    
    if (timetable.status === 'published') {
      timetable.changesSincePublish.push({
        type: 'timeslot_added',
        courseCode: timeSlotData.courseCode,
        sectionName: timeSlotData.sectionName,
        facultyName: courseInfo.facultyName,
        reason: 'New time slot added'
      });
      timetable.status = 'needs_republish';
    }
    
    await timetable.save({ session });

    if (courseInfo.facultyId) {
      await FacultyTimetable.upsertFacultyTimetable(
        courseInfo.facultyId,
        courseInfo.facultyName,
        timetable,
        session
      );
    }

    await session.commitTransaction();

    console.log(`Time slot added successfully for ${timeSlotData.courseCode}-${timeSlotData.sectionName}`);

    res.status(201).json({
      success: true,
      message: 'Time slot added successfully',
      data: timetable,
      needsRepublish: timetable.status === 'needs_republish'
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Error adding time slot:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  } finally {
    session.endSession();
  }
};

exports.updateTimeSlot = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { timetableId, slotId } = req.params;
    const updateData = req.body;

    console.log('Update request received:', { timetableId, slotId, updateData });

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    const batch = await Batch.findById(timetable.batchId);
    const currentSemesterData = batch.academicCalendar.find(
      sem => sem.semester === timetable.semester
    );

    if (currentSemesterData) {
      const now = new Date();
      const endDate = new Date(currentSemesterData.endDate);
      
      if (now > endDate) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update time slots in expired semester timetable.'
        });
      }
    }

    const timeSlot = timetable.timeSlots.id(slotId);
    if (!timeSlot) {
      return res.status(404).json({
        success: false,
        message: 'Time slot not found'
      });
    }

    console.log('Found time slot:', timeSlot);

    const courseInfo = await getCourseWithFaculty(
      timetable.batchId,
      timetable.semester,
      updateData.courseCode || timeSlot.courseCode,
      updateData.sectionName || timeSlot.sectionName
    );

    if (!courseInfo) {
      return res.status(404).json({
        success: false,
        message: 'Course not found in course structure'
      });
    }

    console.log('Course info:', courseInfo);

    if ((updateData.courseCode || updateData.sectionName) && 
        (!courseInfo.facultyId || courseInfo.facultyName === 'No Teacher Assigned')) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update time slot: No active teacher is assigned to this course-section'
      });
    }

    let slotDurationHours = 0;
    if (updateData.startTime || updateData.endTime) {
      const newStartTime = updateData.startTime || timeSlot.startTime;
      const newEndTime = updateData.endTime || timeSlot.endTime;
      slotDurationHours = calculateSlotDuration(newStartTime, newEndTime);
    }

    if (updateData.courseCode || updateData.sectionName) {
      const targetCourseCode = updateData.courseCode || timeSlot.courseCode;
      const targetSectionName = updateData.sectionName || timeSlot.sectionName;
      
      const currentWeeklyHours = calculateWeeklyHoursForCourse(
        timetable.timeSlots,
        targetCourseCode,
        targetSectionName,
        slotId 
      );

      if (currentWeeklyHours + slotDurationHours > 2) {
        return res.status(400).json({
          success: false,
          message: `This course-section would have ${(currentWeeklyHours + slotDurationHours).toFixed(1)} hours per week after update. Maximum allowed is 2 hours per week.`
        });
      }
    }

    const updatedSlot = {
      day: updateData.day || timeSlot.day,
      startTime: updateData.startTime || timeSlot.startTime,
      endTime: updateData.endTime || timeSlot.endTime,
      room: updateData.room || timeSlot.room,
      courseCode: updateData.courseCode || timeSlot.courseCode,
      sectionName: updateData.sectionName || timeSlot.sectionName,
      facultyId: courseInfo.facultyId || timeSlot.facultyId,
      facultyName: courseInfo.facultyName || timeSlot.facultyName
    };

    const tempTimeSlots = timetable.timeSlots.filter(slot => slot._id.toString() !== slotId);
    const tempTimetable = { timeSlots: tempTimeSlots };
    const internalConflicts = Timetable.schema.methods.checkInternalConflicts.call(tempTimetable, updatedSlot);
    
    if (internalConflicts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Scheduling conflicts detected within timetable',
        conflicts: internalConflicts
      });
    }

    const externalConflicts = [];

    const facultyIdToCheck = courseInfo.facultyId || timeSlot.facultyId;
    const dayToCheck = updateData.day || timeSlot.day;
    const startTimeToCheck = updateData.startTime || timeSlot.startTime;
    const endTimeToCheck = updateData.endTime || timeSlot.endTime;
    const roomToCheck = updateData.room || timeSlot.room;
    const sectionNameToCheck = updateData.sectionName || timeSlot.sectionName;

    if (facultyIdToCheck && (
      updateData.day || updateData.startTime || updateData.endTime || updateData.courseCode || updateData.sectionName
    )) {
      const facultyConflicts = await Timetable.checkFacultyConflicts(
        facultyIdToCheck,
        dayToCheck,
        startTimeToCheck,
        endTimeToCheck,
        timetableId
      );

      if (facultyConflicts.length > 0) {
        facultyConflicts.forEach(conflict => {
          externalConflicts.push({
            type: 'faculty',
            message: `Faculty ${courseInfo.facultyName} is already teaching ${conflict.courseCode} in ${conflict.room} at ${conflict.time}`,
            details: conflict
          });
        });
      }
    }

    if (updateData.room || updateData.day || updateData.startTime || updateData.endTime) {
      const roomConflicts = await Timetable.checkRoomConflicts(
        roomToCheck,
        dayToCheck,
        startTimeToCheck,
        endTimeToCheck,
        timetableId
      );

      if (roomConflicts.length > 0) {
        roomConflicts.forEach(conflict => {
          externalConflicts.push({
            type: 'room',
            message: `Room ${roomToCheck} is already occupied by ${conflict.courseCode} (${conflict.facultyName}) at ${conflict.time}`,
            details: conflict
          });
        });
      }
    }

    if (updateData.sectionName || updateData.day || updateData.startTime || updateData.endTime) {
      const sectionConflicts = await Timetable.checkSectionConflicts(
        timetable.batchId,
        sectionNameToCheck,
        dayToCheck,
        startTimeToCheck,
        endTimeToCheck,
        timetableId
      );

      if (sectionConflicts.length > 0) {
        sectionConflicts.forEach(conflict => {
          externalConflicts.push({
            type: 'section',
            message: `Section ${sectionNameToCheck} is already studying ${conflict.courseCode} at ${conflict.time}`,
            details: conflict
          });
        });
      }
    }

    if (externalConflicts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Scheduling conflicts detected with other timetables',
        conflicts: externalConflicts
      });
    }

    const oldFacultyId = timeSlot.facultyId?.toString();
    const newFacultyId = courseInfo.facultyId?.toString();
    const facultyChanged = oldFacultyId !== newFacultyId;

    if (timetable.status === 'published' && facultyChanged) {
      timetable.changesSincePublish.push({
        type: 'teacher_changed',
        courseCode: timeSlot.courseCode,
        sectionName: timeSlot.sectionName,
        oldFacultyName: timeSlot.facultyName,
        facultyName: courseInfo.facultyName,
        reason: 'Teacher assignment changed during time slot update'
      });
      timetable.status = 'needs_republish';
    }

    timeSlot.day = updateData.day || timeSlot.day;
    timeSlot.startTime = updateData.startTime || timeSlot.startTime;
    timeSlot.endTime = updateData.endTime || timeSlot.endTime;
    timeSlot.room = updateData.room || timeSlot.room;
    timeSlot.classType = updateData.classType || timeSlot.classType;
    
    timeSlot.courseCode = updateData.courseCode || timeSlot.courseCode;
    timeSlot.courseName = courseInfo.courseName;
    timeSlot.sectionName = updateData.sectionName || timeSlot.sectionName;
    timeSlot.facultyId = courseInfo.facultyId;
    timeSlot.facultyName = courseInfo.facultyName;
    timeSlot.lastFacultySync = new Date();

    console.log('Updated time slot:', timeSlot);

    await timetable.save({ session });

    if (facultyChanged && oldFacultyId) {
      await FacultyTimetable.deactivateFacultySlots(
        oldFacultyId,
        timetable.batchId,
        timetable.semester,
        timeSlot.courseCode,
        timeSlot.sectionName
      );
    }

    if (courseInfo.facultyId) {
      await FacultyTimetable.upsertFacultyTimetable(
        courseInfo.facultyId,
        courseInfo.facultyName,
        timetable,
        session
      );
    }

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Time slot updated successfully',
      data: timetable,
      needsRepublish: timetable.status === 'needs_republish'
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Error updating time slot:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  } finally {
    session.endSession();
  }
};

exports.deleteTimeSlot = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { timetableId, slotId } = req.params;

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    const batch = await Batch.findById(timetable.batchId);
    const currentSemesterData = batch.academicCalendar.find(
      sem => sem.semester === timetable.semester
    );

    if (currentSemesterData) {
      const now = new Date();
      const endDate = new Date(currentSemesterData.endDate);
      
      if (now > endDate) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete time slots from expired semester timetable.'
        });
      }
    }

    const timeSlot = timetable.timeSlots.id(slotId);
    if (!timeSlot) {
      return res.status(404).json({
        success: false,
        message: 'Time slot not found'
      });
    }

    if (timetable.status === 'published') {
      timetable.changesSincePublish.push({
        type: 'timeslot_removed',
        courseCode: timeSlot.courseCode,
        sectionName: timeSlot.sectionName,
        facultyName: timeSlot.facultyName,
        reason: 'Time slot deleted'
      });
      timetable.status = 'needs_republish';
    }

    timetable.timeSlots.pull(slotId);
    
    await timetable.save({ session });

    if (timeSlot.facultyId) {
      await FacultyTimetable.deactivateFacultySlots(
        timeSlot.facultyId,
        timetable.batchId,
        timetable.semester,
        timeSlot.courseCode,
        timeSlot.sectionName
      );
    }

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Time slot deleted successfully',
      data: timetable,
      needsRepublish: timetable.status === 'needs_republish'
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

exports.autoSyncFacultyAssignments = async (req, res) => {
  try {
    const { timetableId } = req.params;

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    console.log('TARGETED AUTO-SYNC TRIGGERED ');
    console.log('Timetable:', timetable.timetableName);
    console.log('Status:', timetable.status);
    console.log('Batch:', timetable.batchId);
    console.log('Semester:', timetable.semester);
    console.log(' ONLY COURSES WITH TEACHER CHANGES OR INACTIVE FACULTY WILL BE REMOVED');

    const syncResult = await timetable.syncFacultyAssignments();

    let message = 'Faculty assignments synced successfully';
    let messageType = 'success';
    
    if (syncResult.removedCount > 0) {
      const teacherChangedRemovals = syncResult.changes.filter(change => 
        change.type === 'course_removed_teacher_changed'
      ).length;
      
      const facultyInactiveRemovals = syncResult.changes.filter(change => 
        change.type === 'course_removed_faculty_inactive'
      ).length;
      
      if (teacherChangedRemovals > 0 || facultyInactiveRemovals > 0) {
        message = `Auto-sync completed: ${syncResult.removedCount} time slots removed from specific courses (${teacherChangedRemovals} teacher changes, ${facultyInactiveRemovals} inactive faculty)`;
        messageType = 'warning';
      } else {
        message = `Auto-sync removed ${syncResult.removedCount} time slots from courses with missing teacher assignments`;
        messageType = 'warning';
      }
    }

    console.log(`Targeted auto-sync completed: ${message}`);

    res.json({
      success: true,
      message: message,
      messageType: messageType,
      data: syncResult,
      details: {
        coursesRemoved: syncResult.removedCount > 0,
        teacherChangedRemovals: syncResult.changes.filter(change => 
          change.type === 'course_removed_teacher_changed'
        ).length,
        facultyInactiveRemovals: syncResult.changes.filter(change => 
          change.type === 'course_removed_faculty_inactive'
        ).length,
        changesApplied: syncResult.changes,
        statusChanged: syncResult.statusChanged,
        syncTimestamp: new Date()
      }
    });
  } catch (err) {
    console.error('Error in auto sync:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getSyncStatus = async (req, res) => {
  try {
    const { timetableId } = req.params;

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    const TeacherAssignmentModel = mongoose.model('TeacherAssignment');
    const FacultyModel = mongoose.model('Faculty');
    
    const assignment = await TeacherAssignmentModel.findOne({
      batchId: timetable.batchId
    });

    const pendingChanges = [];
    const currentTimeSlots = timetable.timeSlots.filter(slot => slot.isActive);

    if (!assignment) {
      for (const slot of currentTimeSlots) {
        const courseInfo = await getCourseWithFaculty(
          timetable.batchId,
          timetable.semester,
          slot.courseCode,
          slot.sectionName
        );
        
        if (!courseInfo.canAssign) {
          pendingChanges.push({
            type: 'remove',
            courseCode: slot.courseCode,
            sectionName: slot.sectionName,
            facultyName: slot.facultyName,
            reason: 'No teacher currently assigned to this course-section'
          });
        }
      }
    } else {
      const validAssignmentsMap = new Map();
      
      const semesterAssignment = assignment.semesterAssignments.get(timetable.semester.toString());
      
      if (semesterAssignment) {
        semesterAssignment.assignments.forEach(courseAssignment => {
          courseAssignment.sections.forEach(sectionAssignment => {
            if (sectionAssignment.status === 'active' && sectionAssignment.facultyId) {
              const key = `${courseAssignment.courseCode}-${sectionAssignment.sectionName}`;
              validAssignmentsMap.set(key, {
                facultyId: sectionAssignment.facultyId,
                facultyName: sectionAssignment.facultyName,
                courseName: courseAssignment.courseName
              });
            }
          });
        });
      }

      const facultyStatusMap = new Map();
      const facultyIds = [...new Set(currentTimeSlots.map(slot => slot.facultyId).filter(id => id))];
      
      for (const facultyId of facultyIds) {
        try {
          const faculty = await FacultyModel.findById(facultyId);
          facultyStatusMap.set(facultyId.toString(), faculty?.isActive !== false);
        } catch (error) {
          facultyStatusMap.set(facultyId.toString(), false);
        }
      }

      currentTimeSlots.forEach(slot => {
        const key = `${slot.courseCode}-${slot.sectionName}`;
        const validAssignment = validAssignmentsMap.get(key);
        const isFacultyActive = slot.facultyId ? facultyStatusMap.get(slot.facultyId.toString()) : false;

        if (!validAssignment) {
          pendingChanges.push({
            type: 'remove',
            courseCode: slot.courseCode,
            sectionName: slot.sectionName,
            facultyName: slot.facultyName,
            reason: 'No teacher currently assigned to this course-section'
          });
        } else if (!isFacultyActive) {
          pendingChanges.push({
            type: 'remove_faculty_inactive',
            courseCode: slot.courseCode,
            sectionName: slot.sectionName,
            facultyName: slot.facultyName,
            reason: 'Assigned faculty is inactive/blocked'
          });
        } else if (slot.facultyId?.toString() !== validAssignment.facultyId?.toString()) {
          pendingChanges.push({
            type: 'remove_course',
            courseCode: slot.courseCode,
            sectionName: slot.sectionName,
            oldFaculty: slot.facultyName,
            newFaculty: validAssignment.facultyName,
            reason: 'Teacher assignment changed - course will be removed from timetable'
          });
        }
      });
    }

    res.json({
      success: true,
      data: {
        timetable: {
          _id: timetable._id,
          timetableName: timetable.timetableName,
          lastFacultySync: timetable.lastFacultySync,
          totalTimeSlots: currentTimeSlots.length,
          status: timetable.status,
          changesSincePublish: timetable.changesSincePublish
        },
        syncStatus: {
          needsSync: pendingChanges.length > 0,
          pendingChanges: pendingChanges,
          changeCount: pendingChanges.length,
          coursesToBeRemoved: pendingChanges.filter(change => 
            change.type === 'remove_course' || change.type === 'remove_faculty_inactive'
          ).length
        },
        lastSync: timetable.lastFacultySync
      }
    });
  } catch (err) {
    console.error(' Error getting sync status:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.publishTimetable = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { timetableId } = req.params;

    console.log(` Starting publish process for timetable: ${timetableId}`);

    const timetable = await Timetable.findById(timetableId)
      .populate('batchId', 'batchName enrollmentYear currentSemester academicCalendar');
    
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    if (timetable.timeSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish empty timetable. Please add time slots first.'
      });
    }

    const activeSlots = timetable.timeSlots.filter(slot => slot.isActive);
    if (activeSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish timetable with no active time slots.'
      });
    }

    console.log(`Timetable has ${activeSlots.length} active time slots`);

    const existingPublished = await Timetable.findOne({
      batchId: timetable.batchId,
      semester: timetable.semester,
      status: 'published',
      isActive: true,
      _id: { $ne: timetableId }
    });

    if (existingPublished) {
      console.log(`Archiving previous published timetable: ${existingPublished._id}`);
      existingPublished.isActive = false;
      existingPublished.status = 'archived';
      existingPublished.archivedAt = new Date();
      await existingPublished.save({ session });
    }

    timetable.status = 'published';
    timetable.lastPublishedAt = new Date();
    timetable.publishedBy = req.user?._id;
    timetable.changesSincePublish = []; 
    await timetable.save({ session });

    console.log(`Timetable ${timetableId} marked as published`);

    console.log(` Creating/updating faculty records...`);
    await createFacultyRecords(timetable, session);

    await session.commitTransaction();
    console.log(`Successfully published timetable: ${timetable.timetableName}`);

    res.json({
      success: true,
      message: 'Timetable published successfully',
      data: {
        timetable: {
          _id: timetable._id,
          timetableName: timetable.timetableName,
          status: timetable.status,
          lastPublishedAt: timetable.lastPublishedAt,
          timeSlotsCount: activeSlots.length,
          changesSincePublish: timetable.changesSincePublish
        },
        facultyRecordsCreated: true
      }
    });
  } catch (err) {
    await session.abortTransaction();
    console.error(' Error publishing timetable:', err);
    res.status(500).json({ 
      success: false,
      message: err.message,
      details: 'Failed to publish timetable. Please try again.'
    });
  } finally {
    session.endSession();
  }
};

async function createFacultyRecords(timetable, session) {
  try {
    const FacultyTimetable = mongoose.model('FacultyTimetable');
    
    const facultySlots = {};
    timetable.timeSlots.forEach(slot => {
      if (slot.facultyId && slot.isActive) {
        if (!facultySlots[slot.facultyId]) {
          facultySlots[slot.facultyId] = [];
        }
        facultySlots[slot.facultyId].push(slot);
      }
    });

    for (const [facultyId, slots] of Object.entries(facultySlots)) {
      const faculty = await mongoose.model('Faculty').findById(facultyId);
      if (!faculty || !faculty.isActive) continue;

      await FacultyTimetable.upsertFacultyTimetable(
        facultyId,
        `${faculty.firstName} ${faculty.lastName}`,
        timetable,
        session
      );
    }
  } catch (error) {
    console.error('Error creating faculty records:', error);
    throw error;
  }
}

exports.republishTimetable = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { timetableId } = req.params;

    console.log(`Starting REPUBLISH process for timetable: ${timetableId}`);

    const timetable = await Timetable.findById(timetableId)
      .populate('batchId', 'batchName enrollmentYear currentSemester academicCalendar');
    
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    if (timetable.status !== 'needs_republish') {
      return res.status(400).json({
        success: false,
        message: 'Timetable does not need republishing. No changes detected since last publish.'
      });
    }

    console.log(`Republishing timetable with ${timetable.changesSincePublish.length} changes`);

    timetable.status = 'published';
    timetable.lastPublishedAt = new Date();
    timetable.publishedBy = req.user?._id;
    timetable.version += 1;
    const changes = [...timetable.changesSincePublish]; 
    timetable.changesSincePublish = [];
    
    await timetable.save({ session });

    console.log(` Timetable ${timetableId} republished as version ${timetable.version}`);

    console.log(`Updating faculty records for republish...`);
    await createFacultyRecords(timetable, session);

    await session.commitTransaction();
    console.log(`Successfully republished timetable: ${timetable.timetableName}`);

    res.json({
      success: true,
      message: 'Timetable republished successfully',
      data: {
        timetable: {
          _id: timetable._id,
          timetableName: timetable.timetableName,
          status: timetable.status,
          lastPublishedAt: timetable.lastPublishedAt,
          version: timetable.version,
          timeSlotsCount: timetable.timeSlots.length,
          changesApplied: changes
        },
        facultyRecordsUpdated: true
      }
    });
  } catch (err) {
    await session.abortTransaction();
    console.error(' Error republishing timetable:', err);
    res.status(500).json({ 
      success: false,
      message: err.message,
      details: 'Failed to republish timetable. Please try again.'
    });
  } finally {
    session.endSession();
  }
};

exports.getChangesSincePublish = async (req, res) => {
  try {
    const { timetableId } = req.params;

    const timetable = await Timetable.findById(timetableId)
      .populate('batchId', 'batchName');
    
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found'
      });
    }

    res.json({
      success: true,
      data: {
        timetable: {
          _id: timetable._id,
          timetableName: timetable.timetableName,
          status: timetable.status,
          lastPublishedAt: timetable.lastPublishedAt,
          version: timetable.version
        },
        changesSincePublish: timetable.changesSincePublish,
        needsRepublish: timetable.status === 'needs_republish',
        changesCount: timetable.changesSincePublish.length
      }
    });
  } catch (err) {
    console.error(' Error getting changes since publish:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getPublishedTimetables = async (req, res) => {
  try {
    const { degreeLevel, department, semester } = req.query;
    
    const query = {
      status: 'published',
      isActive: true
    };

    if (degreeLevel) query.degreeLevel = degreeLevel;
    if (department) query.department = department;
    if (semester) query.semester = parseInt(semester);

    const timetables = await Timetable.find(query)
      .populate('batchId', 'batchName enrollmentYear currentSemester sections')
      .sort({ academicYear: -1, semester: 1 });

    res.json({
      success: true,
      data: timetables
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.triggerAutoSyncForBatch = async (req, res) => {
  try {
    const { batchId, semester } = req.params;

    console.log(`TRIGGERING STRICT AUTO-SYNC for batch ${batchId}, semester ${semester}`);
    console.log(`COURSES WITH TEACHER CHANGES OR INACTIVE FACULTY WILL BE REMOVED COMPLETELY FROM TIMETABLE`);

    const timetables = await Timetable.find({
      batchId,
      semester: parseInt(semester),
      isActive: true
    });

    let totalSyncResults = [];
    let totalRemoved = 0;
    let teacherChangedRemovals = 0;
    let facultyInactiveRemovals = 0;

    for (const timetable of timetables) {
      console.log(`🔄 Auto-syncing timetable: ${timetable.timetableName}`);
      const syncResult = await timetable.syncFacultyAssignments();
      totalSyncResults.push({
        timetableName: timetable.timetableName,
        syncResult
      });
      
      if (syncResult.removedCount > 0) {
        totalRemoved += syncResult.removedCount;
        
        const teacherChanged = syncResult.changes.filter(change => 
          change.type === 'course_removed_teacher_changed'
        ).length;
        teacherChangedRemovals += teacherChanged;
        
        const facultyInactive = syncResult.changes.filter(change => 
          change.facultyStatus === 'inactive'
        ).length;
        facultyInactiveRemovals += facultyInactive;
      }
    }

    let message = '';
    if (teacherChangedRemovals > 0 || facultyInactiveRemovals > 0) {
      message = `Auto-sync completed for ${timetables.length} timetable(s). ${teacherChangedRemovals} courses removed due to teacher changes, ${facultyInactiveRemovals} due to inactive faculty, ${totalRemoved} total time slots removed.`;
    } else if (totalRemoved > 0) {
      message = `Auto-sync completed for ${timetables.length} timetable(s). ${totalRemoved} time slots removed due to missing teacher assignments.`;
    } else {
      message = `Auto-sync completed for ${timetables.length} timetable(s). All time slots are valid.`;
    }

    res.json({
      success: true,
      message: message,
      data: totalSyncResults,
      summary: {
        timetablesProcessed: timetables.length,
        totalTimeSlotsRemoved: totalRemoved,
        coursesRemovedDueToTeacherChanges: teacherChangedRemovals,
        coursesRemovedDueToInactiveFaculty: facultyInactiveRemovals,
        timestamp: new Date()
      }
    });
  } catch (err) {
    console.error('Error triggering auto-sync:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.removeFacultyFromAllTimetables = async (req, res) => {
  try {
    const { facultyId } = req.params;

    console.log(`🗑️ STRICT: Removing ALL time slots for faculty ${facultyId} from ALL timetables`);

    const result = await Timetable.removeFacultyFromAllTimetables(facultyId);

    res.json({
      success: true,
      message: `Removed all time slots for faculty ${facultyId}`,
      data: result
    });
  } catch (err) {
    console.error('Error removing faculty from timetables:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.removeCourseSectionFromTimetable = async (req, res) => {
  try {
    const { batchId, semester, courseCode, sectionName } = req.params;

    console.log(`STRICT: Removing time slots for ${courseCode}-${sectionName} from timetable`);

    const result = await Timetable.removeCourseSectionTimeSlots(
      batchId, 
      parseInt(semester), 
      courseCode, 
      sectionName
    );

    res.json({
      success: true,
      message: `Removed time slots for ${courseCode}-${sectionName}`,
      data: result
    });
  } catch (err) {
    console.error('Error removing course-section from timetable:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getFacultyTimetablesByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Department is required'
      });
    }

    console.log(`📋 Fetching ALL faculty timetables for department: ${department}`);

    const FacultyTimetable = mongoose.model('FacultyTimetable');
    
    const facultyTimetables = await FacultyTimetable.find({
      isActive: true
    })
    .populate('facultyId', 'firstName lastName employeeId department isActive')
    .populate('timeSlots.batchId', 'batchName enrollmentYear currentSemester')
    .sort({ 'facultyId.firstName': 1, semester: 1, academicYear: -1 });

    console.log(`✅ Found ${facultyTimetables.length} TOTAL faculty timetable records`);

    const departmentFacultyTimetables = facultyTimetables.filter(ft => {
      if (!ft.facultyId) return false;
      
      const facultyDept = ft.facultyId.department;
      return facultyDept && facultyDept.toLowerCase() === department.toLowerCase();
    });

    console.log(`Filtered to ${departmentFacultyTimetables.length} records for department: ${department}`);

    const formattedData = departmentFacultyTimetables.map(ft => {
      const faculty = ft.facultyId;
      const activeSlots = ft.timeSlots.filter(slot => slot.isActive);
      
      return {
        _id: ft._id,
        facultyId: faculty?._id,
        facultyName: faculty ? `${faculty.firstName} ${faculty.lastName}` : 'Unknown Faculty',
        employeeId: faculty?.employeeId,
        department: faculty?.department,
        semester: ft.semester,
        academicYear: ft.academicYear,
        batchName: activeSlots.length > 0 ? activeSlots[0].batchName : 'No Active Slots',
        timeSlots: activeSlots.map(slot => ({
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          courseCode: slot.courseCode,
          courseName: slot.courseName,
          sectionName: slot.sectionName,
          batchName: slot.batchName,
          room: slot.room,
          classType: slot.classType
        })),
        slotCount: activeSlots.length,
        totalWeeklyHours: ft.totalWeeklyHours,
        publishedAt: ft.publishedAt,
        lastUpdated: ft.lastUpdated,
        status: 'active',
        facultyStatus: faculty?.isActive !== false ? 'active' : 'inactive'
      };
    });

    const uniqueFacultyIds = [...new Set(formattedData.map(ft => ft.facultyId?.toString()).filter(id => id))];
    const academicYears = [...new Set(formattedData.map(ft => ft.academicYear).filter(year => year))];
    const multiRecordFaculty = uniqueFacultyIds.filter(facultyId => {
      const facultyRecords = formattedData.filter(ft => ft.facultyId?.toString() === facultyId);
      return facultyRecords.length > 1;
    });

    res.json({
      success: true,
      data: formattedData,
      summary: {
        totalRecords: formattedData.length,
        totalFaculty: uniqueFacultyIds.length,
        multiRecordFaculty: multiRecordFaculty.length,
        academicYears: academicYears.length,
        totalTimeSlots: formattedData.reduce((sum, ft) => sum + ft.slotCount, 0),
        totalWeeklyHours: formattedData.reduce((sum, ft) => sum + ft.totalWeeklyHours, 0),
        academicYearBreakdown: academicYears.map(year => ({
          academicYear: year,
          recordCount: formattedData.filter(ft => ft.academicYear === year).length,
          slotCount: formattedData.filter(ft => ft.academicYear === year).reduce((sum, ft) => sum + ft.slotCount, 0)
        }))
      }
    });
  } catch (err) {
    console.error(' Error fetching faculty timetables:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getFacultyTimetablesByDepartmentV2 = async (req, res) => {
  try {
    const { department } = req.params;
    
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Department is required'
      });
    }

    console.log(`Fetching faculty timetables V2 for department: ${department}`);

    const Faculty = mongoose.model('Faculty');
    const FacultyTimetable = mongoose.model('FacultyTimetable');
    
    const departmentFaculty = await Faculty.find({
      department: department,
      isActive: true
    }).select('_id firstName lastName employeeId');

    console.log(`👥 Found ${departmentFaculty.length} faculty members in department: ${department}`);

    if (departmentFaculty.length === 0) {
      return res.json({
        success: true,
        data: [],
        summary: {
          totalRecords: 0,
          totalFaculty: 0,
          message: 'No faculty found in this department'
        }
      });
    }

    const facultyIds = departmentFaculty.map(f => f._id);
    
    const facultyTimetables = await FacultyTimetable.find({
      facultyId: { $in: facultyIds },
      isActive: true
    })
    .populate('timeSlots.batchId', 'batchName enrollmentYear currentSemester')
    .sort({ semester: 1, academicYear: -1 });

    console.log(` Found ${facultyTimetables.length} faculty timetable records`);

    const facultyMap = new Map();
    departmentFaculty.forEach(faculty => {
      facultyMap.set(faculty._id.toString(), {
        name: `${faculty.firstName} ${faculty.lastName}`,
        employeeId: faculty.employeeId
      });
    });

    const formattedData = facultyTimetables.map(ft => {
      const facultyInfo = facultyMap.get(ft.facultyId.toString());
      const activeSlots = ft.timeSlots.filter(slot => slot.isActive);
      
      return {
        _id: ft._id,
        facultyId: ft.facultyId,
        facultyName: facultyInfo?.name || 'Unknown Faculty',
        employeeId: facultyInfo?.employeeId,
        department: department,
        semester: ft.semester,
        academicYear: ft.academicYear,
        batchName: activeSlots.length > 0 ? activeSlots[0].batchName : 'No Active Slots',
        timeSlots: activeSlots,
        slotCount: activeSlots.length,
        totalWeeklyHours: ft.totalWeeklyHours,
        publishedAt: ft.publishedAt,
        lastUpdated: ft.lastUpdated,
        status: 'active'
      };
    });

    const uniqueFacultyIds = [...new Set(formattedData.map(ft => ft.facultyId?.toString()).filter(id => id))];
    const academicYears = [...new Set(formattedData.map(ft => ft.academicYear).filter(year => year))];
    const multiRecordFaculty = uniqueFacultyIds.filter(facultyId => {
      const facultyRecords = formattedData.filter(ft => ft.facultyId?.toString() === facultyId);
      return facultyRecords.length > 1;
    });

    res.json({
      success: true,
      data: formattedData,
      summary: {
        totalRecords: formattedData.length,
        totalFaculty: uniqueFacultyIds.length,
        multiRecordFaculty: multiRecordFaculty.length,
        academicYears: academicYears.length,
        totalTimeSlots: formattedData.reduce((sum, ft) => sum + ft.slotCount, 0),
        totalWeeklyHours: formattedData.reduce((sum, ft) => sum + ft.totalWeeklyHours, 0),
        academicYearBreakdown: academicYears.map(year => ({
          academicYear: year,
          recordCount: formattedData.filter(ft => ft.academicYear === year).length,
          facultyCount: new Set(formattedData.filter(ft => ft.academicYear === year).map(ft => ft.facultyId)).size,
          slotCount: formattedData.filter(ft => ft.academicYear === year).reduce((sum, ft) => sum + ft.slotCount, 0)
        })).sort((a, b) => b.academicYear.localeCompare(a.academicYear))
      }
    });
  } catch (err) {
    console.error(' Error fetching faculty timetables V2:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

exports.getFacultyTimetableById = async (req, res) => {
  try {
    const { facultyId } = req.params;

    const FacultyTimetable = mongoose.model('FacultyTimetable');
    
    const facultyTimetables = await FacultyTimetable.find({
      facultyId: facultyId,
      isActive: true
    })
    .populate('timeSlots.batchId', 'batchName enrollmentYear currentSemester')
    .sort({ semester: -1, academicYear: -1 });

    if (!facultyTimetables || facultyTimetables.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No timetable found for this faculty member'
      });
    }

    const Faculty = mongoose.model('Faculty');
    const faculty = await Faculty.findById(facultyId).select('firstName lastName employeeId department');

    const formattedData = facultyTimetables.map(ft => {
      const activeSlots = ft.timeSlots.filter(slot => slot.isActive);
      
      return {
        _id: ft._id,
        semester: ft.semester,
        academicYear: ft.academicYear,
        timeSlots: activeSlots,
        slotCount: activeSlots.length,
        totalWeeklyHours: ft.totalWeeklyHours,
        publishedAt: ft.publishedAt,
        lastUpdated: ft.lastUpdated
      };
    });

    res.json({
      success: true,
      data: {
        faculty: {
          _id: faculty._id,
          name: `${faculty.firstName} ${faculty.lastName}`,
          employeeId: faculty.employeeId,
          department: faculty.department
        },
        timetables: formattedData
      }
    });
  } catch (err) {
    console.error('Error fetching faculty timetable:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};