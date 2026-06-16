const mongoose = require('mongoose');
require('dotenv').config();

const fixCourseEntryMatching = async () => {
  try {
    console.log('🎯 FIXING COURSE ENTRY MATCHING...\n');
    
    // Load models with correct paths
    const Student = require('../models/Student');
    const CourseEntry = require('../models/CourseEntry');
    const Batch = require('../models/Batch');

    // Get all students and all course entries
    const students = await Student.find().select('studentId degreeLevel department currentSemester').populate('batch');
    const courseEntries = await CourseEntry.find().select('degreeLevel department semesters');

    console.log('📊 DATABASE OVERVIEW:');
    console.log(`   Students: ${students.length}`);
    console.log(`   CourseEntries: ${courseEntries.length}\n`);

    // Show all CourseEntries
    console.log('📚 EXISTING COURSE ENTRIES:');
    console.log('==========================\n');
    courseEntries.forEach(entry => {
      console.log(`   📖 "${entry.degreeLevel}" - "${entry.department}"`);
      console.log(`      Semesters: ${entry.semesters.length}, Courses: ${entry.semesters.reduce((sum, sem) => sum + sem.courses.length, 0)}`);
    });

    // Analyze student programs vs course entries
    console.log('\n🔍 STUDENT PROGRAM ANALYSIS:');
    console.log('===========================\n');

    const programAnalysis = {};

    students.forEach(student => {
      const studentProgram = `${student.degreeLevel}||${student.department}`;
      
      if (!programAnalysis[studentProgram]) {
        programAnalysis[studentProgram] = {
          degreeLevel: student.degreeLevel,
          department: student.department,
          students: [],
          hasCourseEntry: false,
          matchingCourseEntry: null
        };
      }
      
      programAnalysis[studentProgram].students.push(student.studentId);
    });

    // Check which programs have CourseEntries
    Object.values(programAnalysis).forEach(program => {
      const matchingEntry = courseEntries.find(entry => 
        entry.degreeLevel.toLowerCase() === program.degreeLevel.toLowerCase() &&
        entry.department.toLowerCase() === program.department.toLowerCase()
      );

      program.hasCourseEntry = !!matchingEntry;
      program.matchingCourseEntry = matchingEntry;
    });

    // Display results
    Object.values(programAnalysis).forEach(program => {
      const status = program.hasCourseEntry ? '✅' : '❌';
      console.log(`${status} ${program.degreeLevel} - ${program.department}`);
      console.log(`   Students: ${program.students.length} (${program.students.slice(0, 3).join(', ')}${program.students.length > 3 ? '...' : ''})`);
      
      if (program.hasCourseEntry) {
        console.log(`   CourseEntry: "${program.matchingCourseEntry.degreeLevel}" - "${program.matchingCourseEntry.department}"`);
        console.log(`   Semesters: ${program.matchingCourseEntry.semesters.length}`);
      } else {
        console.log(`   CourseEntry: NOT FOUND`);
        
        // Check if there's a similar CourseEntry with different capitalization
        const similarEntries = courseEntries.filter(entry => 
          entry.degreeLevel.toLowerCase() === program.degreeLevel.toLowerCase() ||
          entry.department.toLowerCase() === program.department.toLowerCase()
        );
        
        if (similarEntries.length > 0) {
          console.log(`   💡 Similar entries found:`);
          similarEntries.forEach(entry => {
            console.log(`      - "${entry.degreeLevel}" - "${entry.department}"`);
          });
        }
      }
      console.log('');
    });

    // Fix students with mismatched degreeLevel/department
    console.log('🛠️  FIXING MISMATCHES...');
    console.log('=======================\n');

    let fixedStudents = 0;

    for (const student of students) {
      let needsFix = false;
      let correctDegreeLevel = student.degreeLevel;
      let correctDepartment = student.department;

      // Check if student's program matches any CourseEntry
      const matchingEntry = courseEntries.find(entry => 
        entry.degreeLevel.toLowerCase() === student.degreeLevel.toLowerCase() &&
        entry.department.toLowerCase() === student.department.toLowerCase()
      );

      if (!matchingEntry) {
        // Try to find a similar CourseEntry and update the student
        const similarEntry = courseEntries.find(entry => 
          entry.department.toLowerCase() === student.department.toLowerCase()
        );

        if (similarEntry) {
          console.log(`🔄 Fixing ${student.studentId}:`);
          console.log(`   From: "${student.degreeLevel}" - "${student.department}"`);
          console.log(`   To:   "${similarEntry.degreeLevel}" - "${similarEntry.department}"`);
          
          // Update student to match the CourseEntry
          await Student.findByIdAndUpdate(student._id, {
            degreeLevel: similarEntry.degreeLevel,
            department: similarEntry.department
          });
          
          fixedStudents++;
          needsFix = true;
        }
      }

      if (!needsFix && !matchingEntry) {
        console.log(`❌ No CourseEntry found for ${student.studentId}: "${student.degreeLevel}" - "${student.department}"`);
      }
    }

    console.log(`\n🎉 Fixed ${fixedStudents} students to match existing CourseEntries`);

    // Now run academic progress creation for all students
    if (fixedStudents > 0 || students.some(s => !s.academicProgress)) {
      console.log('\n🚀 CREATING ACADEMIC PROGRESS FOR ALL STUDENTS...');
      console.log('================================================\n');
      
      await createAcademicProgressForAllStudents();
    }

  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔗 MongoDB connection closed');
  }
};

const createAcademicProgressForAllStudents = async () => {
  try {
    const Student = require('../models/Student');
    const CourseEntry = require('../models/CourseEntry');
    const Batch = require('../models/Batch');

    const students = await Student.find().populate('batch');
    const courseEntries = await CourseEntry.find();

    let successCount = 0;
    let errorCount = 0;

    for (const student of students) {
      try {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          const batch = student.batch;
          if (!batch) {
            throw new Error('Batch not found');
          }

          // Find matching CourseEntry (case-insensitive)
          const courseEntry = courseEntries.find(entry => 
            entry.degreeLevel.toLowerCase() === student.degreeLevel.toLowerCase() &&
            entry.department.toLowerCase() === student.department.toLowerCase()
          );

          if (!courseEntry) {
            throw new Error(`No CourseEntry found for ${student.degreeLevel} - ${student.department}`);
          }

          const currentSemester = student.currentSemester || batch.currentSemester || 1;
          const totalCreditsRequired = courseEntry.semesters.reduce((sum, sem) => 
            sum + sem.courses.reduce((s, c) => s + c.creditHrs, 0), 0
          );

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
          successCount++;
          console.log(`✅ ${student.studentId}: Academic progress created (Sem ${currentSemester}, GPA: ${cumulativeGPA.toFixed(2)})`);

        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }

      } catch (error) {
        errorCount++;
        console.log(`❌ ${student.studentId}: ${error.message}`);
      }
    }

    console.log(`\n🎉 ACADEMIC PROGRESS CREATION COMPLETE!`);
    console.log(`📊 Success: ${successCount}, Errors: ${errorCount}, Total: ${students.length}`);

  } catch (error) {
    console.error('❌ Academic progress creation failed:', error);
  }
};

// Run the fix
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/UniverityERP');

mongoose.connection.on('connected', () => {
  console.log('✅ Connected to MongoDB');
  fixCourseEntryMatching();
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});