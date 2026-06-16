const schedule = require('node-schedule');
const mongoose = require('mongoose');
const Batch = require('../models/Batch');
const Student = require('../models/Student');
const TeacherAssignment = require('../models/TeacherCourseAssignment');
const CourseEntry = require('../models/CourseEntry');
const { isAfter } = require('date-fns');

const runSemesterProgression = async () => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log('Running semester progression job...');
    
    const batches = await Batch.find({ isActive: true }).session(session);

    for (const batch of batches) {
      const currentSemesterData = batch.academicCalendar.find(
        sem => sem.semester === batch.currentSemester
      );

      if (currentSemesterData && isAfter(new Date(), currentSemesterData.endDate)) {
        // 1. Close current semester's assignments
        await TeacherAssignment.updateOne(
          { batchId: batch._id, semester: batch.currentSemester },
          { $set: { isActive: false, completedAt: new Date() } },
          { session }
        );

        // 2. Graduation Check
        if (batch.currentSemester >= batch.totalSemesters) {
          batch.isActive = false;
          await batch.save({ session });
          console.log(`Batch ${batch.batchName} graduated.`);
          continue;
        }

        // 3. Advance Semester
        batch.currentSemester += 1;
        await batch.save({ session });
        console.log(`Batch ${batch.batchName} advanced to semester ${batch.currentSemester}`);

        // 4. Create TeacherAssignment for new semester
        const courseEntry = await CourseEntry.findOne({ 
          degreeLevel: batch.degreeLevel, 
          department: batch.departmentName 
        }).session(session);

        if (!courseEntry) {
          console.warn(`CourseEntry not found for ${batch.degreeLevel} - ${batch.departmentName}`);
          continue;
        }

        const semesterCourses = courseEntry.semesters.find(
          sem => sem.semesterNumber === batch.currentSemester
        );

        if (!semesterCourses) {
          console.warn(`Semester ${batch.currentSemester} not defined in CourseEntry for batch ${batch.batchName}`);
          continue;
        }

        const newAssignment = new TeacherAssignment({
          batchId: batch._id,
          degreeLevel: batch.degreeLevel,
          department: batch.departmentName,
          semester: batch.currentSemester,
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

    // 5. Process Students
    const students = await Student.find({
      status: 'active',
      'academicProgress.currentSemester': { $exists: true }
    }).populate('batch').session(session);

    for (const student of students) {
      try {
        if (!Array.isArray(student.academicProgress.semesters)) continue;

        const currentSemester = student.academicProgress.semesters.find(
          s => s.semesterNumber === student.academicProgress.currentSemester
        );

        if (
          currentSemester &&
          currentSemester.status === 'in-progress' &&
          currentSemester.endDate &&
          isAfter(new Date(), currentSemester.endDate)
        ) {
          const incompleteCourses = currentSemester.courses.filter(
            c => !['completed', 'failed', 'dropped'].includes(c.status)
          );

          if (incompleteCourses.length === 0) {
            await student.checkSemesterProgression();
            console.log(`Student ${student.studentId} progressed to next semester`);
          }
        }

        if (student.academicProgress.completionPercentage >= 100) {
          student.status = 'graduated';
          await student.save({ session });
          console.log(`Student ${student.studentId} graduated`);
        }
      } catch (err) {
        console.error(`Error processing student ${student.studentId}:`, err);
      }
    }

    await session.commitTransaction();
    console.log('Semester progression job completed successfully.');
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in semester progression job:', error);
  } finally {
    session.endSession();
  }
};

// Scheduled run daily at midnight
const semesterProgressionJob = schedule.scheduleJob('0 0 * * *', runSemesterProgression);

module.exports = {
  semesterProgressionJob,
  runSemesterProgression
};
