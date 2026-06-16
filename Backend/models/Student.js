

const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const { isAfter, isBefore } = require('date-fns');

const DEGREE_CONFIG = {
  Undergraduate: {
    maxSemesters: 8,
    maxDepartmentCredits: 133,
    creditRange: [1, 4],
    semesterLimits: { 1: 18, 2: 18, 3: 18, 4: 18, 5: 17, 6: 17, 7: 15, 8: 12 }
  },
  Graduate: {
    maxSemesters: 6,
    maxDepartmentCredits: 72,
    creditRange: [1, 3],
    semesterLimits: { 1: 12, 2: 12, 3: 12, 4: 12, 5: 12, 6: 12 }
  },
  PhD: {
    maxSemesters: 8,
    maxDepartmentCredits: 48,
    creditRange: [1, 3],
    semesterLimits: { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9 }
  }
};

const GRADE_POINTS = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0, 'F': 0.0
};

const qualificationSchema = new mongoose.Schema({
  institution: { type: String, required: true, trim: true },
  year: { 
    type: Number, 
    required: true, 
    min: 1970, 
    max: new Date().getFullYear(),
    validate: {
      validator: Number.isInteger,
      message: 'Year must be an integer'
    }
  },
  totalMarks: { type: Number, required: true, min: 0 },
  obtainedMarks: { 
    type: Number, 
    required: true, 
    min: 0,
    validate: {
      validator: function(v) { return v <= this.totalMarks; },
      message: 'Obtained marks cannot exceed total marks'
    }
  },
  boardUniversity: { type: String, required: true, trim: true },
  documentPath: { type: String, required: true }
}, { _id: false });

const courseProgressSchema = new mongoose.Schema({
  course: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'CourseEntry',
    required: true 
  },
  courseCode: { type: String, required: true },
  courseName: { type: String, required: true },
  semesterTaken: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['registered', 'in-progress', 'completed', 'dropped', 'failed', 'frozen'],
    default: 'registered'
  },
  grade: { type: String, enum: ['A', 'B', 'C', 'D', 'F', 'I', 'W', null], default: null },
  creditsEarned: { type: Number, default: 0 },
  attendance: { type: Number, min: 0, max: 100, default: 0 },
  isRepeated: { type: Boolean, default: false },
  isReplaced: { type: Boolean, default: false },
  originalSemester: { type: Number },
  replacedBy: { type: Number },
  frozenAt: { type: Date },
  unfrozenAt: { type: Date },
  droppedAt: { type: Date },
  dropReason: { type: String },
  repeatedAt: { type: Date },
  enrolledAt: { type: Date, default: Date.now },
  isFresh: { type: Boolean, default: false },
  isProgramCourse: { type: Boolean, default: true },
  isExternalCourse: { type: Boolean, default: false },
  freshEnrollmentReason: { type: String },
  isMakeupCourse: { type: Boolean, default: false },
  isCrossSemester: { type: Boolean, default: false },
  isCrossBatch: { type: Boolean, default: false },
  targetBatch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }
}, { _id: false });

const semesterProgressSchema = new mongoose.Schema({
  semesterNumber: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['upcoming', 'in-progress', 'completed', 'frozen'],
    default: 'upcoming'
  },
  startDate: Date,
  endDate: Date,
  courses: [courseProgressSchema],
  semesterGPA: { type: Number, min: 0, max: 4, default: 0 },
  creditsAttempted: { type: Number, default: 0 },
  creditsEarned: { type: Number, default: 0 },
  qualityPoints: { type: Number, default: 0 },
  frozenAt: { type: Date },
  unfrozenAt: { type: Date },
  freezeReason: { type: String }
}, { _id: false });

const academicProgressSchema = new mongoose.Schema({
  currentSemester: { type: Number, required: true, min: 1 },
  semesters: [semesterProgressSchema],
  totalCreditsEarned: { type: Number, default: 0 },
  totalCreditsRequired: { type: Number, required: true },
  cumulativeGPA: { type: Number, min: 0, max: 4, default: 0 },
  completionPercentage: { type: Number, min: 0, max: 100, default: 0 },
  totalQualityPoints: { type: Number, default: 0 }
}, { _id: false });

const StudentSchema = new mongoose.Schema({
  studentId: { type: String, unique: true },
  universityEmail: { 
    type: String, 
    unique: true,
    validate: [validator.isEmail, 'Invalid email format']
  },
  username: { type: String, unique: true },
  password: { type: String, minlength: 8, select: false },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  fatherFirstName: { type: String, required: true, trim: true },
  fatherLastName: { type: String, required: true, trim: true },
  gender: { type: String, required: true, enum: ['Male', 'Female'] },
  cnic: { type: String, unique: true, required: true },
  birthDate: { type: Date, required: true },
  bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  maritalStatus: { type: String, enum: ['Single', 'Married'] },
  religion: { type: String },
  personalEmail: { 
    type: String, 
    required: true,
    unique: true,
    validate: [validator.isEmail, 'Invalid email format']
  },
  contactNumber: { type: String, required: true },
  emergencyContact: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  province: { 
    type: String, 
    required: true,
    enum: ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan']
  },
  country: { type: String, default: 'Pakistan' },
  postalCode: { type: String },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  degreeLevel: { type: String, required: true },
  department: { type: String, required: true },
  departmentCode: { type: String, uppercase: true },
  section: { type: String },
  currentSemester: { type: Number, required: true, min: 1 },
  admissionType: {
    type: String,
    enum: ['Regular', 'SelfFinance', 'Overseas', 'Scholarship']
  },
  studyMode: {
    type: String,
    enum: ['FullTime', 'PartTime']
  },
  domicileProvince: {
    type: String,
    enum: ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan']
  },
  isScholarshipApplicant: { type: Boolean, default: false },
  scholarshipPercentage: { type: Number, min: 0, max: 100 },
  academicProgress: academicProgressSchema,
  matricQualification: qualificationSchema,
  intermediateQualification: qualificationSchema,
  photoPath: { type: String, required: true },
  domicilePath: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'dropped', 'graduated', 'suspended'],
    default: 'active'
  },
  role: { type: String, default: "student" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });


StudentSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      const batch = await mongoose.model('Batch').findById(this.batch);
      if (!batch) throw new Error('Invalid batch reference');

      const studentDegreeLevel = (this.degreeLevel || '').trim().toLowerCase();
      const studentDepartment = (this.department || '').trim().toLowerCase();

      const batchDegreeLevel = (batch.degreeLevel || '').trim().toLowerCase();
      const batchDepartment = (batch.departmentName || '').trim().toLowerCase();

      if (studentDegreeLevel !== batchDegreeLevel || studentDepartment !== batchDepartment) {
        throw new Error('Degree level or department does not match selected batch');
      }

      const lastStudent = await this.constructor.findOne({ batch: this.batch })
        .sort({ studentId: -1 })
        .select('studentId')
        .lean();

      const deptCode = batch.departmentCode;
      const semesterCode = batch.semesterStart.toLowerCase() === 'spring' ? 'S' : 'F';
      const yearCode = String(batch.enrollmentYear).slice(-2);

      let lastNumber = 0;
      if (lastStudent && lastStudent.studentId) {
        const parts = lastStudent.studentId.split('-');
        if (parts.length === 3) {
          const numPart = parseInt(parts[2], 10);
          if (!isNaN(numPart)) lastNumber = numPart;
        }
      }
      const newNumber = String(lastNumber + 1).padStart(3, '0');

      this.studentId = `${deptCode}-${semesterCode}${yearCode}-${newNumber}`;
      this.universityEmail = `${this.studentId.toLowerCase()}@university.edu.pk`;
      this.username = this.studentId;

      if (!this.password || this.password.length < 8) {
        const defaultPassword = 'student123';
        this.password = await bcrypt.hash(defaultPassword, 12);
      }

      const courseEntry = await mongoose.model('CourseEntry').findOne({
        degreeLevel: this.degreeLevel,
        department: this.department
      });

      if (courseEntry) {
        const allCourses = courseEntry.semesters.flatMap(s => s.courses);
        this.academicProgress = {
          currentSemester: 1,
          totalCreditsRequired: allCourses.reduce((sum, course) => sum + course.creditHrs, 0),
          semesters: [{
            semesterNumber: 1,
            status: 'upcoming',
            courses: []
          }],
          totalCreditsEarned: 0,
          cumulativeGPA: 0,
          completionPercentage: 0
        };
      } else {
        this.academicProgress = {
          currentSemester: 1,
          totalCreditsRequired: 0,
          semesters: [{
            semesterNumber: 1,
            status: 'upcoming',
            courses: []
          }],
          totalCreditsEarned: 0,
          cumulativeGPA: 0,
          completionPercentage: 0
        };
      }

      const academicSemester = batch.academicCalendar.find(s => s.semester === 1);
      if (academicSemester) {
        this.academicProgress.semesters[0].startDate = academicSemester.startDate;
        this.academicProgress.semesters[0].endDate = academicSemester.endDate;
      }

      await this.autoRegisterCourses();

      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

StudentSchema.methods.updateAcademicProgress = function() {
  this.academicProgress.totalCreditsEarned = 0;
  this.academicProgress.totalQualityPoints = 0;
  this.academicProgress.cumulativeGPA = 0;
  
  this.academicProgress.semesters.forEach(semester => {
    semester.creditsAttempted = 0;
    semester.creditsEarned = 0;
    semester.qualityPoints = 0;
    semester.semesterGPA = 0;

    semester.courses.forEach(course => {
      if (course.status === 'completed' && course.grade && !['I', 'W'].includes(course.grade)) {
        const gradePoints = GRADE_POINTS[course.grade] || 0;
        course.gradePoints = gradePoints;
        
        semester.creditsEarned += course.creditsEarned;
        semester.qualityPoints += (gradePoints * course.creditsEarned);
        
        this.academicProgress.totalCreditsEarned += course.creditsEarned;
        this.academicProgress.totalQualityPoints += (gradePoints * course.creditsEarned);
      }
      
      if (course.status !== 'dropped') {
        semester.creditsAttempted += course.creditsEarned;
      }
    });

    if (semester.status === 'completed' && semester.creditsEarned > 0) {
      semester.semesterGPA = semester.qualityPoints / semester.creditsEarned;
    }
  });

  if (this.academicProgress.totalCreditsEarned > 0) {
    this.academicProgress.cumulativeGPA = 
      this.academicProgress.totalQualityPoints / this.academicProgress.totalCreditsEarned;
  }

  if (this.academicProgress.totalCreditsRequired > 0) {
    this.academicProgress.completionPercentage = Math.min(
      100,
      Math.round((this.academicProgress.totalCreditsEarned / this.academicProgress.totalCreditsRequired) * 100)
    );
  }

  this.currentSemester = this.academicProgress.currentSemester;
  
  if (this.academicProgress.completionPercentage >= 100) {
    this.status = 'graduated';
  }
};

StudentSchema.methods.autoRegisterCourses = async function() {
  const currentSemesterObj = this.academicProgress.semesters.find(
    s => s.semesterNumber === this.academicProgress.currentSemester
  );

  if (!currentSemesterObj || currentSemesterObj.status !== 'upcoming') {
    throw new Error('Cannot register courses - semester already started or completed');
  }

  const courseEntry = await mongoose.model('CourseEntry').findOne({
    degreeLevel: this.degreeLevel,
    department: this.department
  }).populate('semesters.courses');

  if (!courseEntry) {
    throw new Error('Course structure not found for this program');
  }

  const semesterCourses = courseEntry.semesters.find(
    s => s.semesterNumber === this.academicProgress.currentSemester
  )?.courses || [];

  const completedCourseIds = this.academicProgress.semesters
    .flatMap(s => s.courses)
    .filter(c => c.status === 'completed')
    .map(c => c.course.toString());

  currentSemesterObj.courses = semesterCourses
    .filter(course => !completedCourseIds.includes(course._id.toString()))
    .map(course => ({
      course: course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      semesterTaken: this.academicProgress.currentSemester,
      status: 'registered',
      creditsEarned: course.creditHrs,
      grade: null,
      attendance: 0,
      gradePoints: 0
    }));

  currentSemesterObj.status = 'in-progress';
  this.updateAcademicProgress();
};

StudentSchema.methods.updateCourseGrade = async function(courseId, grade, session = null) {
  const currentSemester = this.academicProgress.semesters.find(
    s => s.semesterNumber === this.academicProgress.currentSemester
  );
  
  if (!currentSemester || currentSemester.status !== 'in-progress') {
    throw new Error('No active semester to update grades');
  }

  const course = currentSemester.courses.find(c => c.course.equals(courseId));
  if (!course) {
    throw new Error('Course not found in current semester');
  }

  if (!['registered', 'in-progress'].includes(course.status)) {
    throw new Error('Course status cannot be changed');
  }

  course.grade = grade;
  course.status = grade === 'F' ? 'failed' : 'completed';
  
  this.updateAcademicProgress();
  return await this.checkSemesterProgression(session);
};

StudentSchema.methods.checkSemesterProgression = async function(session = null) {
  const currentSemester = this.academicProgress.semesters.find(
    s => s.semesterNumber === this.academicProgress.currentSemester
  );

  if (currentSemester?.status === 'in-progress') {
    const batch = await mongoose.model('Batch').findById(this.batch)
      .select('currentSemester academicCalendar')
      .session(session || null);

    const batchSemester = batch?.academicCalendar?.find(
      s => s.semester === this.academicProgress.currentSemester
    );

    const now = new Date();
    const semesterEnded = (currentSemester.endDate && isAfter(now, currentSemester.endDate)) ||
                         (batchSemester?.endDate && isAfter(now, batchSemester.endDate));

    const incompleteCourses = currentSemester.courses.filter(
      c => !['completed', 'failed', 'dropped'].includes(c.status)
    );

    if (incompleteCourses.length === 0 && semesterEnded) {
      currentSemester.status = 'completed';
      this.updateAcademicProgress();
      
      if (batch && this.academicProgress.currentSemester < batch.currentSemester) {
        await this.advanceToNextSemester(session);
        return true;
      }
    }
  }
  
  return false;
};

StudentSchema.methods.advanceToNextSemester = async function(session = null) {
  if (this.status === 'graduated') {
    throw new Error('Student has already graduated');
  }

  const batch = await mongoose.model('Batch').findById(this.batch).session(session || null);
  
  this.academicProgress.currentSemester += 1;

  const nextSemester = {
    semesterNumber: this.academicProgress.currentSemester,
    status: 'upcoming',
    courses: [],
    semesterGPA: 0,
    creditsAttempted: 0,
    creditsEarned: 0,
    qualityPoints: 0
  };

  const academicSemester = batch?.academicCalendar?.find(
    sem => sem.semester === this.academicProgress.currentSemester
  );

  if (academicSemester) {
    nextSemester.startDate = academicSemester.startDate;
    nextSemester.endDate = academicSemester.endDate;
  }

  this.academicProgress.semesters.push(nextSemester);
  this.updateAcademicProgress();

  await this.autoRegisterCourses();
  return this.save({ session });
};

StudentSchema.methods.checkGraduationEligibility = function() {
  const eligible = this.academicProgress.completionPercentage >= 100;
  return {
    eligible,
    missingCredits: eligible ? 0 : this.academicProgress.totalCreditsRequired - this.academicProgress.totalCreditsEarned,
    currentGPA: this.academicProgress.cumulativeGPA,
    completedSemesters: this.academicProgress.semesters.filter(s => s.status === 'completed').length,
    requiredSemesters: this.academicProgress.semesters.length
  };
};

StudentSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

StudentSchema.methods.initializeAcademicProgress = async function() {
  const batch = await mongoose.model('Batch').findById(this.batch);
  const courseEntry = await mongoose.model('CourseEntry').findOne({
    degreeLevel: this.degreeLevel,
    department: this.department
  });

  if (!batch || !courseEntry) {
    throw new Error('Batch or course structure not found');
  }

  const totalCreditsRequired = courseEntry.semesters.reduce((sum, sem) => 
    sum + sem.courses.reduce((s, c) => s + c.creditHrs, 0), 0
  );

  const currentSemester = this.currentSemester || batch.currentSemester || 1;
  const semesters = [];

  for (let i = 1; i <= batch.totalSemesters; i++) {
    const academicSemester = batch.academicCalendar?.find(s => s.semester === i);
    
    let semesterStatus = 'upcoming';
    if (i < currentSemester) {
      semesterStatus = 'completed';
    } else if (i === currentSemester) {
      semesterStatus = 'in-progress';
    }

    const semesterData = {
      semesterNumber: i,
      status: semesterStatus,
      startDate: academicSemester?.startDate || null,
      endDate: academicSemester?.endDate || null,
      courses: [],
      semesterGPA: 0,
      creditsAttempted: 0,
      creditsEarned: 0,
      qualityPoints: 0
    };

    if (i <= currentSemester) {
      const semesterCourses = courseEntry.semesters.find(s => s.semesterNumber === i)?.courses || [];
      
      semesterData.courses = semesterCourses.map(course => ({
        course: course._id,
        courseCode: course.courseCode,
        courseName: course.courseName,
        semesterTaken: i,
        status: i < currentSemester ? 'completed' : 'registered',
        grade: i < currentSemester ? 'B' : null,
        creditsEarned: course.creditHrs,
        attendance: i < currentSemester ? 85 : 0,
        gradePoints: i < currentSemester ? 3.0 : 0
      }));

      if (i < currentSemester) {
        const completedCourses = semesterData.courses.filter(c => c.status === 'completed');
        semesterData.creditsAttempted = completedCourses.reduce((sum, c) => sum + c.creditsEarned, 0);
        semesterData.creditsEarned = semesterData.creditsAttempted;
        semesterData.qualityPoints = completedCourses.reduce((sum, c) => sum + (c.gradePoints * c.creditsEarned), 0);
        semesterData.semesterGPA = semesterData.creditsEarned > 0 ? 
          semesterData.qualityPoints / semesterData.creditsEarned : 0;
      }
    }

    semesters.push(semesterData);
  }

  const completedSemesters = semesters.filter(s => s.status === 'completed');
  const totalCreditsEarned = completedSemesters.reduce((sum, sem) => sum + sem.creditsEarned, 0);
  const totalQualityPoints = completedSemesters.reduce((sum, sem) => sum + sem.qualityPoints, 0);
  const cumulativeGPA = totalCreditsEarned > 0 ? totalQualityPoints / totalCreditsEarned : 0;
  const completionPercentage = totalCreditsRequired > 0 ? 
    Math.min(100, Math.round((totalCreditsEarned / totalCreditsRequired) * 100)) : 0;

  this.academicProgress = {
    currentSemester,
    semesters,
    totalCreditsEarned,
    totalCreditsRequired,
    cumulativeGPA,
    completionPercentage,
    totalQualityPoints
  };

  return this.save();
};



StudentSchema.methods.getRepeatableCourses = function() {
  const repeatableCourses = [];
  
  this.academicProgress.semesters.forEach(semester => {
    semester.courses.forEach(course => {
      const canRepeat = (
        course.status === 'failed' || 
        course.status === 'dropped' || 
        (course.status === 'completed' && course.grade && ['D', 'F'].includes(course.grade))
      ) && !course.isReplaced;

      if (canRepeat) {
        repeatableCourses.push({
          courseCode: course.courseCode,
          courseName: course.courseName,
          originalSemester: semester.semesterNumber,
          status: course.status,
          grade: course.grade,
          credits: course.creditsEarned,
          semesterTaken: course.semesterTaken,
          canRepeat: true
        });
      }
    });
  });
  
  return repeatableCourses;
};


StudentSchema.methods.getAvailableFreshCourses = async function() {
  try {
    console.log(' Getting available fresh courses for student:', this.studentId);
    
    const courseEntry = await mongoose.model('CourseEntry').findOne({
      degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') },
      department: { $regex: new RegExp(`^${this.department}$`, 'i') }
    });

    if (!courseEntry) {
      console.log(' No course entry found');
      return [];
    }

    const allPastCourses = [];
    courseEntry.semesters.forEach(semester => {
      if (semester.semesterNumber < this.academicProgress.currentSemester) {
        semester.courses.forEach(course => {
          allPastCourses.push({
            courseName: course.courseName,
            courseCode: course.courseCode,
            creditHrs: course.creditHrs,
            type: course.type,
            originalSemester: semester.semesterNumber,
            isProgramCourse: true
          });
        });
      }
    });

    console.log(`Found ${allPastCourses.length} past semester courses`);

    const studiedCourseCodes = new Set();
    this.academicProgress.semesters.forEach(semester => {
      semester.courses.forEach(course => {
        if (course.courseCode && !course.isReplaced && course.status !== 'dropped') {
          studiedCourseCodes.add(course.courseCode.toUpperCase());
        }
      });
    });

    console.log(`Student has studied ${studiedCourseCodes.size} courses`);

    const availableCourses = allPastCourses.filter(course => 
      !studiedCourseCodes.has(course.courseCode.toUpperCase())
    );

    console.log(`Found ${availableCourses.length} available fresh courses from past semesters`);

    return availableCourses;
  } catch (error) {
    console.error('Error getting available fresh courses:', error);
    return [];
  }
};

StudentSchema.methods.findBatchForCourse = async function(courseCode, targetSemester) {
  try {
    console.log(`Finding active batch for course ${courseCode} in semester ${targetSemester}`);
    
    const courseEntry = await mongoose.model('CourseEntry').findOne({
      degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') },
      department: { $regex: new RegExp(`^${this.department}$`, 'i') }
    });

    if (!courseEntry) {
      console.log(' Course entry not found for program');
      return null;
    }

    const semesterCourses = courseEntry.semesters.find(s => s.semesterNumber === targetSemester);
    if (!semesterCourses) {
      console.log(`Semester ${targetSemester} not found in course entry`);
      return null;
    }

    const courseExists = semesterCourses.courses.some(c => c.courseCode === courseCode);
    if (!courseExists) {
      console.log(`Course ${courseCode} not found in semester ${targetSemester} curriculum`);
      return null;
    }

    console.log(`Course ${courseCode} confirmed in semester ${targetSemester} curriculum`);

    console.log(' STRATEGY 1: Finding batches in target semester...');
    const batchesInTargetSemester = await mongoose.model('Batch').find({
      $or: [
        { departmentName: { $regex: new RegExp(`^${this.department}$`, 'i') } },
        { department: this.department }
      ],
      $or: [
        { degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') } },
        { degreeLevel: this.degreeLevel.toLowerCase() },
        { degreeLevel: this.degreeLevel.toUpperCase() }
      ],
      currentSemester: targetSemester, 
      enrollmentStatus: 'open',
      isActive: true,
      graduationStatus: { $ne: 'graduated' }
    }).sort({ enrollmentYear: -1, createdAt: -1 });

    console.log(` Found ${batchesInTargetSemester.length} batches in semester ${targetSemester}`);

    if (batchesInTargetSemester.length > 0) {
      const selectedBatch = batchesInTargetSemester[0];
      console.log(`SELECTED: ${selectedBatch.batchName} (currently in semester ${selectedBatch.currentSemester})`);
      return selectedBatch;
    }

    console.log('STRATEGY 2: Finding active batches that can teach this course...');
    const activeBatches = await mongoose.model('Batch').find({
      $or: [
        { departmentName: { $regex: new RegExp(`^${this.department}$`, 'i') } },
        { department: this.department }
      ],
      $or: [
        { degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') } },
        { degreeLevel: this.degreeLevel.toLowerCase() },
        { degreeLevel: this.degreeLevel.toUpperCase() }
      ],
      enrollmentStatus: 'open',
      isActive: true,
      graduationStatus: { $ne: 'graduated' },
      currentSemester: { $lte: targetSemester } 
    }).sort({ 
      currentSemester: -1,
      enrollmentYear: -1 
    });

    console.log(` Found ${activeBatches.length} active batches`);

    const suitableBatches = activeBatches.filter(batch => {
      const hasSemester = batch.academicCalendar && 
                         batch.academicCalendar.some(sem => sem.semester === targetSemester);
      return hasSemester;
    });

    console.log(` ${suitableBatches.length} batches have semester ${targetSemester} in their calendar`);

    if (suitableBatches.length > 0) {
      const selectedBatch = suitableBatches[0];
      console.log(`SELECTED: ${selectedBatch.batchName} (current: semester ${selectedBatch.currentSemester}, will teach semester ${targetSemester})`);
      return selectedBatch;
    }

    console.log(' STRATEGY 3: Finding any active batch in department...');
    const anyBatch = await mongoose.model('Batch').findOne({
      $or: [
        { departmentName: { $regex: new RegExp(`^${this.department}$`, 'i') } },
        { department: this.department }
      ],
      $or: [
        { degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') } },
        { degreeLevel: this.degreeLevel.toLowerCase() },
        { degreeLevel: this.degreeLevel.toUpperCase() }
      ],
      enrollmentStatus: 'open',
      isActive: true
    }).sort({ enrollmentYear: -1 });

    if (anyBatch) {
      console.log(`FALLBACK: Using ${anyBatch.batchName} (current: semester ${anyBatch.currentSemester})`);
      return anyBatch;
    }

    console.log('No suitable batches found');
    return null;

  } catch (error) {
    console.error('Error in findBatchForCourse:', error);
    return null;
  }
};

StudentSchema.methods.enrollFreshCourse = async function(courseCode, originalSemester, reason = 'Makeup course') {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log('FRESH ENROLLMENT:', { 
      student: this.studentId, 
      courseCode, 
      originalSemester,
      currentSemester: this.academicProgress.currentSemester 
    });

    const courseEntry = await mongoose.model('CourseEntry').findOne({
      degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') },
      department: { $regex: new RegExp(`^${this.department}$`, 'i') }
    }).session(session);

    if (!courseEntry) {
      throw new Error('Course structure not found for your program');
    }

    let courseDetails = null;
    let courseSemester = null;
    
    for (const semester of courseEntry.semesters) {
      const course = semester.courses.find(c => c.courseCode === courseCode);
      if (course) {
        courseDetails = course;
        courseSemester = semester.semesterNumber;
        break;
      }
    }

    if (!courseDetails) {
      throw new Error(`Course ${courseCode} not found in your program curriculum`);
    }

    const targetSemester = courseSemester;

    if (targetSemester >= this.academicProgress.currentSemester) {
      throw new Error(`Cannot enroll in current or future semester courses as fresh enrollment. Course is from semester ${targetSemester}, your current semester is ${this.academicProgress.currentSemester}`);
    }

    const studiedCourseCodes = new Set();
    this.academicProgress.semesters.forEach(semester => {
      semester.courses.forEach(course => {
        if (course.courseCode && !course.isReplaced && course.status !== 'dropped') {
          studiedCourseCodes.add(course.courseCode.toUpperCase());
        }
      });
    });

    if (studiedCourseCodes.has(courseCode.toUpperCase())) {
      throw new Error(`Course ${courseCode} has already been studied. Use repeat course instead.`);
    }

    console.log(` Finding batch with active semester ${targetSemester}...`);
    const activeBatch = await this.findBatchWithActiveSemester(targetSemester, session);
    
    if (!activeBatch) {
      throw new Error(`No active batch found that is currently teaching semester ${targetSemester} courses`);
    }

    console.log(` Course will be enrolled in: ${activeBatch.batchName} (Semester ${activeBatch.currentSemester})`);
    console.log(` Student's main batch: ${(await mongoose.model('Batch').findById(this.batch)).batchName}`);

    const creditLimit = await this.checkSemesterCreditLimit(targetSemester);
    if (!creditLimit.canAdd || creditLimit.available < courseDetails.creditHrs) {
      throw new Error(`Credit limit exceeded for semester ${targetSemester}. Available: ${creditLimit.available}, Required: ${courseDetails.creditHrs}`);
    }

    let targetSemesterProgress = this.academicProgress.semesters.find(
      s => s.semesterNumber === targetSemester
    );

    if (!targetSemesterProgress) {
      console.log(` Creating semester ${targetSemester} in academic progress for fresh course`);
      targetSemesterProgress = {
        semesterNumber: targetSemester,
        status: 'in-progress',
        courses: [],
        creditsAttempted: 0,
        creditsEarned: 0,
        qualityPoints: 0,
        semesterGPA: 0
      };
      this.academicProgress.semesters.push(targetSemesterProgress);
      this.academicProgress.semesters.sort((a, b) => a.semesterNumber - b.semesterNumber);
    }

    const isCrossBatch = activeBatch._id.toString() !== this.batch.toString();
    
    const newCourse = {
      course: courseDetails._id || new mongoose.Types.ObjectId(),
      courseCode: courseCode,
      courseName: courseDetails.courseName,
      semesterTaken: targetSemester,
      originalSemester: targetSemester,
      status: 'registered',
      grade: null,
      creditsEarned: courseDetails.creditHrs,
      attendance: 0,
      enrolledAt: new Date(),
      isFresh: true,
      isProgramCourse: true,
      freshEnrollmentReason: reason,
      targetBatch: activeBatch._id,
      isCrossBatch: isCrossBatch,
      isCrossSemester: true,
      crossBatchDetails: {
        originalBatch: this.batch,
        teachingBatch: activeBatch._id,
        originalBatchName: (await mongoose.model('Batch').findById(this.batch)).batchName,
        teachingBatchName: activeBatch.batchName,
        enrollmentType: 'fresh'
      }
    };

    targetSemesterProgress.courses.push(newCourse);
    targetSemesterProgress.creditsAttempted += courseDetails.creditHrs;

    if (targetSemesterProgress.status === 'upcoming') {
      targetSemesterProgress.status = 'in-progress';
    }

    this.updateAcademicProgress();
    await this.save({ session });
    await session.commitTransaction();

    console.log(`🎉 SUCCESS: ${courseCode} enrolled as fresh course in ${activeBatch.batchName}`);
    console.log(`📊 Cross-batch: ${isCrossBatch}`);

    return {
      success: true,
      message: `Course ${courseCode} enrolled successfully as fresh course`,
      data: {
        course: courseDetails.courseName,
        courseCode: courseCode,
        credits: courseDetails.creditHrs,
        targetBatch: activeBatch.batchName,
        originalBatch: (await mongoose.model('Batch').findById(this.batch)).batchName,
        targetSemester: targetSemester,
        enrollmentType: 'fresh',
        isCrossBatch: isCrossBatch,
        reason: reason,
        crossBatchDetails: {
          fromBatch: (await mongoose.model('Batch').findById(this.batch)).batchName,
          toBatch: activeBatch.batchName,
          reason: `Semester ${targetSemester} currently active in ${activeBatch.batchName}`
        }
      }
    };

  } catch (error) {
    await session.abortTransaction();
    console.error(' Error enrolling fresh course:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

StudentSchema.methods.enrollInBatchCourse = async function(batchId, courseDetails, semesterNumber, reason, session) {
  let targetSemester = this.academicProgress.semesters.find(
    s => s.semesterNumber === semesterNumber
  );

  if (!targetSemester) {
    targetSemester = {
      semesterNumber: semesterNumber,
      status: 'in-progress',
      courses: [],
      creditsAttempted: 0,
      creditsEarned: 0,
      qualityPoints: 0,
      semesterGPA: 0
    };
    this.academicProgress.semesters.push(targetSemester);
    this.academicProgress.semesters.sort((a, b) => a.semesterNumber - b.semesterNumber);
  }

  const existingCourse = targetSemester.courses.find(
    c => c.courseCode === courseDetails.courseCode && !c.isReplaced
  );

  if (existingCourse) {
    throw new Error(`Course ${courseDetails.courseCode} already exists in semester ${semesterNumber}`);
  }

  const newCourse = {
    course: courseDetails._id,
    courseCode: courseDetails.courseCode,
    courseName: courseDetails.courseName,
    semesterTaken: semesterNumber,
    originalSemester: semesterNumber,
    status: 'registered',
    grade: null,
    creditsEarned: courseDetails.creditHrs,
    attendance: 0,
    enrolledAt: new Date(),
    isFresh: true,
    isProgramCourse: true,
    freshEnrollmentReason: reason,
    targetBatch: batchId,
    isCrossBatch: batchId.toString() !== this.batch.toString(),
    isCrossSemester: semesterNumber !== this.academicProgress.currentSemester
  };

  targetSemester.courses.push(newCourse);
  targetSemester.creditsAttempted += courseDetails.creditHrs;

  if (targetSemester.status === 'upcoming') {
    targetSemester.status = 'in-progress';
  }

  console.log(` Enrolled in ${courseDetails.courseCode} for semester ${semesterNumber}`);

  return newCourse;
};
StudentSchema.methods.findActiveBatchForCourse = async function(courseCode, originalSemester) {
  try {
    console.log(` Finding ANY active batch for ${this.department}`);
    
    const activeBatch = await mongoose.model('Batch').findOne({
      $or: [
        { departmentName: { $regex: new RegExp(`^${this.department}$`, 'i') } },
        { department: this.department }
      ],
      $or: [
        { degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') } },
        { degreeLevel: this.degreeLevel.toLowerCase() },
        { degreeLevel: this.degreeLevel.toUpperCase() }
      ],
      enrollmentStatus: 'open',
      isActive: true
    });

    if (activeBatch) {
      console.log(` FOUND batch: ${activeBatch.batchName}`);
      console.log(`   Department: ${activeBatch.departmentName}`);
      console.log(`   Degree Level: ${activeBatch.degreeLevel}`);
      console.log(`   Current Semester: ${activeBatch.currentSemester}`);
      return activeBatch;
    }

    console.log(' No active batch found with simplified search');
    return null;

  } catch (error) {
    console.error('Error in simplified batch search:', error);
    return null;
  }
};

StudentSchema.methods.debugBatchSearch = async function(courseCode, targetSemester) {
  console.log(' DEBUG BATCH SEARCH STARTED');
  console.log('Student Info:', {
    studentId: this.studentId,
    degreeLevel: this.degreeLevel,
    department: this.department,
    currentSemester: this.currentSemester
  });

  const searchQueries = [
    {
      name: 'Exact match',
      query: {
        departmentName: this.department,
        degreeLevel: this.degreeLevel,
        currentSemester: targetSemester,
        enrollmentStatus: 'open',
        graduationStatus: { $ne: 'graduated' },
        isActive: true
      }
    },
    {
      name: 'Case insensitive department',
      query: {
        departmentName: { $regex: new RegExp(`^${this.department}$`, 'i') },
        degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') },
        currentSemester: targetSemester,
        enrollmentStatus: 'open',
        graduationStatus: { $ne: 'graduated' },
        isActive: true
      }
    },
    {
      name: 'Any semester (remove semester filter)',
      query: {
        departmentName: { $regex: new RegExp(`^${this.department}$`, 'i') },
        degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') },
        enrollmentStatus: 'open',
        graduationStatus: { $ne: 'graduated' },
        isActive: true
      }
    }
  ];

  const results = [];

  for (const search of searchQueries) {
    console.log(`\n Running search: ${search.name}`);
    console.log('Query:', JSON.stringify(search.query, null, 2));
    
    const batches = await mongoose.model('Batch').find(search.query);
    
    console.log(` Found ${batches.length} batches`);
    
    batches.forEach(batch => {
      console.log(`- ${batch.batchName}:`, {
        departmentName: batch.departmentName,
        degreeLevel: batch.degreeLevel,
        currentSemester: batch.currentSemester,
        enrollmentStatus: batch.enrollmentStatus,
        graduationStatus: batch.graduationStatus,
        isActive: batch.isActive
      });
    });

    results.push({
      searchName: search.name,
      batchCount: batches.length,
      batches: batches.map(b => ({
        name: b.batchName,
        department: b.departmentName,
        degreeLevel: b.degreeLevel,
        currentSemester: b.currentSemester
      }))
    });
  }

  console.log('\n CHECKING COURSE ENTRY');
  const courseEntry = await mongoose.model('CourseEntry').findOne({
    degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') },
    department: { $regex: new RegExp(`^${this.department}$`, 'i') }
  });

  if (courseEntry) {
    console.log(' Course entry FOUND');
    console.log('Course Entry:', {
      degreeLevel: courseEntry.degreeLevel,
      department: courseEntry.department,
      semesters: courseEntry.semesters.map(s => ({
        semester: s.semesterNumber,
        courses: s.courses.map(c => c.courseCode)
      }))
    });

    const targetSemesterCourses = courseEntry.semesters.find(
      s => s.semesterNumber === targetSemester
    );
    
    if (targetSemesterCourses) {
      const courseExists = targetSemesterCourses.courses.some(
        c => c.courseCode === courseCode
      );
      console.log(` Course ${courseCode} in semester ${targetSemester}: ${courseExists ? 'FOUND' : 'NOT FOUND'}`);
    } else {
      console.log(` Semester ${targetSemester} not found in course entry`);
    }
  } else {
    console.log(' Course entry NOT FOUND');
  }

  return results;
};
StudentSchema.methods.findBatchWithActiveSemester = async function(semesterNumber, session = null) {
  try {
    console.log(` Finding batch with active semester ${semesterNumber} for ${this.department}`);
    
    const searchOptions = session ? { session } : {};
    
    const activeBatches = await mongoose.model('Batch').find({
      $or: [
        { departmentName: { $regex: new RegExp(`^${this.department}$`, 'i') } },
        { department: this.department }
      ],
      $or: [
        { degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') } },
        { degreeLevel: this.degreeLevel.toLowerCase() },
        { degreeLevel: this.degreeLevel.toUpperCase() }
      ],
      currentSemester: semesterNumber,
      enrollmentStatus: 'open',
      isActive: true,
      graduationStatus: { $ne: 'graduated' }
    }, null, searchOptions).sort({ enrollmentYear: -1, createdAt: -1 });

    console.log(`Found ${activeBatches.length} batches in semester ${semesterNumber}`);

    if (activeBatches.length > 0) {
      const selectedBatch = activeBatches[0];
      console.log(`Selected batch: ${selectedBatch.batchName}`);
      return selectedBatch;
    }

    console.log(` No batches in semester ${semesterNumber}, looking for upcoming batches...`);
    
    const upcomingBatches = await mongoose.model('Batch').find({
      $or: [
        { departmentName: { $regex: new RegExp(`^${this.department}$`, 'i') } },
        { department: this.department }
      ],
      $or: [
        { degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') } },
        { degreeLevel: this.degreeLevel.toLowerCase() },
        { degreeLevel: this.degreeLevel.toUpperCase() }
      ],
      currentSemester: { $lt: semesterNumber },
      enrollmentStatus: 'open',
      isActive: true,
      graduationStatus: { $ne: 'graduated' }
    }, null, searchOptions).sort({ currentSemester: -1, enrollmentYear: -1 });

    console.log(` Found ${upcomingBatches.length} batches that will reach semester ${semesterNumber}`);

    const suitableBatches = upcomingBatches.filter(batch => {
      const hasSemester = batch.academicCalendar && 
                         batch.academicCalendar.some(sem => sem.semester === semesterNumber);
      return hasSemester;
    });

    if (suitableBatches.length > 0) {
      const selectedBatch = suitableBatches[0];
      console.log(` Selected upcoming batch: ${selectedBatch.batchName} (current: ${selectedBatch.currentSemester})`);
      return selectedBatch;
    }

    console.log(' No suitable batches found');
    return null;

  } catch (error) {
    console.error(' Error finding batch with active semester:', error);
    return null;
  }
};

StudentSchema.methods.autoRegisterCoursesForUnfreeze = async function(targetBatch, semesterNumber, session = null) {
  try {
    console.log(` Auto-registering courses for semester ${semesterNumber} in ${targetBatch.batchName}`);
    
    const courseEntry = await mongoose.model('CourseEntry').findOne({
      degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') },
      department: { $regex: new RegExp(`^${this.department}$`, 'i') }
    }).session(session);

    if (!courseEntry) {
      console.log(' Course structure not found');
      return;
    }

    const semesterCourses = courseEntry.semesters.find(
      s => s.semesterNumber === semesterNumber
    )?.courses || [];

    console.log(` Found ${semesterCourses.length} courses for semester ${semesterNumber}`);

    let targetSemester = this.academicProgress.semesters.find(
      s => s.semesterNumber === semesterNumber
    );

    if (!targetSemester) {
      console.log(` Creating semester ${semesterNumber} in academic progress`);
      targetSemester = {
        semesterNumber: semesterNumber,
        status: 'in-progress',
        courses: [],
        creditsAttempted: 0,
        creditsEarned: 0,
        qualityPoints: 0,
        semesterGPA: 0
      };
      this.academicProgress.semesters.push(targetSemester);
      this.academicProgress.semesters.sort((a, b) => a.semesterNumber - b.semesterNumber);
    }

    const completedCourseCodes = new Set();
    this.academicProgress.semesters.forEach(sem => {
      sem.courses.forEach(course => {
        if (course.status === 'completed' && course.grade && !['F', 'D'].includes(course.grade)) {
          completedCourseCodes.add(course.courseCode.toUpperCase());
        }
      });
    });

    let registeredCount = 0;
    semesterCourses.forEach(course => {
      if (!completedCourseCodes.has(course.courseCode.toUpperCase())) {
        const existingCourse = targetSemester.courses.find(
          c => c.courseCode === course.courseCode && !c.isReplaced
        );

        if (!existingCourse) {
          targetSemester.courses.push({
            course: course._id,
            courseCode: course.courseCode,
            courseName: course.courseName,
            semesterTaken: semesterNumber,
            status: 'registered',
            grade: null,
            creditsEarned: course.creditHrs,
            attendance: 0,
            enrolledAt: new Date(),
            isFresh: false,
            isProgramCourse: true,
            targetBatch: targetBatch._id,
            isCrossBatch: targetBatch._id.toString() !== this.batch.toString()
          });
          registeredCount++;
        }
      }
    });

    console.log(` Registered ${registeredCount} new courses for semester ${semesterNumber}`);
    
    targetSemester.creditsAttempted = targetSemester.courses.reduce(
      (sum, course) => sum + (course.creditsEarned || 0), 0
    );

  } catch (error) {
    console.error(' Error auto-registering courses for unfreeze:', error);
    throw error;
  }
};
StudentSchema.methods.unfreezeSemester = async function(semesterNumber, newBatchId = null) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log(`UNFREEZE: Student ${this.studentId}, Semester ${semesterNumber}, New Batch: ${newBatchId}`);

    const semester = this.academicProgress.semesters.find(
      s => s.semesterNumber === semesterNumber && s.status === 'frozen'
    );

    if (!semester) {
      throw new Error(`No frozen semester found for semester ${semesterNumber}`);
    }

    let targetBatch = null;
    let targetBatchDoc = null;

    if (newBatchId) {
      targetBatchDoc = await mongoose.model('Batch').findById(newBatchId).session(session);
      if (!targetBatchDoc) {
        throw new Error('Specified batch not found');
      }
      console.log(` Using specified batch: ${targetBatchDoc.batchName}`);
    } else {
      targetBatchDoc = await this.findBatchWithActiveSemester(semesterNumber, session);
      
      if (!targetBatchDoc) {
        throw new Error(`No active batch found that is currently in semester ${semesterNumber}`);
      }
      console.log(` Found active batch for semester ${semesterNumber}: ${targetBatchDoc.batchName}`);
    }

    const currentBatchDoc = await mongoose.model('Batch').findById(this.batch).session(session);
    if (currentBatchDoc) {
      const removed = await currentBatchDoc.removeStudent(this.studentId, this.status, session);
      if (removed) {
        console.log(` Removed student from current batch: ${currentBatchDoc.batchName}`);
      }
    }

    const studentData = {
      studentId: this.studentId,
      firstName: this.firstName,
      lastName: this.lastName,
      photoPath: this.photoPath,
      universityEmail: this.universityEmail,
      contactNumber: this.contactNumber,
      status: 'active',
      scholarshipPercentage: this.scholarshipPercentage
    };

    const assignedSection = await targetBatchDoc.assignStudentOptimally(studentData, session);
    console.log(` Assigned to section: ${assignedSection} in batch ${targetBatchDoc.batchName}`);

    this.section = assignedSection;
    this.batch = targetBatchDoc._id;
    this.status = 'active';

    semester.status = 'in-progress';
    semester.unfrozenAt = new Date();
    semester.unfreezeReason = `Transferred to ${targetBatchDoc.batchName}`;
    
    semester.courses.forEach(course => {
      if (course.status === 'frozen') {
        course.status = 'registered';
        course.unfrozenAt = new Date();
      }
    });

    this.academicProgress.currentSemester = semesterNumber;
    console.log(`📚 Updated current semester to: ${semesterNumber}`);

    await this.autoRegisterCoursesForUnfreeze(targetBatchDoc, semesterNumber, session);

    await this.save({ session });

    await targetBatchDoc.updateStudentStatus(
      this.studentId,
      'inactive',
      'active',   
      session
    );

    await session.commitTransaction();
    
    console.log(` UNFREEZE SUCCESS: ${this.studentId} → ${targetBatchDoc.batchName}, Semester ${semesterNumber}`);
    
    return { 
      success: true, 
      message: `Semester ${semesterNumber} unfrozen successfully. Student transferred to ${targetBatchDoc.batchName}.`,
      data: {
        newBatch: targetBatchDoc.batchName,
        newSection: assignedSection,
        currentSemester: this.academicProgress.currentSemester,
        originalBatch: currentBatchDoc?.batchName || 'Unknown'
      }
    };
  } catch (error) {
    await session.abortTransaction();
    console.error(` UNFREEZE ERROR for ${this.studentId}:`, error.message);
    throw error;
  } finally {
    session.endSession();
  }
};


StudentSchema.methods.repeatCourse = async function(courseCode, originalSemester, reason = 'Academic') {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log(` REPEAT COURSE: ${courseCode}, Target Semester: ${originalSemester}, Reason: ${reason}`);
    let courseToRepeat = null;
    let sourceSemester = null;
    
    for (const semester of this.academicProgress.semesters) {
      for (const course of semester.courses) {
        if (course.courseCode === courseCode && !course.isReplaced) {
          const canRepeat = (
            course.status === 'failed' || 
            course.status === 'dropped' || 
            (course.status === 'completed' && course.grade && ['D', 'F'].includes(course.grade))
          );
          
          if (canRepeat) {
            courseToRepeat = course;
            sourceSemester = semester;
            break;
          }
        }
      }
      if (courseToRepeat) break;
    }

    if (!courseToRepeat) {
      throw new Error(`Course ${courseCode} not found or cannot be repeated. Only failed, dropped, or D/F grade courses can be repeated.`);
    }

    console.log(` Found course to repeat: ${courseCode} in semester ${sourceSemester.semesterNumber}, Grade: ${courseToRepeat.grade}, Status: ${courseToRepeat.status}`);

    const courseEntry = await mongoose.model('CourseEntry').findOne({
      degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') },
      department: { $regex: new RegExp(`^${this.department}$`, 'i') }
    }).session(session);

    let actualCreditHrs = courseToRepeat.creditsEarned || 3;
    if (courseEntry) {
      for (const semester of courseEntry.semesters) {
        const course = semester.courses.find(c => c.courseCode === courseCode);
        if (course) {
          actualCreditHrs = course.creditHrs;
          break;
        }
      }
    }
    let targetBatch = null;
    let targetSemesterNumber = this.academicProgress.currentSemester; // Default to current semester
    
    if (originalSemester < this.academicProgress.currentSemester) {
      targetBatch = await this.findBatchWithActiveSemester(originalSemester, session);
      if (targetBatch) {
        targetSemesterNumber = originalSemester;
        console.log(` Using original semester ${originalSemester} in batch ${targetBatch.batchName}`);
      }
    }
    
    if (!targetBatch) {
      targetBatch = await mongoose.model('Batch').findById(this.batch).session(session);
      targetSemesterNumber = this.academicProgress.currentSemester;
      console.log(` Using current semester ${targetSemesterNumber} in main batch`);
    }

    const creditLimit = await this.checkSemesterCreditLimit(targetSemesterNumber);
    if (!creditLimit.canAdd || creditLimit.available < actualCreditHrs) {
      throw new Error(`Credit limit exceeded for semester ${targetSemesterNumber}. Available: ${creditLimit.available}, Required: ${actualCreditHrs}`);
    }

    let targetSemester = this.academicProgress.semesters.find(
      s => s.semesterNumber === targetSemesterNumber
    );

    if (!targetSemester) {
      console.log(`Creating semester ${targetSemesterNumber} in academic progress for repeat course`);
      targetSemester = {
        semesterNumber: targetSemesterNumber,
        status: 'in-progress',
        courses: [],
        creditsAttempted: 0,
        creditsEarned: 0,
        qualityPoints: 0,
        semesterGPA: 0
      };
      this.academicProgress.semesters.push(targetSemester);
      this.academicProgress.semesters.sort((a, b) => a.semesterNumber - b.semesterNumber);
    }

    const isCrossBatch = targetBatch._id.toString() !== this.batch.toString();
    
    const newCourse = {
      course: courseToRepeat.course || new mongoose.Types.ObjectId(),
      courseCode: courseCode,
      courseName: courseToRepeat.courseName || courseCode,
      semesterTaken: targetSemesterNumber,
      originalSemester: originalSemester,
      status: 'registered',
      grade: null,
      creditsEarned: actualCreditHrs,
      attendance: 0,
      enrolledAt: new Date(),
      isFresh: false,
      isRepeated: true,
      isProgramCourse: true,
      freshEnrollmentReason: `Repeat: ${reason} (Original grade: ${courseToRepeat.grade})`,
      targetBatch: targetBatch._id,
      isCrossBatch: isCrossBatch,
      isCrossSemester: targetSemesterNumber !== originalSemester,
      crossBatchDetails: {
        originalBatch: this.batch,
        teachingBatch: targetBatch._id,
        originalBatchName: (await mongoose.model('Batch').findById(this.batch)).batchName,
        teachingBatchName: targetBatch.batchName,
        enrollmentType: 'repeat',
        originalGrade: courseToRepeat.grade,
        originalSemester: originalSemester
      }
    };

    targetSemester.courses.push(newCourse);
    targetSemester.creditsAttempted += actualCreditHrs;
    
    if (targetSemester.status === 'upcoming') {
      targetSemester.status = 'in-progress';
    }

    
    if (courseToRepeat.status === 'completed' && courseToRepeat.grade) {
      courseToRepeat.isReplaced = true;
      courseToRepeat.replacedBy = targetSemesterNumber;
      courseToRepeat.replacedAt = new Date();
      console.log(`Marked original course as replaced`);
    }

    this.updateAcademicProgress();
    await this.save({ session });
    await session.commitTransaction();

    console.log(`SUCCESS: ${courseCode} repeated in ${targetBatch.batchName}, Semester ${targetSemesterNumber}`);

    return {
      success: true,
      message: `Course ${courseCode} repeated successfully. Original grade (${courseToRepeat.grade}) will be replaced upon completion.`,
      data: {
        course: courseCode,
        batch: targetBatch.batchName,
        targetSemester: targetSemesterNumber,
        originalSemester: originalSemester,
        credits: actualCreditHrs,
        isCrossBatch: isCrossBatch,
        originalBatch: (await mongoose.model('Batch').findById(this.batch)).batchName,
        type: 'repeat',
        originalGrade: courseToRepeat.grade,
        crossBatchDetails: {
          fromBatch: (await mongoose.model('Batch').findById(this.batch)).batchName,
          toBatch: targetBatch.batchName,
          reason: `Repeating course to improve ${courseToRepeat.grade} grade`
        }
      }
    };

  } catch (error) {
    await session.abortTransaction();
    console.error(` Error repeating course ${courseCode}:`, error);
    throw error;
  } finally {
    session.endSession();
  }
};
StudentSchema.methods.findAnyBatchForEnrollment = async function() {
  try {
    console.log(' ENHANCED BATCH SEARCH: Finding active batch');
    
    const currentYear = new Date().getFullYear();
    
    const suitableBatch = await mongoose.model('Batch').findOne({
      departmentName: { $regex: new RegExp(`^${this.department}$`, 'i') },
      degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') },
      currentSemester: 1,
      enrollmentStatus: 'open',
      isActive: true,
      $or: [
        { enrollmentYear: currentYear },
        { enrollmentYear: currentYear - 1 } 
      ]
    }).sort({ enrollmentYear: -1, createdAt: -1 });

    if (suitableBatch) {
      console.log(`FOUND SUITABLE BATCH: ${suitableBatch.batchName} (Semester ${suitableBatch.currentSemester})`);
      return suitableBatch;
    }

    console.log('No suitable batch found, looking for any active batch...');
    const anyBatch = await mongoose.model('Batch').findOne({
      departmentName: { $regex: new RegExp(`^${this.department}$`, 'i') },
      degreeLevel: { $regex: new RegExp(`^${this.degreeLevel}$`, 'i') },
      isActive: true,
      enrollmentStatus: 'open'
    }).sort({ enrollmentYear: -1, createdAt: -1 });

    if (anyBatch) {
      console.log(` USING ACTIVE BATCH: ${anyBatch.batchName} (Semester ${anyBatch.currentSemester})`);
      return anyBatch;
    }

    console.log('No active batches found, using any batch...');
    const fallbackBatch = await mongoose.model('Batch').findOne({
      isActive: true
    }).sort({ enrollmentYear: -1, createdAt: -1 });

    if (fallbackBatch) {
      console.log(`USING FALLBACK BATCH: ${fallbackBatch.batchName}`);
      return fallbackBatch;
    }

    console.log('No batches found at all');
    return null;

  } catch (error) {
    console.error(' BATCH SEARCH ERROR:', error);
    return null;
  }
};

StudentSchema.methods.dropCourse = async function(courseCode, semesterNumber, reason = 'Academic') {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log(`Starting drop course: ${courseCode}, Semester: ${semesterNumber}, Reason: ${reason}`);
    
    const semester = this.academicProgress.semesters.find(
      s => s.semesterNumber === semesterNumber
    );

    if (!semester) {
      throw new Error(`Semester ${semesterNumber} not found`);
    }

    console.log(`Looking for course: ${courseCode} in semester ${semesterNumber}`);
    
    const course = semester.courses.find(
      c => c.courseCode === courseCode && 
      ['registered', 'in-progress'].includes(c.status)
    );

    if (!course) {
      const availableCourses = semester.courses.map(c => ({
        code: c.courseCode,
        status: c.status,
        name: c.courseName
      }));
      console.log(' Available courses in semester:', availableCourses);
      throw new Error(`Course ${courseCode} not found or cannot be dropped. Available courses: ${JSON.stringify(availableCourses)}`);
    }

    console.log(`Course found: ${course.courseName}, Status: ${course.status}`);

    const creditHrs = course.creditsEarned || 3;

    console.log(`Course credits: ${creditHrs}`);

    course.status = 'dropped';
    course.droppedAt = new Date();
    course.dropReason = reason;
    course.grade = 'W';

    semester.creditsAttempted = Math.max(0, semester.creditsAttempted - creditHrs);
    
    console.log(`Updated semester credits attempted: ${semester.creditsAttempted}`);

    this.updateAcademicProgress();

    await this.save({ session });
    await session.commitTransaction();

    console.log(`Course ${courseCode} dropped successfully`);

    return {
      success: true,
      message: `Course ${courseCode} dropped successfully`,
      creditHrsReduced: creditHrs,
      newTotalCredits: this.academicProgress.totalCreditsEarned
    };
  } catch (error) {
    await session.abortTransaction();
    console.error(`Error dropping course ${courseCode}:`, error.message);
    throw error;
  } finally {
    session.endSession();
  }
};

StudentSchema.methods.freezeSemester = async function(semesterNumber, reason = 'Academic') {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log(`Starting freeze semester: ${semesterNumber}, Reason: ${reason}`);

    if (parseInt(semesterNumber) !== this.academicProgress.currentSemester) {
      throw new Error(`Can only freeze current semester (${this.academicProgress.currentSemester}), not semester ${semesterNumber}`);
    }

    const currentSemester = this.academicProgress.semesters.find(
      s => s.semesterNumber === this.academicProgress.currentSemester
    );

    if (!currentSemester) {
      throw new Error(`Current semester ${this.academicProgress.currentSemester} not found`);
    }

    if (currentSemester.status === 'frozen') {
      throw new Error(`Semester ${semesterNumber} is already frozen`);
    }

    if (currentSemester.status === 'completed') {
      throw new Error('Cannot freeze completed semester');
    }

    console.log(`Freezing semester ${semesterNumber}`);

    currentSemester.status = 'frozen';
    currentSemester.frozenAt = new Date();
    currentSemester.freezeReason = reason;

    currentSemester.courses.forEach(course => {
      if (course.status === 'registered' || course.status === 'in-progress') {
        course.status = 'frozen';
        course.frozenAt = new Date();
      }
    });

    this.status = 'inactive';

    await this.save({ session });

    const batch = await mongoose.model('Batch').findById(this.batch).session(session);
    if (batch) {
      await batch.updateStudentStatus(
        this.studentId,
        'active',
        'inactive',
        session
      );
      console.log(`Updated batch status for student ${this.studentId} to inactive`);
    }

    await session.commitTransaction();
    
    console.log(`Semester ${semesterNumber} frozen successfully`);
    
    return { 
      success: true, 
      message: `Current semester ${semesterNumber} frozen successfully. Student status set to inactive.` 
    };
  } catch (error) {
    await session.abortTransaction();
    console.error(`Error freezing semester ${semesterNumber}:`, error.message);
    throw error;
  } finally {
    session.endSession();
  }
};

StudentSchema.methods.checkSemesterCreditLimit = async function(semesterNumber) {
  try {
    const degreeLevel = this.degreeLevel;
    
    const degreeLevelMap = {
      'undergraduate': 'Undergraduate',
      'graduate': 'Graduate', 
      'phd': 'PhD',
      'Undergraduate': 'Undergraduate',
      'Graduate': 'Graduate',
      'PhD': 'PhD'
    };
    
    const normalizedDegreeLevel = degreeLevelMap[degreeLevel] || degreeLevel;
    const degreeInfo = DEGREE_CONFIG[normalizedDegreeLevel];
    
    if (!degreeInfo) {
      console.log(` Invalid degree level: ${degreeLevel}`);
      return {
        canAdd: true,
        available: 18,
        current: 0,
        limit: 18,
        semester: semesterNumber,
        degreeLevel: normalizedDegreeLevel
      };
    }

    const semesterLimit = degreeInfo.semesterLimits[semesterNumber] || 18;

    const semester = this.academicProgress?.semesters?.find(
      s => s.semesterNumber === semesterNumber
    );

    const currentCredits = semester ? 
      semester.courses.reduce((sum, course) => {
        if (course.status !== 'dropped' && !course.isReplaced) {
          return sum + (course.creditsEarned || 0);
        }
        return sum;
      }, 0) : 0;

    const available = Math.max(0, semesterLimit - currentCredits);

    console.log(`Credit Check - Semester ${semesterNumber}: ${currentCredits}/${semesterLimit} (Available: ${available})`);

    return {
      canAdd: available > 0,
      available: available,
      current: currentCredits,
      limit: semesterLimit,
      semester: semesterNumber,
      degreeLevel: normalizedDegreeLevel
    };
  } catch (error) {
    console.error(`Error checking credit limit for semester ${semesterNumber}:`, error);
    return {
      canAdd: true,
      available: 18,
      current: 0,
      limit: 18,
      semester: semesterNumber,
      error: error.message
    };
  }
};
StudentSchema.methods.getCoursePrerequisiteStatus = function(courseCode) {
  const prerequisiteMap = {
    'CS102': ['CS101'],
    'CS201': ['CS102'],
    'MATH102': ['MATH101'],
    'PHY102': ['PHY101'],
    'CS301': ['CS201', 'CS202'],
    'CS302': ['CS201'],
    'CS401': ['MATH202'],
    'CS405': ['CS201', 'STAT201'],
  };

  const prerequisites = prerequisiteMap[courseCode] || [];
  
  if (prerequisites.length === 0) {
    return 'No prerequisites';
  }

  const completedCourses = new Set();
  this.academicProgress.semesters.forEach(semester => {
    semester.courses.forEach(course => {
      if (course.status === 'completed' && course.grade && !['F', 'D'].includes(course.grade)) {
        completedCourses.add(course.courseCode.toUpperCase());
      }
    });
  });

  const missingPrerequisites = prerequisites.filter(prereq => 
    !completedCourses.has(prereq.toUpperCase())
  );

  if (missingPrerequisites.length === 0) {
    return 'All prerequisites completed';
  } else {
    return `Missing prerequisites: ${missingPrerequisites.join(', ')}`;
  }
};

module.exports = mongoose.model('Student', StudentSchema);