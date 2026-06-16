const Faculty = require('../models/Faculty');
const Batch = require('../models/Batch');
const TeacherAssignment = require('../models/TeacherCourseAssignment');

exports.getAssignedCourses = async (req, res) => {
  try {
    const { universityEmail } = req.query;
    if (!universityEmail) {
      return res.status(400).json({ 
        success: false,
        message: 'Faculty email is required' 
      });
    }

    console.log(` Fetching ALL courses for faculty: ${universityEmail}`);

    const faculty = await Faculty.findOne({ universityEmail }).lean();
    if (!faculty) {
      return res.status(404).json({ 
        success: false,
        message: 'Faculty not found',
        courses: [] 
      });
    }

    const facultyId = faculty._id;
    console.log(` Found faculty: ${faculty.firstName} ${faculty.lastName} (${facultyId})`);

    const facultyAssignedCourses = faculty.assignedCourses || [];
    console.log(` Faculty has ${facultyAssignedCourses.length} course records in assignedCourses`);

    const courses = [];
    const missingBatchIds = [];

    for (const assignedCourse of facultyAssignedCourses) {
      try {
        let batch = null;
        let semesterInfo = null;
        let semesterStatus = 'unknown';
        let currentSemester = null;
        let graduationStatus = 'pending';

        try {
          batch = await Batch.findById(assignedCourse.batchId).lean();
          if (batch) {
            semesterInfo = batch.academicCalendar?.find(s => s.semester === assignedCourse.semester);
            currentSemester = batch.currentSemester;
            graduationStatus = batch.graduationStatus;

            const currentDate = new Date();
            if (batch.graduationStatus === 'graduated') {
              semesterStatus = 'graduated';
            } else if (semesterInfo) {
              if (currentDate > new Date(semesterInfo.endDate)) semesterStatus = 'past';
              else if (currentDate >= new Date(semesterInfo.startDate) && currentDate <= new Date(semesterInfo.endDate)) semesterStatus = 'current';
              else semesterStatus = 'future';
            }
          } else {
            missingBatchIds.push(assignedCourse.batchId?.toString());
          }
        } catch (batchError) {
          console.log(`⚠ Error fetching batch ${assignedCourse.batchId}: ${batchError.message}`);
          missingBatchIds.push(assignedCourse.batchId?.toString());
        }

        const courseData = {
          courseCode: assignedCourse.courseCode,
          courseName: assignedCourse.courseName,
          sectionName: assignedCourse.sectionName,
          batchId: assignedCourse.batchId,
          batchName: assignedCourse.batchName || batch?.batchName || 'Batch Not Found',
          degreeLevel: assignedCourse.degreeLevel || batch?.degreeLevel || 'Unknown',
          department: assignedCourse.department || batch?.departmentName || 'Unknown',
          semester: assignedCourse.semester,
          semesterName: semesterInfo?.name || `Semester ${assignedCourse.semester}`,
          semesterStatus,
          semesterStartDate: semesterInfo?.startDate,
          semesterEndDate: semesterInfo?.endDate,
          creditHrs: assignedCourse.creditHrs,
          assignedAt: assignedCourse.assignedAt,
          completedAt: assignedCourse.completedAt,
          removedAt: assignedCourse.removedAt,
          teachingStatus: assignedCourse.teachingStatus,
          isActive: assignedCourse.isActive,
          batchStatus: assignedCourse.batchStatus || graduationStatus,
          currentSemester,
          isCurrentSemester: currentSemester === assignedCourse.semester,
          canTeach: graduationStatus === 'pending' && semesterStatus === 'current',
          batchExists: !!batch,
          hasSemesterInfo: !!semesterInfo
        };

        courses.push(courseData);
        console.log(` Added course: ${assignedCourse.courseCode}-${assignedCourse.sectionName} (${assignedCourse.teachingStatus}) - Batch: ${batch ? 'Found' : 'Missing'}`);

      } catch (courseError) {
        console.error(` Error processing course ${assignedCourse.courseCode}: ${courseError.message}`);
        courses.push({
          courseCode: assignedCourse.courseCode,
          courseName: assignedCourse.courseName,
          sectionName: assignedCourse.sectionName,
          batchId: assignedCourse.batchId,
          batchName: assignedCourse.batchName || 'Error Loading',
          semester: assignedCourse.semester,
          creditHrs: assignedCourse.creditHrs,
          teachingStatus: assignedCourse.teachingStatus,
          isActive: assignedCourse.isActive,
          assignedAt: assignedCourse.assignedAt,
          completedAt: assignedCourse.completedAt,
          removedAt: assignedCourse.removedAt,
          batchExists: false,
          hasSemesterInfo: false,
          error: courseError.message
        });
      }
    }

    console.log(` Returning ${courses.length} total courses for faculty ${universityEmail}`);
    if (missingBatchIds.length > 0) {
      console.log(`⚠ Missing batches: ${Array.from(new Set(missingBatchIds)).join(', ')}`);
    }

    
    const summary = {
      total: courses.length,
      inProgress: courses.filter(c => c.teachingStatus === 'in-progress' && c.isActive).length,
      completed: courses.filter(c => c.teachingStatus === 'completed').length,
      removed: courses.filter(c => c.teachingStatus === 'removed').length,
      currentWorkload: faculty.currentWorkload,
      batches: {
        total: new Set(courses.map(c => c.batchId?.toString())).size,
        found: new Set(courses.filter(c => c.batchExists).map(c => c.batchId?.toString())).size,
        missing: new Set(courses.filter(c => !c.batchExists).map(c => c.batchId?.toString())).size
      }
    };

    res.json({ 
      success: true,
      faculty: {
        id: faculty._id,
        name: `${faculty.firstName} ${faculty.lastName}`,
        email: universityEmail,
        department: faculty.department,
        designation: faculty.designation,
        currentWorkload: faculty.currentWorkload,
        isActive: faculty.isActive
      },
      courses: courses.sort((a, b) => {
        const statusOrder = { 'in-progress': 1, 'completed': 2, 'removed': 3 };
        if (statusOrder[a.teachingStatus] !== statusOrder[b.teachingStatus]) {
          return statusOrder[a.teachingStatus] - statusOrder[b.teachingStatus];
        }
        if (a.semester !== b.semester) return b.semester - a.semester;
        return a.courseCode.localeCompare(b.courseCode);
      }),
      summary,
      metadata: {
        missingBatches: Array.from(new Set(missingBatchIds)),
        totalProcessed: facultyAssignedCourses.length,
        successful: courses.length,
        failed: facultyAssignedCourses.length - courses.length
      }
    });

  } catch (err) {
    console.error(' Error fetching faculty courses:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch courses',
      error: err.message 
    });
  }
};

exports.getCoursesByStatus = async (req, res) => {
  try {
    const { universityEmail, status } = req.query;
    if (!universityEmail || !status) {
      return res.status(400).json({ success: false, message: 'Faculty email and status are required' });
    }

    const validStatuses = ['in-progress', 'completed', 'removed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const faculty = await Faculty.findOne({ universityEmail }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty not found' });

    const filteredCourses = (faculty.assignedCourses || []).filter(course => course.teachingStatus === status);

    res.json({ success: true, status, count: filteredCourses.length, courses: filteredCourses });

  } catch (err) {
    console.error('Error fetching courses by status:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch courses', error: err.message });
  }
};

exports.getTeachingHistory = async (req, res) => {
  try {
    const { universityEmail } = req.query;
    if (!universityEmail) return res.status(400).json({ success: false, message: 'Faculty email is required' });

    const faculty = await Faculty.findOne({ universityEmail }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty not found' });

    const timeline = {};
    (faculty.assignedCourses || []).forEach(course => {
      const semesterKey = `Semester ${course.semester}`;
      if (!timeline[semesterKey]) timeline[semesterKey] = { semester: course.semester, inProgress: [], completed: [], removed: [] };

      const courseInfo = {
        courseCode: course.courseCode,
        courseName: course.courseName,
        sectionName: course.sectionName,
        batchName: course.batchName,
        creditHrs: course.creditHrs,
        assignedAt: course.assignedAt,
        statusChangedAt: course.completedAt || course.removedAt || course.assignedAt,
        batchId: course.batchId
      };

      const key = course.teachingStatus === 'in-progress' ? 'inProgress' : course.teachingStatus === 'completed' ? 'completed' : 'removed';
      timeline[semesterKey][key].push(courseInfo);
    });

    const timelineArray = Object.values(timeline).sort((a, b) => b.semester - a.semester);

    res.json({
      success: true,
      faculty: `${faculty.firstName} ${faculty.lastName}`,
      timeline: timelineArray,
      statistics: {
        totalCourses: faculty.assignedCourses.length,
        totalCredits: (faculty.assignedCourses || []).reduce((sum, c) => sum + (c.creditHrs || 0), 0),
        currentActive: (faculty.assignedCourses || []).filter(c => c.teachingStatus === 'in-progress' && c.isActive).length,
        yearsTeaching: new Date().getFullYear() - new Date(faculty.joiningDate).getFullYear()
      }
    });

  } catch (err) {
    console.error('Error fetching teaching history:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch teaching history', error: err.message });
  }
};

exports.testRoute = async (req, res) => {
  try {
    console.log('Test route called successfully!');
    res.json({ success: true, message: 'Faculty courses API is working!', timestamp: new Date().toISOString(), version: '1.0.0' });
  } catch (err) {
    console.error('Test route error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
