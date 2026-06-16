const mongoose = require('mongoose');
const Student = require('../models/Student');
const Batch = require('../models/Batch');
const CourseEntry = require('../models/CourseEntry');

const populateAcademicProgress = async () => {
  try {
    console.log('Starting academic progress population for existing students...');
    
    // Find all students without academicProgress or with incomplete academicProgress
    const students = await Student.find({
      $or: [
        { academicProgress: { $exists: false } },
        { academicProgress: null },
        { 'academicProgress.totalCreditsRequired': 0 },
        { 'academicProgress.semesters': { $size: 0 } }
      ]
    }).populate('batch');

    console.log(`Found ${students.length} students needing academic progress setup`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const student of students) {
      try {
        await updateStudentAcademicProgress(student);
        updatedCount++;
        
        if (updatedCount % 10 === 0) {
          console.log(`Progress: ${updatedCount}/${students.length} students updated`);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error updating student ${student.studentId}:`, error.message);
      }
    }

    console.log(`✅ Academic progress population completed!`);
    console.log(`📊 Updated: ${updatedCount}, Errors: ${errorCount}, Total: ${students.length}`);

  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

const updateStudentAcademicProgress = async (student) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get batch information
    const batch = await Batch.findById(student.batch).session(session);
    if (!batch) {
      throw new Error('Batch not found');
    }

    // Get course structure for the student's program
    const courseEntry = await CourseEntry.findOne({
      degreeLevel: student.degreeLevel,
      department: student.department
    }).session(session);

    if (!courseEntry) {
      throw new Error('Course structure not found');
    }

    // Calculate total credits required
    const totalCreditsRequired = courseEntry.semesters.reduce((sum, sem) => 
      sum + sem.courses.reduce((s, c) => s + c.creditHrs, 0), 0
    );

    // Determine current semester (use batch current semester as fallback)
    const currentSemester = student.currentSemester || batch.currentSemester || 1;

    // Initialize semesters array
    const semesters = [];

    // Create semester entries for all semesters up to current
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

      // If this is a past or current semester, register courses
      if (i <= currentSemester) {
        const semesterCourses = courseEntry.semesters.find(s => s.semesterNumber === i)?.courses || [];
        
        semesterData.courses = semesterCourses.map(course => ({
          course: course._id,
          courseCode: course.courseCode,
          courseName: course.courseName,
          semesterTaken: i,
          status: i < currentSemester ? 'completed' : 'registered',
          grade: i < currentSemester ? 'B' : null, // Default grade for completed courses
          creditsEarned: course.creditHrs,
          attendance: i < currentSemester ? 85 : 0, // Default attendance
          gradePoints: i < currentSemester ? 3.0 : 0 // Default grade points
        }));

        // Calculate semester metrics for completed semesters
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

    // Calculate overall academic progress
    const completedSemesters = semesters.filter(s => s.status === 'completed');
    const totalCreditsEarned = completedSemesters.reduce((sum, sem) => sum + sem.creditsEarned, 0);
    const totalQualityPoints = completedSemesters.reduce((sum, sem) => sum + sem.qualityPoints, 0);
    const cumulativeGPA = totalCreditsEarned > 0 ? totalQualityPoints / totalCreditsEarned : 0;
    const completionPercentage = totalCreditsRequired > 0 ? 
      Math.min(100, Math.round((totalCreditsEarned / totalCreditsRequired) * 100)) : 0;

    // Update student with academic progress
    await Student.findByIdAndUpdate(
      student._id,
      {
        academicProgress: {
          currentSemester,
          semesters,
          totalCreditsEarned,
          totalCreditsRequired,
          cumulativeGPA,
          completionPercentage,
          totalQualityPoints
        },
        // Ensure current semester is synchronized
        currentSemester: currentSemester
      },
      { session }
    );

    await session.commitTransaction();
    console.log(`✅ Updated academic progress for ${student.studentId} - Semester ${currentSemester}`);

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Run the script if called directly
if (require.main === module) {
  require('dotenv').config();
  
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  mongoose.connection.on('connected', () => {
    console.log('Connected to MongoDB');
    populateAcademicProgress();
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
}

module.exports = { populateAcademicProgress, updateStudentAcademicProgress };