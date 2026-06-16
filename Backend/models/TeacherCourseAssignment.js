const mongoose = require('mongoose');
const { isAfter, isBefore, isWithinInterval } = require('date-fns');

const sectionSchema = new mongoose.Schema({
  sectionName: { type: String, required: true },
  facultyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Faculty' 
  },
  facultyName: { type: String },
  assignedAt: { type: Date, default: Date.now },
  teachingStatus: {
    type: String,
    enum: ['in-progress', 'completed'],
    default: 'in-progress'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
});

const courseAssignmentSchema = new mongoose.Schema({
  courseCode: { type: String, required: true },
  courseName: { type: String, required: true },
  creditHrs: { type: Number, required: true },
  sections: [sectionSchema]
});

const semesterAssignmentSchema = new mongoose.Schema({
  semester: { type: Number, required: true },
  startDate: { type: Date },
  endDate: { type: Date },
  status: {
    type: String,
    enum: ['past', 'current', 'future'],
    default: 'current'
  },
  isActive: { type: Boolean, default: true },
  assignments: [courseAssignmentSchema]
});

const teacherAssignmentSchema = new mongoose.Schema({
  batchId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Batch', 
    required: true 
  },
  batchName: { type: String, required: true },
  degreeLevel: { type: String, required: true },
  department: { type: String, required: true },
  currentSemester: { type: Number, required: true },
  graduationStatus: {
    type: String,
    enum: ['pending', 'graduated', 'completed'],
    default: 'pending'
  },
  totalSemesters: { type: Number, required: true },
  semesterAssignments: {
    type: Map,
    of: semesterAssignmentSchema
  }
}, { timestamps: true });

teacherAssignmentSchema.index({ batchId: 1 }, { unique: true });

teacherAssignmentSchema.pre('save', async function(next) {
  try {
    const Batch = mongoose.model('Batch');
    const batch = await Batch.findById(this.batchId);
    
    if (batch) {
      this.batchName = batch.batchName;
      this.degreeLevel = batch.degreeLevel;
      this.department = batch.departmentName;
      this.currentSemester = batch.currentSemester;
      this.totalSemesters = batch.totalSemesters;
      this.graduationStatus = batch.graduationStatus;
      
      if (batch.academicCalendar && this.semesterAssignments) {
        const now = new Date();
        for (let [semesterKey, semesterData] of this.semesterAssignments.entries()) {
          const semesterNum = parseInt(semesterKey);
          const academicSemester = batch.academicCalendar.find(s => s.semester === semesterNum);
          
          if (academicSemester) {
            if (isAfter(now, academicSemester.endDate)) {
              semesterData.status = 'past';
              semesterData.isActive = false;
            } else if (semesterNum === batch.currentSemester) {
              semesterData.status = 'current';
              semesterData.isActive = true;
            } else {
              semesterData.status = 'future';
              semesterData.isActive = false;
            }
            
            semesterData.startDate = academicSemester.startDate;
            semesterData.endDate = academicSemester.endDate;
            
            semesterData.assignments.forEach(course => {
              course.sections.forEach(section => {
                if (semesterData.status === 'past') {
                  section.teachingStatus = 'completed';
                  section.status = 'inactive';
                } else {
                  section.teachingStatus = 'in-progress';
                  section.status = 'active';
                }
              });
            });
          }
        }
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

teacherAssignmentSchema.statics.getOrCreateBatchAssignment = async function(batchId) {
  const Batch = mongoose.model('Batch');
  const CourseEntry = mongoose.model('CourseEntry');
  
  let assignment = await this.findOne({ batchId });
  
  if (!assignment) {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }
    
    const courseEntry = await CourseEntry.findOne({
      degreeLevel: { $regex: new RegExp(`^${batch.degreeLevel}$`, 'i') },
      department: { $regex: new RegExp(`^${batch.departmentName}$`, 'i') }
    });
    
    if (!courseEntry) {
      throw new Error('Course structure not found for this batch');
    }
    
    const semesterAssignments = new Map();
    
    for (let sem = 1; sem <= batch.totalSemesters; sem++) {
      const semesterData = batch.academicCalendar.find(s => s.semester === sem);
      const semesterCourses = courseEntry.semesters.find(s => s.semesterNumber === sem);
      
      const now = new Date();
      let status = 'future';
      let isActive = false;
      
      if (semesterData) {
        if (isAfter(now, semesterData.endDate)) {
          status = 'past';
          isActive = false;
        } else if (sem === batch.currentSemester) {
          status = 'current';
          isActive = true;
        } else {
          status = 'future';
          isActive = false;
        }
      }
      
      semesterAssignments.set(sem.toString(), {
        semester: sem,
        startDate: semesterData?.startDate,
        endDate: semesterData?.endDate,
        status: status,
        isActive: isActive,
        assignments: semesterCourses ? semesterCourses.courses.map(course => ({
          courseCode: course.courseCode,
          courseName: course.courseName,
          creditHrs: course.creditHrs,
          sections: []
        })) : []
      });
    }
    
    assignment = new this({
      batchId,
      batchName: batch.batchName,
      degreeLevel: batch.degreeLevel,
      department: batch.departmentName,
      currentSemester: batch.currentSemester,
      graduationStatus: batch.graduationStatus,
      totalSemesters: batch.totalSemesters,
      semesterAssignments
    });
    
    await assignment.save();
  }
  
  return assignment;
};

teacherAssignmentSchema.statics.assignFacultyToSection = async function(
  batchId, 
  semester, 
  courseCode, 
  sectionName, 
  facultyId,
  facultyName,
  session = null
) {
  const Faculty = mongoose.model('Faculty');
  const Batch = mongoose.model('Batch');
  const Timetable = mongoose.model('Timetable');
  
  const batch = await Batch.findById(batchId).session(session);
  if (!batch) {
    throw new Error('Batch not found');
  }
  
  const faculty = await Faculty.findById(facultyId).session(session);
  if (!faculty) {
    throw new Error('Faculty not found');
  }
  
  const assignment = await this.getOrCreateBatchAssignment(batchId);
  const semesterKey = semester.toString();
  
  if (!assignment.semesterAssignments.has(semesterKey)) {
    throw new Error(`Semester ${semester} not found in batch assignments`);
  }
  
  const semesterAssignment = assignment.semesterAssignments.get(semesterKey);
  
  const course = semesterAssignment.assignments.find(c => c.courseCode === courseCode);
  if (!course) {
    throw new Error(`Course ${courseCode} not found in semester ${semester} assignments`);
  }
  
  const semesterData = batch.academicCalendar?.find(s => s.semester === semester);
  const now = new Date();
  const isSemesterCompleted = semesterData && isAfter(now, semesterData.endDate);
  
  const teachingStatus = isSemesterCompleted ? 'completed' : 'in-progress';
  const status = isSemesterCompleted ? 'inactive' : 'active';
  
  let section = course.sections.find(s => s.sectionName === sectionName);
  const previousFacultyId = section?.facultyId?.toString();
  
  if (section) {
    section.facultyId = facultyId;
    section.facultyName = facultyName;
    section.assignedAt = new Date();
    section.teachingStatus = teachingStatus;
    section.status = status;
  } else {
    course.sections.push({
      sectionName: sectionName,
      facultyId: facultyId,
      facultyName: facultyName,
      assignedAt: new Date(),
      teachingStatus: teachingStatus,
      status: status
    });
  }
  
  assignment.semesterAssignments.set(semesterKey, semesterAssignment);
  await assignment.save({ session });
  
  if (previousFacultyId && previousFacultyId !== facultyId.toString()) {
    console.log(`🔄 Teacher changed for ${courseCode}-${sectionName}, removing time slots`);
    await Timetable.removeCourseSectionTimeSlots(batchId, semester, courseCode, sectionName, session);
  }
  
  return {
    assignment,
    teachingStatus,
    creditHrs: course.creditHrs,
    previousFacultyId,
    isSemesterCompleted
  };
};

teacherAssignmentSchema.statics.removeFacultyAssignment = async function(
  batchId, 
  semester, 
  courseCode, 
  sectionName,
  session = null
) {
  const Timetable = mongoose.model('Timetable');
  
  const assignment = await this.findOne({ batchId }).session(session);
  
  if (!assignment) {
    throw new Error('Assignment record not found');
  }
  
  const semesterKey = semester.toString();
  if (!assignment.semesterAssignments.has(semesterKey)) {
    throw new Error(`Semester ${semester} not found in batch assignments`);
  }
  
  const semesterAssignment = assignment.semesterAssignments.get(semesterKey);
  const course = semesterAssignment.assignments.find(c => c.courseCode === courseCode);
  
  if (!course) {
    throw new Error(`Course ${courseCode} not found in semester ${semester}`);
  }
  
  const sectionIndex = course.sections.findIndex(s => s.sectionName === sectionName);
  
  if (sectionIndex === -1) {
    throw new Error(`Section assignment not found`);
  }
  
  const removedSection = course.sections[sectionIndex];
  course.sections.splice(sectionIndex, 1);
  
  assignment.semesterAssignments.set(semesterKey, semesterAssignment);
  await assignment.save({ session });
  
  console.log(`🗑️ Teacher removed from ${courseCode}-${sectionName}, removing time slots`);
  await Timetable.removeCourseSectionTimeSlots(batchId, semester, courseCode, sectionName, session);
  
  return {
    assignment,
    removedSection,
    creditHrs: course.creditHrs
  };
};

teacherAssignmentSchema.statics.handleSemesterCompletion = async function(batchId, semester, session = null) {
  const FacultyAssignmentService = require('../services/FacultyAssignmentService');
  
  const assignment = await this.findOne({ batchId }).session(session);
  if (!assignment) {
    console.log(`No assignment found for batch ${batchId}`);
    return null;
  }

  const semesterKey = semester.toString();
  if (!assignment.semesterAssignments.has(semesterKey)) {
    console.log(`Semester ${semester} not found in assignments`);
    return null;
  }

  const semesterAssignment = assignment.semesterAssignments.get(semesterKey);
  
  let totalWorkloadReduction = 0;
  const facultyUpdates = [];

  semesterAssignment.assignments.forEach(course => {
    course.sections.forEach(section => {
      if (section.facultyId && section.teachingStatus === 'in-progress') {
        section.teachingStatus = 'completed';
        section.status = 'inactive';
        
        facultyUpdates.push({
          facultyId: section.facultyId,
          courseData: {
            batchId: batchId,
            semester: semester,
            courseCode: course.courseCode,
            sectionName: section.sectionName,
            creditHrs: course.creditHrs
          }
        });
        
        totalWorkloadReduction += course.creditHrs;
        console.log(`Marking section ${section.sectionName} as completed for faculty ${section.facultyName}`);
      }
    });
  });

  if (facultyUpdates.length > 0) {
    for (const update of facultyUpdates) {
      try {
        await FacultyAssignmentService.completeCourseAssignment(
          update.facultyId,
          update.courseData,
          session
        );
      } catch (error) {
        console.error(`Error completing assignment for faculty ${update.facultyId}:`, error);
      }
    }
    console.log(`Completed ${facultyUpdates.length} faculty assignments`);
  }

  semesterAssignment.isActive = false;
  semesterAssignment.status = 'past';
  assignment.semesterAssignments.set(semesterKey, semesterAssignment);
  
  await assignment.save({ session });
  console.log(`Semester ${semester} marked as completed, total workload reduced: ${totalWorkloadReduction}`);
  
  return assignment;
};

teacherAssignmentSchema.statics.handleBatchGraduation = async function(batchId, session = null) {
  const assignment = await this.findOne({ batchId }).session(session);
  if (!assignment) return null;

  assignment.graduationStatus = 'graduated';
  assignment.isActive = false;

  for (let [semesterKey, semesterAssignment] of assignment.semesterAssignments.entries()) {
    semesterAssignment.isActive = false;
    semesterAssignment.status = 'past';
    
    semesterAssignment.assignments.forEach(course => {
      course.sections.forEach(section => {
        if (section.teachingStatus === 'in-progress') {
          section.teachingStatus = 'completed';
          section.status = 'inactive';
        }
      });
    });
    
    assignment.semesterAssignments.set(semesterKey, semesterAssignment);
  }

  await assignment.save({ session });
  return assignment;
};

teacherAssignmentSchema.statics.cleanupInactiveFacultyAssignments = async function(session = null) {
  try {
    const Faculty = mongoose.model('Faculty');
    const Timetable = mongoose.model('Timetable');
    
    const inactiveFaculty = await Faculty.find({ isActive: false })
      .select('_id firstName lastName')
      .session(session);
    
    const inactiveFacultyIds = inactiveFaculty.map(f => f._id.toString());
    let totalCleaned = 0;
    
    console.log(`Found ${inactiveFacultyIds.length} inactive faculty to clean`);

    if (inactiveFacultyIds.length === 0) {
      return { cleanedAssignments: 0, message: 'No inactive faculty found' };
    }

    const assignments = await this.find({
      'semesterAssignments.assignments.sections.facultyId': { 
        $in: inactiveFacultyIds 
      }
    }).session(session);

    console.log(`Processing ${assignments.length} TeacherAssignment records`);

    for (const assignment of assignments) {
      let assignmentUpdated = false;
      
      for (let [semesterKey, semesterAssignment] of assignment.semesterAssignments.entries()) {
        const semesterNum = parseInt(semesterKey);
        
        semesterAssignment.assignments.forEach(course => {
          const courseCode = course.courseCode;
          
          course.sections.forEach(section => {
            if (section.facultyId && inactiveFacultyIds.includes(section.facultyId.toString())) {
              console.log(`Cleaning inactive faculty from: ${assignment.batchName}, Semester ${semesterNum}, ${courseCode}, ${section.sectionName}`);
              
              section.facultyId = null;
              section.facultyName = "";
              section.status = 'active';
              section.assignedAt = null;
              section.teachingStatus = 'in-progress';
              
              assignmentUpdated = true;
              totalCleaned++;
            }
          });
        });
        
        if (assignmentUpdated) {
          assignment.semesterAssignments.set(semesterKey, semesterAssignment);
        }
      }
      
      if (assignmentUpdated) {
        await assignment.save({ session });
      }
    }

    for (const facultyId of inactiveFacultyIds) {
      try {
        const timetableResult = await Timetable.removeFacultyTimeSlots(facultyId, session);
        console.log(`Removed time slots for inactive faculty ${facultyId}:`, timetableResult);
      } catch (error) {
        console.error(`Error removing time slots for faculty ${facultyId}:`, error);
      }
    }

    console.log(`Cleanup completed: ${totalCleaned} sections cleaned`);

    return {
      cleanedAssignments: totalCleaned,
      inactiveFacultyCount: inactiveFacultyIds.length,
      message: `Cleaned ${totalCleaned} assignments from ${inactiveFacultyIds.length} inactive faculty and removed associated time slots`
    };
  } catch (error) {
    console.error('TeacherAssignment cleanup failed:', error);
    throw new Error(`Cleanup failed: ${error.message}`);
  }
};

teacherAssignmentSchema.statics.handleFacultyReactivation = async function(facultyId, session = null) {
  try {
    console.log(`Faculty ${facultyId} reactivated - assignments remain removed until manually reassigned`);
    
    return {
      success: true,
      message: 'Faculty reactivated - previous assignments remain removed and require manual reassignment'
    };
  } catch (error) {
    throw new Error(`Faculty reactivation handling failed: ${error.message}`);
  }
};

teacherAssignmentSchema.methods.removeCourseFromTimetables = async function(courseCode, sectionName, semester, session = null) {
  try {
    console.log(`Removing ${courseCode}-${sectionName} from all timetables due to teacher change`);
    
    const Timetable = mongoose.model('Timetable');
    const result = await Timetable.removeCourseSectionTimeSlots(
      this.batchId,
      semester,
      courseCode,
      sectionName,
      session
    );
    
    return result;
  } catch (error) {
    console.error('Error removing course from timetables:', error);
    throw error;
  }
};

teacherAssignmentSchema.statics.handleFacultyBlock = async function(facultyId, session = null) {
  try {
    console.log(` Handling faculty block for ${facultyId}`);
    
    const Timetable = mongoose.model('Timetable');
    
    const timetableResult = await Timetable.removeFacultyTimeSlots(facultyId, session);
    
    const assignments = await this.find({
      'semesterAssignments.assignments.sections.facultyId': facultyId,
      isActive: true
    }).session(session);

    let updatedAssignments = 0;
    for (const assignment of assignments) {
      let needsUpdate = false;
      
      for (let [semesterKey, semesterAssignment] of assignment.semesterAssignments.entries()) {
        semesterAssignment.assignments.forEach(courseAssignment => {
          courseAssignment.sections.forEach(section => {
            if (section.facultyId?.toString() === facultyId.toString() && section.status === 'active') {
              section.status = 'inactive';
              section.inactiveReason = 'faculty_blocked';
              section.inactiveAt = new Date();
              needsUpdate = true;
            }
          });
        });
        
        if (needsUpdate) {
          assignment.semesterAssignments.set(semesterKey, semesterAssignment);
        }
      }
      
      if (needsUpdate) {
        await assignment.save({ session });
        updatedAssignments++;
      }
    }
    
    return {
      timetableResult,
      assignmentsUpdated: updatedAssignments,
      message: `Faculty ${facultyId} blocked and removed from all timetables`
    };
  } catch (error) {
    console.error('Error handling faculty block:', error);
    throw error;
  }
};

module.exports = mongoose.model('TeacherAssignment', teacherAssignmentSchema);