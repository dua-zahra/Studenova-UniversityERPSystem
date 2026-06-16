const mongoose = require('mongoose');
const { addDays, isWeekend, nextMonday, previousFriday, isAfter } = require('date-fns');

const academicCalendarSchema = new mongoose.Schema({
  semester: { type: Number, required: true },
  name: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  midtermStart: { type: Date, required: true },
  midtermEnd: { type: Date, required: true },
  finalStart: { type: Date, required: true },
  finalEnd: { type: Date, required: true },
  breaks: [{
    name: String,
    startDate: Date,
    endDate: Date
  }]
}, { _id: false });

const sectionStudentSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  photo: { type: String, required: true },
  universityEmail: { type: String, required: true },
  contact: { type: String, required: true },
  enrollmentDate: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'dropped', 'graduated', 'suspended'],
    default: 'active'
  }
}, { _id: false });

const sectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  students: [sectionStudentSchema],
  currentStrength: { type: Number, default: 0 }
}, { _id: false });

const BatchSchema = new mongoose.Schema({
  batchName: { type: String, required: true, unique: true, uppercase: true },
  degreeLevel: { 
    type: String, 
    required: true,
    enum: ['undergraduate', 'graduate', 'phd'],
    lowercase: true 
  },
  department: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Department', 
    required: true 
  },
  departmentName: { type: String, required: true },
  departmentCode: { type: String, required: true, uppercase: true },
  enrollmentYear: { type: Number, required: true, min: 2000, max: 2100 },
  graduationYear: { type: Number, required: true },
  semesterStart: { type: String, enum: ['spring', 'fall'], required: true },
  totalSemesters: { type: Number, required: true, min: 1, max: 10 },
  currentSemester: { 
    type: Number, 
    default: 1, 
    min: 1,
    max: 10
  },
  admissionStartDate: { type: Date },
  admissionEndDate: { type: Date }, 
  academicCalendar: [academicCalendarSchema],
  sections: [sectionSchema],
  totalStudentsEnrolled: { type: Number, default: 0 },
   statusCounts: {
    active: { type: Number, default: 0 },
    inactive: { type: Number, default: 0 },
    dropped: { type: Number, default: 0 },
    graduated: { type: Number, default: 0 },
    suspended: { type: Number, default: 0 }
  },
  totalSections: { type: Number, default: 0 },
  sectionRules: {
    maxStudents: {
      type: Number,
      default: 20,
      min: 10
    },
    minStudents: {
      type: Number,
      default: 15,
      min: 5
    },
    assignmentMethod: {
      type: String,
      enum: ['enrollmentDate', 'roundRobin', 'random'],
      default: 'enrollmentDate'
    }
  },
  isActive: { type: Boolean, default: true },
  enrollmentStatus: { 
    type: String, 
    enum: ['open', 'closed'], 
    default: 'open' 
  },
graduationStatus: {
  type: String,
  enum: ['pending', 'graduated'],
  default: 'pending'
}
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

BatchSchema.virtual('duration').get(function() {
  return this.graduationYear - this.enrollmentYear;
});

BatchSchema.pre('save', async function(next) {
  const degreeDuration = {
    undergraduate: 4,
    graduate: 2,
    phd: 4
  }[this.degreeLevel] || 4;
  
  this.graduationYear = this.enrollmentYear + degreeDuration;
  this.totalSemesters = degreeDuration * 2;

  if ((!this.departmentName || !this.departmentCode) && this.department) {
    const dept = await mongoose.model('Department').findById(this.department);
    if (dept) {
      this.departmentName = dept.departmentName;
      this.departmentCode = dept.departmentCode;
    }
  }

  if (this.isModified('sections')) {
    this.statusCounts = { active: 0, inactive: 0, dropped: 0, graduated: 0, suspended: 0 };
    
    this.sections.forEach(section => {
      section.students.forEach(student => {
        if (this.statusCounts[student.status] !== undefined) {
          this.statusCounts[student.status] += 1;
        }
      });
    });
  }

  if (this.isNew) {
    this.academicCalendar = this.generateAcademicCalendar();
    this.currentSemester = this.findCurrentSemester();
    
    const lastSemester = this.academicCalendar[this.academicCalendar.length - 1];
    const now = new Date();
    if (lastSemester && now > lastSemester.endDate) {
      this.isActive = false;
      this.enrollmentStatus = 'closed';
      this.graduationStatus = 'graduated';
    }
    
    if (this.academicCalendar.length > 0 && !this.admissionEndDate) {
      const firstSemester = this.academicCalendar[0];
      this.admissionEndDate = addDays(firstSemester.startDate, 3);
      
      if (now > this.admissionEndDate) {
        this.enrollmentStatus = 'closed';
      }
    }
  }
  
  next();
});

BatchSchema.methods.findCurrentSemester = function() {
  const now = new Date();
  
  if (this.academicCalendar.length > 0 && now < this.academicCalendar[0].startDate) {
    return 1;
  }
  
  const lastSemester = this.academicCalendar[this.academicCalendar.length - 1];
  if (lastSemester && now > lastSemester.endDate) {
    return this.totalSemesters; 
  }
  
  for (let i = 0; i < this.academicCalendar.length; i++) {
    const sem = this.academicCalendar[i];
    const startDate = new Date(sem.startDate);
    const endDate = new Date(sem.endDate);
    
    if (now >= startDate && now <= endDate) {
      return sem.semester;
    }
  }
  
  for (let i = this.academicCalendar.length - 1; i >= 0; i--) {
    const sem = this.academicCalendar[i];
    const endDate = new Date(sem.endDate);
    
    if (now > endDate) {
      return sem.semester;
    }
  }
  
  return 1;
};

BatchSchema.methods.generateAcademicCalendar = function() {
  const calendar = [];
  let currentYear = this.enrollmentYear;
  const isSpringStart = this.semesterStart === 'spring';

  for (let sem = 1; sem <= this.totalSemesters; sem++) {
    const isSpringSemester = isSpringStart ? sem % 2 === 1 : sem % 2 === 0;
    const semesterData = this.generateSemester(currentYear, sem, isSpringSemester);
    calendar.push(semesterData);
    
    if (!isSpringSemester) currentYear++;
  }

  return calendar;
};

BatchSchema.methods.generateSemester = function(year, semesterNumber, isSpring) {
  let startDate, endDate;
  const isFallBatch = this.semesterStart === 'fall';

  if (isFallBatch) {
    if (semesterNumber % 2 === 1) {
      startDate = this.ensureWeekday(new Date(year, 7, 18));
      endDate = this.ensureWeekdayEnd(new Date(year, 11, 22));
    } else {
      startDate = this.ensureWeekday(new Date(year, 0, 10));
      endDate = this.ensureWeekdayEnd(new Date(year, 4, 30));
    }
  } else {
    if (semesterNumber === 1) {
      startDate = this.ensureWeekday(new Date(year, 2, 14));
      endDate = this.ensureWeekdayEnd(new Date(year, 7, 15));
    } else if (semesterNumber % 2 === 0) {
      startDate = this.ensureWeekday(new Date(year, 7, 18));
      endDate = this.ensureWeekdayEnd(new Date(year, 11, 22));
    } else {
      startDate = this.ensureWeekday(new Date(year, 0, 10));
      endDate = this.ensureWeekdayEnd(new Date(year, 4, 30));
    }
  }

  const semesterName = isFallBatch 
    ? (semesterNumber % 2 === 1 ? 'Fall' : 'Spring')
    : (semesterNumber === 1 ? 'Spring' : (semesterNumber % 2 === 0 ? 'Fall' : 'Spring'));

  return {
    semester: semesterNumber,
    name: `${semesterName} ${year}`,
    startDate,
    endDate,
    midtermStart: this.ensureWeekday(addDays(startDate, 7 * 5)),
    midtermEnd: this.ensureWeekday(addDays(startDate, 7 * 7)),
    finalStart: this.ensureWeekday(addDays(endDate, -14)),
    finalEnd: this.ensureWeekdayEnd(endDate),
    breaks: this.generateBreaks(year, semesterName === 'Spring', endDate)
  };
};

BatchSchema.methods.generateBreaks = function(year, isSpring, semesterEndDate) {
  if (isSpring) {
    return [{
      name: 'Summer Break',
      startDate: addDays(semesterEndDate, 1),
      endDate: this.ensureWeekday(new Date(year, 7, 17)) 
    }];
  } else {
    return [{
      name: 'Winter Break',
      startDate: addDays(semesterEndDate, 1),
      endDate: this.ensureWeekday(new Date(year + 1, 0, 9)) 
    }];
  }
};

BatchSchema.methods.ensureWeekday = function(date) {
  return isWeekend(date) ? nextMonday(date) : date;
};

BatchSchema.methods.ensureWeekdayEnd = function(date) {
  if (isWeekend(date)) {
    const day = date.getDay();
    const daysToSubtract = day === 0 ? 2 : 1;
    return addDays(date, -daysToSubtract);
  }
  return date;
};

BatchSchema.methods.checkAndAdvanceSemester = async function() {
  const now = new Date();
  let wasAdvanced = false;
  
  const correctSemester = this.findCurrentSemester();
  
  if (this.currentSemester < correctSemester) {
    this.currentSemester = correctSemester;
    wasAdvanced = true;
  }
  
  const currentSemesterData = this.academicCalendar.find(
    sem => sem.semester === this.currentSemester
  );

  if (currentSemesterData && isAfter(now, currentSemesterData.endDate)) {
    if (this.currentSemester >= this.totalSemesters) {
      this.isActive = false;
      this.enrollmentStatus = 'closed'; 
      this.graduationStatus = 'graduated'; 
      await this.save();
      return true;
    }

    this.currentSemester += 1;
    wasAdvanced = true;
  }

  if (wasAdvanced) {
    await this.save();
  }
  
  return wasAdvanced;
};

BatchSchema.methods.assignStudentOptimally = async function(studentData, session = null) {
  if (this.sections.length === 0) {
    const newSection = {
      name: 'Section A',
      students: [],
      currentStrength: 0
    };
    this.sections.push(newSection);
    this.totalSections = 1;
  }

  let targetSection = null;
  let maxStudentsInSection = -1;
  
  for (const section of this.sections) {
    if (section.currentStrength < this.sectionRules.maxStudents) {
      if (section.currentStrength > maxStudentsInSection) {
        targetSection = section;
        maxStudentsInSection = section.currentStrength;
      }
    }
  }

  if (!targetSection) {
    const totalActiveStudents = this.statusCounts.active || 0;
    const averagePerSection = totalActiveStudents / this.sections.length;
    
    if (averagePerSection >= this.sectionRules.minStudents * 0.7) {
      const sectionLetter = String.fromCharCode(65 + this.sections.length);
      targetSection = {
        name: `Section ${sectionLetter}`,
        students: [],
        currentStrength: 0
      };
      this.sections.push(targetSection);
      this.totalSections += 1;
    } else {
      await this.rebalanceSections(session);
      
      targetSection = this.sections.reduce((best, section) => {
        if (!best || section.currentStrength < best.currentStrength) {
          return section;
        }
        return best;
      }, this.sections[0]);
    }
  }

  const studentStatus = studentData.status || 'active';
  
  targetSection.students.push({
    studentId: studentData.studentId,
    firstName: studentData.firstName,
    lastName: studentData.lastName,
    photo: studentData.photoPath,
    universityEmail: studentData.universityEmail,
    contact: studentData.contactNumber,
    status: studentStatus,
    enrollmentDate: new Date()
  });
  
  targetSection.currentStrength += 1;
  this.totalStudentsEnrolled += 1;
  this.statusCounts[studentStatus] += 1;

  const sectionSizes = this.sections.map(s => s.currentStrength);
  const maxDiff = Math.max(...sectionSizes) - Math.min(...sectionSizes);
  
  if (maxDiff > 2 && this.sections.length > 1) {
    await this.rebalanceSections(session);
  }

  const saveOptions = session ? { session } : {};
  await this.save(saveOptions);

  return targetSection.name;
};

BatchSchema.methods.updateStudentStatus = async function(studentId, oldStatus, newStatus, session = null) {
  let studentFound = false;
  
  for (const section of this.sections) {
    const student = section.students.find(s => s.studentId === studentId);
    if (student) {
      student.status = newStatus;
      studentFound = true;
      
      if (oldStatus && this.statusCounts[oldStatus] > 0) {
        this.statusCounts[oldStatus] -= 1;
      }
      this.statusCounts[newStatus] += 1;
      
      break;
    }
  }
  
  if (studentFound) {
    const saveOptions = session ? { session } : {};
    await this.save(saveOptions);
  }
  
  return studentFound;
};

BatchSchema.methods.removeStudent = async function(studentId, status, session = null) {
  let studentRemoved = false;
  
  for (const section of this.sections) {
    const studentIndex = section.students.findIndex(s => s.studentId === studentId);
    if (studentIndex !== -1) {
      section.students.splice(studentIndex, 1);
      section.currentStrength -= 1;
      this.totalStudentsEnrolled -= 1;
      
      if (status && this.statusCounts[status] > 0) {
        this.statusCounts[status] -= 1;
      }
      
      studentRemoved = true;
      break;
    }
  }
  
  this.sections = this.sections.filter(section => section.currentStrength > 0);
  this.totalSections = this.sections.length;
  
  if (studentRemoved) {
    const saveOptions = session ? { session } : {};
    await this.save(saveOptions);
  }
  
  return studentRemoved;
};

BatchSchema.methods.rebalanceSections = async function(session = null) {
  const Student = mongoose.model('Student');
  const totalActiveStudents = this.statusCounts.active || 0;
  
  if (this.sections.length === 0 || totalActiveStudents === 0) {
    return { rebalanced: false, changes: 0 };
  }

  const idealPerSection = Math.ceil(totalActiveStudents / this.sections.length);
  const currentMax = Math.max(...this.sections.map(s => s.currentStrength));
  const currentMin = Math.min(...this.sections.map(s => s.currentStrength));
  
  if (currentMax - currentMin <= 2) {
    return { rebalanced: false, changes: 0 };
  }

  let allActiveStudents = [];
  this.sections.forEach(section => {
    const activeStudents = section.students.filter(s => s.status === 'active');
    allActiveStudents = allActiveStudents.concat(activeStudents.map(s => ({
      ...s.toObject(),
      originalSection: section.name
    })));
    
    section.students = [];
    section.currentStrength = 0;
  });

  allActiveStudents.sort((a, b) => a.enrollmentDate - b.enrollmentDate);

  let changes = 0;
  const studentUpdates = [];

  for (let i = 0; i < allActiveStudents.length; i++) {
    const student = allActiveStudents[i];
    const targetSectionIndex = i % this.sections.length;
    const targetSection = this.sections[targetSectionIndex];
    
    targetSection.students.push(student);
    targetSection.currentStrength += 1;
    
    if (targetSection.name !== student.originalSection) {
      changes++;
      studentUpdates.push({
        studentId: student.studentId,
        newSection: targetSection.name
      });
    }
  }

  if (studentUpdates.length > 0) {
    const bulkOps = studentUpdates.map(update => ({
      updateOne: {
        filter: { studentId: update.studentId },
        update: { $set: { section: update.newSection } }
      }
    }));

    const writeOptions = session ? { session } : {};
    await Student.bulkWrite(bulkOps, writeOptions);
  }

  const saveOptions = session ? { session } : {};
  await this.save(saveOptions);
  
  return { rebalanced: true, changes };
};

BatchSchema.methods.advanceSemesterWithAssignments = async function() {
  const now = new Date();
  const currentSemesterData = this.academicCalendar.find(
    sem => sem.semester === this.currentSemester
  );

  if (!currentSemesterData || !isAfter(now, currentSemesterData.endDate)) {
    return false;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await TeacherAssignment.updateOne(
      { batchId: this._id, semester: this.currentSemester },
      { $set: { isActive: false, completedAt: new Date() } },
      { session }
    );

    if (this.currentSemester >= this.totalSemesters) {
      this.isActive = false;
      this.enrollmentStatus = 'closed'; 
      this.graduationStatus = 'graduated';
      await this.save({ session });
      await session.commitTransaction();
      return true;
    }

    this.currentSemester += 1;
    await this.save({ session });

    const courseEntry = await CourseEntry.findOne({ 
      degreeLevel: this.degreeLevel, 
      department: this.departmentName 
    }).session(session);

    if (courseEntry) {
      const semesterCourses = courseEntry.semesters.find(
        sem => sem.semesterNumber === this.currentSemester
      );

      if (semesterCourses) {
        const newAssignment = new TeacherAssignment({
          batchId: this._id,
          degreeLevel: this.degreeLevel,
          department: this.departmentName,
          semester: this.currentSemester,
          isActive: true,
          assignments: semesterCourses.courses.map(course => ({
            courseCode: course.courseCode,
            courseName: course.courseName,
            creditHrs: course.creditHrs,
            sections: []
          }))
        });

        await newAssignment.save({ session });
      }
    }

    await session.commitTransaction();
    return true;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

BatchSchema.methods.markAsGraduated = async function() {
  this.isActive = false;
  this.enrollmentStatus = 'closed';
  this.graduationStatus = 'graduated';
  this.currentSemester = this.totalSemesters;
    await mongoose.model('Student').updateMany(
    {
      batch: this._id,
      status: 'active'  
    },
    {
      $set: { 
        status: 'graduated'
      }
    }
  );
  
  return this.save();
};



BatchSchema.methods.updateStudentStatus = async function(studentId, oldStatus, newStatus, session = null) {
  let studentFound = false;
  
  for (const section of this.sections) {
    const student = section.students.find(s => s.studentId === studentId);
    if (student) {
      student.status = newStatus;
      studentFound = true;
      
      if (oldStatus && this.statusCounts[oldStatus] > 0) {
        this.statusCounts[oldStatus] -= 1;
      }
      this.statusCounts[newStatus] += 1;
      
      break;
    }
  }
  
  if (studentFound) {
    const saveOptions = session ? { session } : {};
    await this.save(saveOptions);
  }
  
  return studentFound;
};

module.exports = mongoose.model('Batch', BatchSchema);