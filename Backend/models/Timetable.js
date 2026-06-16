const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    required: true
  },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  courseCode: { type: String, required: true },
  courseName: { type: String, required: true },
  sectionName: { type: String, required: true },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
  facultyName: { type: String, default: 'Not Assigned' },
  classType: {
    type: String,
    enum: ['lecture', 'lab', 'tutorial'],
    default: 'lecture'
  },
  room: { 
    type: String, 
    required: true,
    enum: [
      'Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5', 'Room 6', 'Room 7', 'Room 8',
      'Room 9', 'Room 10', 'Room 11', 'Lab 1', 'Lab 2', 'Lab 3', 'Lab 4', 'Lab 5'
    ]
  },
  isActive: { type: Boolean, default: true },
  lastFacultySync: { type: Date, default: Date.now }
}, { timestamps: true });

const timetableSchema = new mongoose.Schema({
  batchId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Batch', 
    required: true 
  },
  semester: { type: Number, required: true },
  degreeLevel: { type: String, required: true },
  department: { type: String, required: true },
  timetableName: { type: String, required: true },
  academicYear: { type: String, required: true },
  description: { type: String },
  timeSlots: [timeSlotSchema],
  isActive: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ['draft', 'published', 'needs_republish'],
    default: 'draft'
  },
  lastFacultySync: { type: Date, default: Date.now },
  lastPublishedAt: { type: Date },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  version: { type: Number, default: 1 },
  changesSincePublish: [{
    type: {
      type: String,
      enum: ['teacher_changed', 'faculty_inactive', 'timeslot_removed', 'timeslot_added', 'timeslot_updated']
    },
    courseCode: String,
    sectionName: String,
    facultyName: String,
    oldFacultyName: String,
    reason: String,
    timestamp: { type: Date, default: Date.now }
  }],
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Indexes
timetableSchema.index({ batchId: 1, semester: 1, isActive: 1 });
timetableSchema.index({ 'timeSlots.facultyId': 1 });
timetableSchema.index({ 'timeSlots.day': 1, 'timeSlots.startTime': 1, 'timeSlots.endTime': 1 });
timetableSchema.index({ 'timeSlots.room': 1 });
timetableSchema.index({ 'timeSlots.sectionName': 1 });

timetableSchema.pre('save', function(next) {
  if (this.isModified('timeSlots') && this.status === 'published') {
    this.trackChangesSincePublish();
  }
  if (this.isModified('timeSlots')) {
    this.lastFacultySync = new Date();
  }
  next();
});

timetableSchema.methods.trackChangesSincePublish = function() {
  return this.changesSincePublish;
};

timetableSchema.statics.checkFacultyConflicts = async function(facultyId, day, startTime, endTime, excludeTimetableId = null) {
  if (!facultyId) return [];

  const query = {
    'timeSlots.facultyId': facultyId,
    'timeSlots.day': day,
    'timeSlots.startTime': { $lt: endTime },
    'timeSlots.endTime': { $gt: startTime },
    'timeSlots.isActive': true,
    isActive: true
  };

  if (excludeTimetableId) {
    query._id = { $ne: excludeTimetableId };
  }

  const conflicts = await this.find(query)
    .populate('batchId', 'batchName departmentName')
    .select('batchId timetableName timeSlots');

  const conflictDetails = [];

  conflicts.forEach(timetable => {
    timetable.timeSlots.forEach(slot => {
      if (slot.facultyId?.toString() === facultyId.toString() &&
          slot.day === day &&
          slot.startTime < endTime &&
          slot.endTime > startTime) {
        
        conflictDetails.push({
          timetableName: timetable.timetableName,
          batchName: timetable.batchId.batchName,
          courseCode: slot.courseCode,
          sectionName: slot.sectionName,
          facultyName: slot.facultyName,
          day: slot.day,
          time: `${slot.startTime} - ${slot.endTime}`,
          room: slot.room
        });
      }
    });
  });

  return conflictDetails;
};

timetableSchema.statics.checkRoomConflicts = async function(room, day, startTime, endTime, excludeTimetableId = null) {
  const query = {
    'timeSlots.room': room,
    'timeSlots.day': day,
    'timeSlots.startTime': { $lt: endTime },
    'timeSlots.endTime': { $gt: startTime },
    'timeSlots.isActive': true,
    isActive: true
  };

  if (excludeTimetableId) {
    query._id = { $ne: excludeTimetableId };
  }

  const conflicts = await this.find(query)
    .populate('batchId', 'batchName departmentName')
    .select('batchId timetableName timeSlots');

  const conflictDetails = [];

  conflicts.forEach(timetable => {
    timetable.timeSlots.forEach(slot => {
      if (slot.room === room &&
          slot.day === day &&
          slot.startTime < endTime &&
          slot.endTime > startTime) {
        
        conflictDetails.push({
          timetableName: timetable.timetableName,
          batchName: timetable.batchId.batchName,
          courseCode: slot.courseCode,
          sectionName: slot.sectionName,
          facultyName: slot.facultyName,
          day: slot.day,
          time: `${slot.startTime} - ${slot.endTime}`,
          room: slot.room
        });
      }
    });
  });

  return conflictDetails;
};

timetableSchema.statics.checkSectionConflicts = async function(batchId, sectionName, day, startTime, endTime, excludeTimetableId = null) {
  const query = {
    batchId: batchId,
    'timeSlots.sectionName': sectionName,
    'timeSlots.day': day,
    'timeSlots.startTime': { $lt: endTime },
    'timeSlots.endTime': { $gt: startTime },
    'timeSlots.isActive': true,
    isActive: true
  };

  if (excludeTimetableId) {
    query._id = { $ne: excludeTimetableId };
  }

  const conflicts = await this.find(query)
    .populate('batchId', 'batchName departmentName')
    .select('batchId timetableName timeSlots');

  const conflictDetails = [];

  conflicts.forEach(timetable => {
    timetable.timeSlots.forEach(slot => {
      if (slot.sectionName === sectionName &&
          slot.day === day &&
          slot.startTime < endTime &&
          slot.endTime > startTime) {
        
        conflictDetails.push({
          timetableName: timetable.timetableName,
          batchName: timetable.batchId.batchName,
          courseCode: slot.courseCode,
          sectionName: slot.sectionName,
          facultyName: slot.facultyName,
          day: slot.day,
          time: `${slot.startTime} - ${slot.endTime}`,
          room: slot.room
        });
      }
    });
  });

  return conflictDetails;
};

timetableSchema.methods.checkInternalConflicts = function(newSlot) {
  const conflicts = [];
  
  for (const existingSlot of this.timeSlots) {
    if (!existingSlot.isActive) continue;
    
    if (existingSlot.day === newSlot.day &&
        existingSlot.startTime < newSlot.endTime &&
        existingSlot.endTime > newSlot.startTime) {
      
      if (existingSlot.room === newSlot.room) {
        conflicts.push({
          type: 'room',
          message: `Room ${newSlot.room} is already occupied by ${existingSlot.courseCode} (${existingSlot.sectionName}) at ${existingSlot.startTime}-${existingSlot.endTime}`,
          existingSlot: {
            courseCode: existingSlot.courseCode,
            sectionName: existingSlot.sectionName,
            facultyName: existingSlot.facultyName,
            room: existingSlot.room,
            time: `${existingSlot.startTime}-${existingSlot.endTime}`
          }
        });
      }
      
      if (existingSlot.sectionName === newSlot.sectionName) {
        conflicts.push({
          type: 'section', 
          message: `Section ${newSlot.sectionName} is already studying ${existingSlot.courseCode} at ${existingSlot.startTime}-${existingSlot.endTime}`,
          existingSlot: {
            courseCode: existingSlot.courseCode,
            sectionName: existingSlot.sectionName,
            facultyName: existingSlot.facultyName,
            room: existingSlot.room,
            time: `${existingSlot.startTime}-${existingSlot.endTime}`
          }
        });
      }
      
      if (existingSlot.facultyId && newSlot.facultyId && 
          existingSlot.facultyId.toString() === newSlot.facultyId.toString()) {
        conflicts.push({
          type: 'faculty',
          message: `Faculty ${existingSlot.facultyName} is already teaching ${existingSlot.courseCode} (${existingSlot.sectionName}) at ${existingSlot.startTime}-${existingSlot.endTime}`,
          existingSlot: {
            courseCode: existingSlot.courseCode,
            sectionName: existingSlot.sectionName,
            facultyName: existingSlot.facultyName,
            room: existingSlot.room,
            time: `${existingSlot.startTime}-${existingSlot.endTime}`
          }
        });
      }
    }
  }
  
  return conflicts;
};

timetableSchema.methods.syncFacultyAssignments = async function() {
  const TeacherAssignment = mongoose.model('TeacherAssignment');
  const Faculty = mongoose.model('Faculty');
  const FacultyTimetable = mongoose.model('FacultyTimetable');
  
  const assignment = await TeacherAssignment.findOne({
    batchId: this.batchId,
    semester: this.semester,
    isActive: true
  });

  let updatedCount = 0;
  let removedCount = 0;
  const changes = [];
  const changesSincePublish = [];

  console.log(' AUTO-SYNC TRIGGERED ');
  console.log('Timetable:', this.timetableName);
  console.log('Status:', this.status);
  console.log('Batch ID:', this.batchId);
  console.log('Semester:', this.semester);

  if (!assignment) {
    console.log('No active teacher assignment found - checking individual slots');
    for (const slot of this.timeSlots) {
      if (!slot.isActive) continue;
      
      const courseInfo = await getCourseWithFaculty(this.batchId, this.semester, slot.courseCode, slot.sectionName);
      
      if (!courseInfo.canAssign) {
        slot.isActive = false;
        removedCount++;
        
        changes.push({
          type: 'course_removed_no_assignment',
          courseCode: slot.courseCode,
          sectionName: slot.sectionName,
          facultyName: slot.facultyName,
          reason: 'No teacher currently assigned to this course-section'
        });
        
        if (slot.facultyId) {
          await FacultyTimetable.deactivateFacultySlots(
            slot.facultyId,
            this.batchId,
            this.semester,
            slot.courseCode,
            slot.sectionName
          );
        }
      }
    }
  } else {
    console.log(' Found teacher assignment');

    const validAssignmentsMap = new Map();
    
    const semesterAssignment = assignment.semesterAssignments.get(this.semester.toString());
    
    if (semesterAssignment && semesterAssignment.assignments) {
      semesterAssignment.assignments.forEach(courseAssignment => {
        courseAssignment.sections.forEach(sectionAssignment => {
          if (sectionAssignment.status === 'active' && sectionAssignment.facultyId) {
            const key = `${courseAssignment.courseCode}-${sectionAssignment.sectionName}`;
            validAssignmentsMap.set(key, {
              facultyId: sectionAssignment.facultyId,
              facultyName: sectionAssignment.facultyName,
              courseName: courseAssignment.courseName,
              canAssignTimeSlot: true
            });
          }
        });
      });
    }

    console.log(` Valid assignments found: ${validAssignmentsMap.size}`);

    for (const slot of this.timeSlots) {
      if (!slot.isActive) continue;
      
      const key = `${slot.courseCode}-${slot.sectionName}`;
      const validAssignment = validAssignmentsMap.get(key);

      if (!validAssignment) {
        slot.isActive = false;
        removedCount++;
        
        const change = {
          type: 'course_removed_no_assignment',
          courseCode: slot.courseCode,
          sectionName: slot.sectionName,
          facultyName: slot.facultyName,
          reason: 'No teacher currently assigned to this course-section'
        };
        changes.push(change);
        
        if (this.status === 'published') {
          changesSincePublish.push({
            type: 'timeslot_removed',
            courseCode: slot.courseCode,
            sectionName: slot.sectionName,
            facultyName: slot.facultyName,
            reason: 'No teacher assigned'
          });
        }
        
        console.log(` REMOVED: ${slot.courseCode}-${slot.sectionName} - No teacher assignment`);
        
        if (slot.facultyId) {
          await FacultyTimetable.deactivateFacultySlots(
            slot.facultyId,
            this.batchId,
            this.semester,
            slot.courseCode,
            slot.sectionName
          );
        }
      } else {
        let isCurrentFacultyActive = true;
        if (validAssignment.facultyId) {
          try {
            const faculty = await Faculty.findById(validAssignment.facultyId);
            isCurrentFacultyActive = faculty?.isActive !== false;
          } catch (error) {
            isCurrentFacultyActive = false;
          }
        }

        if (!isCurrentFacultyActive) {
          slot.isActive = false;
          removedCount++;
          
          const change = {
            type: 'course_removed_faculty_inactive',
            courseCode: slot.courseCode,
            sectionName: slot.sectionName,
            facultyName: validAssignment.facultyName,
            reason: 'Currently assigned faculty is inactive/blocked'
          };
          changes.push(change);
          
          if (this.status === 'published') {
            changesSincePublish.push({
              type: 'faculty_inactive',
              courseCode: slot.courseCode,
              sectionName: slot.sectionName,
              facultyName: validAssignment.facultyName,
              reason: 'Faculty became inactive/blocked'
            });
          }
          
          console.log(`🗑️ REMOVED: ${slot.courseCode}-${slot.sectionName} - Current faculty inactive`);
          
          await FacultyTimetable.deactivateFacultySlots(
            validAssignment.facultyId,
            this.batchId,
            this.semester,
            slot.courseCode,
            slot.sectionName
          );
        } else if (slot.facultyId?.toString() !== validAssignment.facultyId?.toString()) {
          slot.isActive = false;
          removedCount++;
          
          const change = {
            type: 'course_removed_teacher_changed',
            courseCode: slot.courseCode,
            sectionName: slot.sectionName,
            oldFaculty: slot.facultyName,
            newFaculty: validAssignment.facultyName,
            reason: 'Teacher assignment changed - course removed from timetable'
          };
          changes.push(change);
          
          if (this.status === 'published') {
            changesSincePublish.push({
              type: 'teacher_changed',
              courseCode: slot.courseCode,
              sectionName: slot.sectionName,
              oldFacultyName: slot.facultyName,
              facultyName: validAssignment.facultyName,
              reason: 'Teacher assignment changed'
            });
          }
          
          console.log(`🔄 REMOVED: ${slot.courseCode}-${slot.sectionName} - Teacher changed from ${slot.facultyName} to ${validAssignment.facultyName}`);
          
          if (slot.facultyId) {
            await FacultyTimetable.deactivateFacultySlots(
              slot.facultyId,
              this.batchId,
              this.semester,
              slot.courseCode,
              slot.sectionName
            );
          }
        } else {
          if (slot.facultyName !== validAssignment.facultyName) {
            const oldName = slot.facultyName;
            slot.facultyName = validAssignment.facultyName;
            updatedCount++;
            changes.push({
              type: 'faculty_name_updated',
              courseCode: slot.courseCode,
              sectionName: slot.sectionName,
              oldFaculty: oldName,
              newFaculty: validAssignment.facultyName
            });
          }
        }
      }
    }
  }

  const activeBefore = this.timeSlots.length;
  this.timeSlots = this.timeSlots.filter(slot => slot.isActive);
  const activeAfter = this.timeSlots.length;
  
  this.lastFacultySync = new Date();
  
  if (this.status === 'published' && changesSincePublish.length > 0) {
    this.changesSincePublish.push(...changesSincePublish);
    this.status = 'needs_republish';
    console.log(`Timetable marked as 'needs_republish' with ${changesSincePublish.length} changes`);
  }
  
  await this.save();

  console.log(` STRICT SYNC COMPLETED: ${removedCount} removed, ${updatedCount} updated, Active slots: ${activeBefore} → ${activeAfter}`);

  return {
    updatedCount,
    removedCount,
    changes,
    changesSincePublish,
    totalSlotsBefore: activeBefore,
    totalSlotsAfter: activeAfter,
    statusChanged: this.status === 'needs_republish'
  };
};

async function getCourseWithFaculty(batchId, semester, courseCode, sectionName) {
  try {
    const TeacherAssignment = mongoose.model('TeacherAssignment');
    const Faculty = mongoose.model('Faculty');
    
    const teacherAssignment = await TeacherAssignment.findOne({
      batchId: batchId
    });

    if (!teacherAssignment) {
      return {
        courseName: 'Course Name Not Available',
        facultyId: null,
        facultyName: 'No Teacher Assigned',
        canAssign: false
      };
    }

    const semesterAssignment = teacherAssignment.semesterAssignments.get(semester.toString());
    
    if (!semesterAssignment) {
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
        const faculty = await Faculty.findById(sectionAssignment.facultyId);
        
        if (faculty && faculty.isActive) {
          facultyId = sectionAssignment.facultyId;
          facultyName = sectionAssignment.facultyName || `${faculty.firstName} ${faculty.lastName}`;
          canAssign = true;
        } else {
          facultyName = 'Teacher Inactive/Blocked';
          canAssign = false;
        }
      } catch (error) {
        facultyName = 'Teacher Status Unknown';
        canAssign = false;
      }
    }

    return {
      courseName: courseAssignment.courseName,
      facultyId: facultyId,
      facultyName: facultyName,
      canAssign: canAssign
    };
  } catch (error) {
    return {
      courseName: 'Course Name Not Available',
      facultyId: null,
      facultyName: 'Error Loading Teacher',
      canAssign: false
    };
  }
}

timetableSchema.statics.removeFacultyFromAllTimetables = async function(facultyId, session = null) {
  try {
    console.log(` STRICT: Removing ALL time slots for faculty ${facultyId}`);
    
    const FacultyTimetable = mongoose.model('FacultyTimetable');
    
    const result = await this.updateMany(
      {
        'timeSlots.facultyId': facultyId,
        'timeSlots.isActive': true
      },
      {
        $set: {
          'timeSlots.$[elem].isActive': false
        }
      },
      {
        arrayFilters: [
          { 'elem.facultyId': facultyId, 'elem.isActive': true }
        ],
        session
      }
    );

    await FacultyTimetable.deactivateAllFacultySlots(facultyId, session);

    return {
      success: true,
      timetablesModified: result.modifiedCount,
      facultyId: facultyId
    };
  } catch (error) {
    console.error('Error removing faculty time slots:', error);
    throw error;
  }
};

timetableSchema.statics.removeCourseSectionTimeSlots = async function(batchId, semester, courseCode, sectionName, session = null) {
  try {
    console.log(` STRICT: Removing time slots for ${courseCode}-${sectionName}`);
    
    const FacultyTimetable = mongoose.model('FacultyTimetable');
    
    const timetable = await this.findOne({
      batchId: batchId,
      semester: semester,
      isActive: true
    }).session(session);

    if (!timetable) {
      return { success: true, removed: 0 };
    }

    let removedCount = 0;
    const facultyIds = new Set();
    
    timetable.timeSlots.forEach(slot => {
      if (slot.isActive && 
          slot.courseCode === courseCode && 
          slot.sectionName === sectionName) {
        slot.isActive = false;
        removedCount++;
        if (slot.facultyId) {
          facultyIds.add(slot.facultyId.toString());
        }
      }
    });

    if (removedCount > 0) {
      for (const facultyId of facultyIds) {
        await FacultyTimetable.deactivateFacultySlots(
          facultyId,
          batchId,
          semester,
          courseCode,
          sectionName,
          session
        );
      }
      
      if (timetable.status === 'published') {
        timetable.changesSincePublish.push({
          type: 'timeslot_removed',
          courseCode: courseCode,
          sectionName: sectionName,
          reason: 'Time slots removed due to teacher change'
        });
        timetable.status = 'needs_republish';
      }
      
      await timetable.save({ session });
    }

    return {
      success: true,
      removed: removedCount
    };
  } catch (error) {
    console.error('Error removing course-section time slots:', error);
    throw error;
  }
};

timetableSchema.statics.removeFacultyTimeSlots = async function(facultyId, session = null) {
  try {
    console.log(` Removing ALL time slots for faculty ${facultyId}`);
    
    const FacultyTimetable = mongoose.model('FacultyTimetable');
    
    const result = await this.updateMany(
      {
        'timeSlots.facultyId': facultyId,
        'timeSlots.isActive': true
      },
      {
        $set: {
          'timeSlots.$[elem].isActive': false
        }
      },
      {
        arrayFilters: [
          { 'elem.facultyId': facultyId, 'elem.isActive': true }
        ],
        session
      }
    );

    await FacultyTimetable.deactivateAllFacultySlots(facultyId, session);

    return {
      success: true,
      timetablesModified: result.modifiedCount,
      facultyId: facultyId
    };
  } catch (error) {
    console.error('Error removing faculty time slots:', error);
    throw error;
  }
};

module.exports = mongoose.model('Timetable', timetableSchema);