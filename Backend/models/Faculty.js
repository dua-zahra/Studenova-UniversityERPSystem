const mongoose = require('mongoose');

const assignedCourseSchema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  batchName: { type: String, required: true },
  semester: { type: Number, required: true },
  courseCode: { type: String, required: true },
  courseName: { type: String, required: true },
  sectionName: { type: String, required: true },
  creditHrs: { type: Number, required: true },
  degreeLevel: { type: String, required: true },
  department: { type: String, required: true },
  assignedAt: { type: Date, default: Date.now },
  removedAt: { type: Date },
  completedAt: { type: Date },
  teachingStatus: {
    type: String,
    enum: ['in-progress', 'completed', 'removed'],
    default: 'in-progress'
  },
  isActive: { type: Boolean, default: true },
  batchStatus: {
    type: String,
    enum: ['pending', 'graduated'],
    default: 'pending'
  }
}, { _id: false });

const facultySchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  universityEmail: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  employeeId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  joiningDate: { type: Date, required: true },
  designation: {
    type: String,
    required: true,
    enum: ['Professor', 'Associate Professor', 'Assistant Professor', 'HOD', 'Dean', 'Lecturer','Senior Lecturer'],
    default: 'Lecturer'
  },
  degreeLevel: { type: String, required: true },
  department: { type: String, required: true },
  gender: { type: String, required: true },
  mobile: { type: String, required: true },
  birthDate: { type: Date, required: true },
  address: { type: String, required: true },
  education: { type: String, required: true },
  specialization: { type: String, required: true },
  experienceYears: { type: Number, required: true },
  previousInstitutions: { type: String, required: true },
  facultyType: { type: String, required: true },
  salary: { type: Number, required: true },
  resume: { type: String },
  degree: { type: String },
  photo: { type: String },
  role: { type: String, default: "faculty" },
  assignedCourses: [assignedCourseSchema],
  currentWorkload: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 24,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value'
    }
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

facultySchema.pre('save', function(next) {
  if (this.isModified('assignedCourses') || this.isModified('isActive')) {
    if (this.isActive) {
      this.currentWorkload = this.assignedCourses
        .filter(c => c.isActive && c.teachingStatus === 'in-progress')
        .reduce((sum, course) => sum + course.creditHrs, 0);
    } else {
      this.currentWorkload = 0;
      
      this.assignedCourses.forEach(course => {
        if (course.isActive && course.teachingStatus === 'in-progress') {
          course.teachingStatus = 'removed';
          course.isActive = false;
          course.removedAt = new Date();
        }
      });
    }
  }
  next();
});

facultySchema.methods.removeCourseAssignment = function(batchId, semester, courseCode, sectionName) {
  const courseIndex = this.assignedCourses.findIndex(course =>
    course.batchId.toString() === batchId.toString() &&
    course.semester === semester &&
    course.courseCode === courseCode &&
    course.sectionName === sectionName &&
    course.isActive
  );

  if (courseIndex === -1) {
    return false;
  }

  const course = this.assignedCourses[courseIndex];
  
  course.teachingStatus = 'removed';
  course.isActive = false;
  course.removedAt = new Date();

  if (course.teachingStatus === 'in-progress') {
    this.currentWorkload = Math.max(0, this.currentWorkload - course.creditHrs);
  }

  return true;
};

facultySchema.methods.completeCourseAssignment = function(batchId, semester, courseCode, sectionName) {
  const courseIndex = this.assignedCourses.findIndex(course =>
    course.batchId.toString() === batchId.toString() &&
    course.semester === semester &&
    course.courseCode === courseCode &&
    course.sectionName === sectionName &&
    course.teachingStatus === 'in-progress'
  );

  if (courseIndex === -1) {
    return false;
  }

  const course = this.assignedCourses[courseIndex];
  
  course.teachingStatus = 'completed';
  course.isActive = false;
  course.completedAt = new Date();

  this.currentWorkload = Math.max(0, this.currentWorkload - course.creditHrs);

  return true;
};
facultySchema.methods.handleFacultyBlock = async function(session = null) {
  const TeacherAssignment = mongoose.model('TeacherAssignment');
  const Batch = mongoose.model('Batch');
  
  try {
    console.log(`🚨 BLOCKING FACULTY: ${this.firstName} ${this.lastName} (${this._id})`);

    // 1. Remove all active course assignments from faculty (for current workload)
    let removedCount = 0;
    this.assignedCourses.forEach(course => {
      if (course.isActive && course.teachingStatus === 'in-progress') {
        course.teachingStatus = 'removed';
        course.isActive = false;
        course.removedAt = new Date();
        removedCount++;
        console.log(`📚 Removed faculty course: ${course.courseCode} - ${course.sectionName}`);
      }
    });

    this.currentWorkload = 0;
    await this.save({ session });
    console.log(`✅ Faculty courses cleaned: ${removedCount} courses removed`);

    // 2. Remove from CURRENT and FUTURE TeacherAssignment records ONLY
    const allAssignments = await TeacherAssignment.find({}).session(session);
    console.log(`🔍 Checking ${allAssignments.length} TeacherAssignment records`);

    let teacherAssignmentsCleaned = 0;
    const now = new Date();

    for (const assignment of allAssignments) {
      let wasUpdated = false;
      
      // Get batch to check semester dates
      const batch = await Batch.findById(assignment.batchId).session(session);
      if (!batch) continue;
      
      // Check EVERY semester in this assignment
      for (let [semesterKey, semesterData] of assignment.semesterAssignments.entries()) {
        const semesterNum = parseInt(semesterKey);
        
        // Check if this semester is CURRENT or FUTURE (not PAST)
        const semesterAcademicData = batch.academicCalendar?.find(s => s.semester === semesterNum);
        let isPastSemester = false;
        
        if (semesterAcademicData) {
          // If semester end date has passed, it's a PAST semester - PRESERVE assignments
          isPastSemester = new Date() > new Date(semesterAcademicData.endDate);
        } else {
          isPastSemester = semesterNum < batch.currentSemester;
        }
        
        if (!isPastSemester) {
          console.log(`🔵 Processing ${isPastSemester ? 'PAST' : 'CURRENT/FUTURE'} semester ${semesterNum}`);
          
          for (let course of semesterData.assignments) {
            for (let section of course.sections) {
              if (section.facultyId && section.facultyId.toString() === this._id.toString()) {
                console.log(`🗑️ REMOVING from ${isPastSemester ? 'PAST' : 'CURRENT/FUTURE'} semester: ${assignment.batchName} - Semester ${semesterNum} - ${course.courseCode} - ${section.sectionName}`);
                
                section.facultyId = null;
                section.facultyName = "";
                section.assignedAt = null;
                
                wasUpdated = true;
                teacherAssignmentsCleaned++;
              }
            }
          }
        } else {
          for (let course of semesterData.assignments) {
            for (let section of course.sections) {
              if (section.facultyId && section.facultyId.toString() === this._id.toString()) {
                console.log(` PRESERVING past assignment: ${assignment.batchName} - Semester ${semesterNum} - ${course.courseCode} - ${section.sectionName}`);
              }
            }
          }
        }
      }
      
      if (wasUpdated) {
        await assignment.save({ session });
        console.log(`Saved updated TeacherAssignment: ${assignment.batchName}`);
      }
    }

    console.log(` BLOCK COMPLETE: Faculty ${this.firstName} ${this.lastName}`);
    console.log(`Summary: ${removedCount} faculty courses removed, ${teacherAssignmentsCleaned} CURRENT/FUTURE TeacherAssignment sections cleaned`);

    return {
      success: true,
      facultyCoursesRemoved: removedCount,
      teacherAssignmentsCleaned: teacherAssignmentsCleaned,
      facultyId: this._id
    };

  } catch (error) {
    console.error(` BLOCK FAILED for ${this.firstName} ${this.lastName}:`, error);
    throw error;
  }
};
facultySchema.methods.handleFacultyReactivation = async function(session = null) {
  try {
    console.log(`Faculty ${this._id} reactivated - previous assignments remain removed`);
    
    this.currentWorkload = 0;
    
    await this.save({ session });
    
    return {
      success: true,
      facultyId: this._id,
      message: 'Faculty reactivated successfully - previous assignments remain removed and require manual reassignment'
    };
  } catch (error) {
    throw new Error(`Faculty reactivation failed: ${error.message}`);
  }
};
facultySchema.methods.syncNameToTeacherAssignments = async function(session = null) {
  const TeacherAssignment = mongoose.model('TeacherAssignment');
  
  try {
    console.log(`SYNCING NAME: ${this.firstName} ${this.lastName} (${this._id})`);
    
    const newFullName = `${this.firstName} ${this.lastName}`;
    let updatedCount = 0;

    const allAssignments = await TeacherAssignment.find({}).session(session);
    
    console.log(`Checking ${allAssignments.length} TeacherAssignment records for name sync`);

    for (const assignment of allAssignments) {
      let wasUpdated = false;
      
      for (let [semesterKey, semesterData] of assignment.semesterAssignments.entries()) {
        for (let course of semesterData.assignments) {
          for (let section of course.sections) {
            if (section.facultyId && section.facultyId.toString() === this._id.toString()) {
              console.log(` Updating name: ${section.facultyName} → ${newFullName}`);
              section.facultyName = newFullName;
              wasUpdated = true;
              updatedCount++;
            }
          }
        }
      }
      
      if (wasUpdated) {
        await assignment.save({ session });
        console.log(` Saved name updates for batch: ${assignment.batchName}`);
      }
    }

    console.log(`NAME SYNC COMPLETE: ${updatedCount} sections updated`);
    return { success: true, sectionsUpdated: updatedCount };

  } catch (error) {
    console.error(` NAME SYNC FAILED:`, error);
    throw error;
  }
};
module.exports = mongoose.model('Faculty', facultySchema);