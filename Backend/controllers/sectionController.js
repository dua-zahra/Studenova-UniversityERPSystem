const Batch = require('../models/Batch');
const Student = require('../models/Student');

exports.getBatchSections = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId)
      .select('degreeLevel departmentName totalSemesters batchName currentSemester totalStudentsEnrolled totalSections sections statusCounts graduationStatus academicCalendar');
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const currentSemesterData = batch.academicCalendar.find(
      sem => sem.semester === batch.currentSemester
    );

    const transformedSections = batch.sections.map(section => ({
      name: section.name,
      studentCount: section.currentStrength,
      activeStudents: section.students.filter(student => student.status === 'active').length,
      inactiveStudents: section.students.filter(student => student.status === 'inactive').length,
      droppedStudents: section.students.filter(student => student.status === 'dropped').length,
      graduatedStudents: section.students.filter(student => student.status === 'graduated').length,
      suspendedStudents: section.students.filter(student => student.status === 'suspended').length,
      students: section.students.map(student => ({
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        photo: student.photo,
        universityEmail: student.universityEmail,
        contact: student.contact,
        status: student.status,
        enrollmentDate: student.enrollmentDate
      }))
    }));

    res.json({
      success: true,
      data: {
        degreeLevel: batch.degreeLevel,
        department: batch.departmentName,
        totalSemesters: batch.totalSemesters,
        batchName: batch.batchName,
        currentSemester: batch.currentSemester,
        currentSemesterName: currentSemesterData?.name || `Semester ${batch.currentSemester}`,
        currentSemesterStart: currentSemesterData?.startDate,
        currentSemesterEnd: currentSemesterData?.endDate,
        totalStudents: batch.totalStudentsEnrolled,
        totalSections: batch.totalSections,
        graduationStatus: batch.graduationStatus,
        isActive: batch.isActive,
        statusBreakdown: batch.statusCounts || {
          active: 0,
          inactive: 0,
          dropped: 0,
          graduated: 0,
          suspended: 0
        },
        sections: transformedSections,
        canModify: batch.graduationStatus === 'active', 
        enrollmentStatus: batch.enrollmentStatus,
        semesterProgress: batch.graduationStatus === 'graduated' ? 'completed' : 
                         currentSemesterData ? 'in-progress' : 'upcoming'
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};