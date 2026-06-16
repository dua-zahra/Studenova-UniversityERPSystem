const mongoose = require('mongoose');
require('dotenv').config();

const fixAllStudentsAcademicProgress = async () => {
  try {
    console.log('🚀 Starting comprehensive academic progress fix for ALL students...\n');
    
    const Student = require('../models/Student');
    const Batch = require('../models/Batch');
    const CourseEntry = require('../models/CourseEntry');

    // Find ALL students regardless of academicProgress status
    const students = await Student.find({})
      .populate('batch');

    console.log(`📊 Found ${students.length} total students in database\n`);

    if (students.length === 0) {
      console.log('❌ No students found in database');
      return;
    }

    let updatedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const student of students) {
      try {
        console.log(`🔄 Processing student: ${student.studentId} (${student.firstName} ${student.lastName})`);
        
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          // Get batch information
          const batch = await Batch.findById(student.batch).session(session);
          if (!batch) {
            throw new Error('Batch not found');
          }

          // Get course structure
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

          // Determine current semester
          const currentSemester = student.currentSemester || batch.currentSemester || 1;

          // Initialize semesters array
          const semesters = [];

          // Create semester entries for all semesters up to total
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

            // Register courses for current and past semesters
            if (i <= currentSemester) {
              const semesterCourses = courseEntry.semesters.find(s => s.semesterNumber === i)?.courses || [];
              
              semesterData.courses = semesterCourses.map(course => ({
                course: course._id,
                courseCode: course.courseCode,
                courseName: course.courseName,
                semesterTaken: i,
                status: i < currentSemester ? 'completed' : 'registered',
                grade: i < currentSemester ? 'B' : null, // Default grade
                creditsEarned: course.creditHrs,
                attendance: i < currentSemester ? 85 : 0, // Default attendance
                gradePoints: i < currentSemester ? 3.0 : 0 // Default grade points
              }));

              // Calculate metrics for completed semesters
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
              }
            },
            { session }
          );

          await session.commitTransaction();
          
          updatedCount++;
          results.push({
            studentId: student.studentId,
            name: `${student.firstName} ${student.lastName}`,
            batch: batch.batchName,
            currentSemester,
            status: 'success',
            creditsEarned: totalCreditsEarned,
            cumulativeGPA: cumulativeGPA.toFixed(2)
          });

          console.log(`✅ Updated: ${student.studentId} | Semester: ${currentSemester} | GPA: ${cumulativeGPA.toFixed(2)} | Credits: ${totalCreditsEarned}`);

        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }

      } catch (error) {
        errorCount++;
        results.push({
          studentId: student.studentId,
          name: `${student.firstName} ${student.lastName}`,
          status: 'error',
          error: error.message
        });
        console.log(`❌ Error with ${student.studentId}: ${error.message}`);
      }
    }

    // Print summary
    console.log('\n🎉 ====== FIX COMPLETED ======');
    console.log(`📊 Total Students: ${students.length}`);
    console.log(`✅ Successfully Updated: ${updatedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    console.log('\n📋 DETAILED RESULTS:');
    results.forEach(result => {
      if (result.status === 'success') {
        console.log(`   ✅ ${result.studentId} - ${result.name} | Sem: ${result.currentSemester} | GPA: ${result.cumulativeGPA} | Credits: ${result.creditsEarned}`);
      } else {
        console.log(`   ❌ ${result.studentId} - ${result.name} | Error: ${result.error}`);
      }
    });

  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔗 MongoDB connection closed');
  }
};

// Run the script
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/UniverityERP', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on('connected', () => {
  console.log('✅ Connected to MongoDB');
  fixAllStudentsAcademicProgress();
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});