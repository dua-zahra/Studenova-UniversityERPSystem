const Result = require("../models/Result");
const StudentResults = require("../models/StudentResults");
const Student = require("../models/Student");

const calculateTotalMarks = (assessments) => {
  let totalObtained = 0;
  let totalWeightage = 0;

  (assessments || []).forEach(a => {
    const obtained = Number(a.obtainedMarks ?? 0);
    const total = Number(a.totalMarks ?? 100); 
    const weight = Number(a.weightage ?? 0);

    if (total > 0 && weight > 0) {
      const percentage = (obtained / total) * weight;
      totalObtained += percentage;
    }
    totalWeightage += weight;
  });

  if (totalWeightage > 0 && totalWeightage !== 100) {
    totalObtained = (totalObtained / totalWeightage) * 100;
  }

  return {
    totalObtained: Math.min(Math.max(totalObtained, 0), 100),
    totalWeightage
  };
};


const saveFacultyResults = async (req, res) => {
  try {
    const results = req.body.results;
    const departmentFromRequest = req.body.department;

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ message: "No results to save" });
    }

    const failures = [];
    const coursesMap = {};

    for (const studentData of results) {
      try {
        const student = await Student.findOne({ studentId: studentData.studentId });

        if (!student || !student.batchId || !student.universityEmail) {
          failures.push({ studentId: studentData.studentId, reason: "Missing batchId or universityEmail" });
          continue;
        }

        let newAssessments = [];
        if (Array.isArray(studentData.assessments)) {
          newAssessments = studentData.assessments.map(a => ({
            name: (a && a.name) ? String(a.name) : "Final",
            obtainedMarks: Number(a?.obtainedMarks ?? 0),
            totalMarks: Number(a?.totalMarks ?? 100),
            weightage: Number(a?.weightage ?? 0)
          }));
        }

        const resolvedDepartment = departmentFromRequest || student.department || "N/A";

        let studentDoc = await StudentResults.findOne({ studentId: student.studentId });

        if (!studentDoc) {
          studentDoc = new StudentResults({
            studentId: student.studentId,
            studentName: `${student.firstName || ""} ${student.lastName || ""}`.trim(),
            batchName: student.batchName || "",
            batchId: student.batchId,
            universityEmail: student.universityEmail,
            degreeLevel: student.degreeLevel || "Undergraduate",
            department: resolvedDepartment,
            currentSemester: Number(studentData.semester) || 1,
            academicProgress: []
          });
        }

        const semesterNumber = Number(studentData.semester) || 1;
        if (semesterNumber > studentDoc.currentSemester) {
          studentDoc.currentSemester = semesterNumber;
        }
        
        let sem = studentDoc.academicProgress.find(s => Number(s.semesterNumber) === semesterNumber);
        if (!sem) {
          sem = { semesterNumber, courses: [] };
          studentDoc.academicProgress.push(sem);
        }

        const sectionName = (studentData.sectionName ?? student.sectionName ?? "").toString();
        let course = sem.courses.find(c =>
          c.courseCode === studentData.courseCode &&
          (c.sectionName || "") === sectionName
        );

        const { totalObtained, totalWeightage } = calculateTotalMarks(newAssessments);

        if (totalWeightage > 100) {
          failures.push({ studentId: student.studentId, reason: "Weightage exceeds 100%" });
          continue;
        }

        newAssessments = newAssessments.map(a => ({
          name: a.name || "Final",
          obtainedMarks: Number(a.obtainedMarks ?? 0),
          totalMarks: Number(a.totalMarks ?? 100),
          weightage: Number(a.weightage ?? 0)
        }));

        const calculateGradeAndPoints = (percentage) => {
          if (percentage >= 90) return { grade: 'A+', gradePoints: 4.0 };
          if (percentage >= 85) return { grade: 'A', gradePoints: 3.7 };
          if (percentage >= 80) return { grade: 'A-', gradePoints: 3.3 };
          if (percentage >= 75) return { grade: 'B+', gradePoints: 3.0 };
          if (percentage >= 70) return { grade: 'B', gradePoints: 2.7 };
          if (percentage >= 65) return { grade: 'B-', gradePoints: 2.3 };
          if (percentage >= 60) return { grade: 'C+', gradePoints: 2.0 };
          if (percentage >= 55) return { grade: 'C', gradePoints: 1.7 };
          if (percentage >= 50) return { grade: 'C-', gradePoints: 1.3 };
          if (percentage >= 45) return { grade: 'D+', gradePoints: 1.0 };
          if (percentage >= 40) return { grade: 'D', gradePoints: 0.7 };
          return { grade: 'F', gradePoints: 0.0 };
        };

        const gradeAndPoints = calculateGradeAndPoints(totalObtained);

        if (!course) {
          course = {
            courseCode: studentData.courseCode,
            courseName: studentData.courseName || "",
            semester: semesterNumber,
            assessments: newAssessments,
            obtainedMarks: totalObtained,
            totalMarks: 100, 
            percentage: totalObtained,
            grade: gradeAndPoints.grade,
            gradePoints: gradeAndPoints.gradePoints,
            status: "completed",
            batchName: studentData.batch || student.batchName || "",
            sectionName,
            department: resolvedDepartment
          };
          sem.courses.push(course);
        } else {
          newAssessments.forEach(newA => {
            const exists = course.assessments.find(a => a.name === newA.name);
            if (exists) {
              exists.obtainedMarks = Number(newA.obtainedMarks ?? exists.obtainedMarks ?? 0);
              exists.totalMarks = Number(newA.totalMarks ?? exists.totalMarks ?? 100);
              exists.weightage = Number(newA.weightage ?? exists.weightage ?? 0);
            } else {
              course.assessments.push({
                name: newA.name,
                obtainedMarks: Number(newA.obtainedMarks ?? 0),
                totalMarks: Number(newA.totalMarks ?? 100),
                weightage: Number(newA.weightage ?? 0)
              });
            }
          });

          const recalculated = calculateTotalMarks(course.assessments);
          course.obtainedMarks = recalculated.totalObtained;
          course.percentage = recalculated.totalObtained;
          course.totalMarks = 100; 

          const gp = calculateGradeAndPoints(recalculated.totalObtained);
          course.grade = gp.grade;
          course.gradePoints = gp.gradePoints;
        }

        await studentDoc.save();

        const key = `${studentData.courseCode}_${(studentData.batch || student.batchName || "").toString()}_${sectionName}`;
        const resolvedCourseDepartment = departmentFromRequest || student.department || "N/A";

        if (!coursesMap[key]) {
          coursesMap[key] = {
            courseCode: studentData.courseCode,
            courseName: studentData.courseName || "",
            batchName: studentData.batch || student.batchName || "",
            sectionName,
            department: resolvedCourseDepartment,
            semester: semesterNumber,
            totalStudents: 0,
            totalMarks: 100, 
            results: []
          };
        }

        const safeAssessments = (course.assessments || []).map(a => ({
          name: a.name || "Final",
          obtainedMarks: Number(a.obtainedMarks ?? 0),
          totalMarks: Number(a.totalMarks ?? 100),
          weightage: Number(a.weightage ?? 0)
        }));

        const resultObj = {
          studentId: student.studentId,
          studentName: `${student.firstName || ""} ${student.lastName || ""}`.trim(),
          assessments: safeAssessments,
          obtainedMarks: Number(course.obtainedMarks ?? 0),
          totalMarks: 100, 
          percentage: Number(course.percentage ?? course.obtainedMarks ?? 0),
          grade: course.grade || gradeAndPoints.grade,
          gradePoints: course.gradePoints || gradeAndPoints.gradePoints,
          status: course.status || "completed"
        };

        const existingIndex = coursesMap[key].results.findIndex(r => r.studentId === student.studentId);
        if (existingIndex > -1) {
          coursesMap[key].results[existingIndex] = resultObj;
        } else {
          coursesMap[key].results.push(resultObj);
        }

      } catch (err) {
        failures.push({ studentId: studentData.studentId, reason: err.message });
      }
    }

    for (const key in coursesMap) {
      const data = coursesMap[key];
      data.totalStudents = data.results.length;
      data.department = data.department || "N/A";
      data.semester = data.semester || 1;
      data.totalMarks = 100; 

      let resultDoc = await Result.findOne({
        courseCode: data.courseCode,
        batchName: data.batchName,
        sectionName: data.sectionName
      });

      if (!resultDoc) {
        resultDoc = new Result({
          courseCode: data.courseCode,
          courseName: data.courseName || "",
          sectionName: data.sectionName || "",
          batchName: data.batchName || "",
          department: data.department,
          semester: data.semester,
          totalStudents: data.totalStudents,
          totalMarks: 100, 
          results: (data.results || []).map(r => ({
            studentId: r.studentId,
            studentName: r.studentName,
            assessments: (r.assessments || []).map(a => ({
              name: a.name || "Final",
              obtainedMarks: Number(a.obtainedMarks ?? 0),
              totalMarks: Number(a.totalMarks ?? 100),
              weightage: Number(a.weightage ?? 0)
            })),
            obtainedMarks: Number(r.obtainedMarks ?? 0),
            totalMarks: 100, // Fixed to 100
            grade: r.grade || "N/A",
            gradePoints: r.gradePoints || 0,
            status: r.status || "completed"
          }))
        });
      } else {
        resultDoc.department = data.department;
        resultDoc.courseName = data.courseName || resultDoc.courseName;
        resultDoc.semester = data.semester || resultDoc.semester;
        resultDoc.totalStudents = data.totalStudents;
        resultDoc.totalMarks = 100; 

        resultDoc.results = resultDoc.results || [];

        for (const incoming of (data.results || [])) {
          const safeAssess = (incoming.assessments || []).map(a => ({
            name: a.name || "Final",
            obtainedMarks: Number(a.obtainedMarks ?? 0),
            totalMarks: Number(a.totalMarks ?? 100),
            weightage: Number(a.weightage ?? 0)
          }));

          const studentEntry = {
            studentId: incoming.studentId,
            studentName: incoming.studentName || "",
            assessments: safeAssess,
            obtainedMarks: Number(incoming.obtainedMarks ?? 0),
            totalMarks: 100, 
            grade: incoming.grade || "N/A",
            gradePoints: incoming.gradePoints || 0,
            status: incoming.status || "completed"
          };

          const ix = resultDoc.results.findIndex(r => r.studentId === incoming.studentId);
          if (ix > -1) {
            resultDoc.results[ix] = studentEntry;
          } else {
            resultDoc.results.push(studentEntry);
          }
        }
      }

      await resultDoc.save();
    }

    return res.json({ message: "Results processed successfully", failures });

  } catch (error) {
    console.error(" Error saving results:", error);
    return res.status(500).json({ message: "Failed to save results", error: error.message });
  }
};

const updateResults = async (req, res) => {
  try {
    const { batchName, semester, courseCode, courseName, sectionName, students, department } = req.body;

    if (!batchName || !semester || !courseCode || sectionName === undefined || !Array.isArray(students)) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const failures = [];
    const courseDepartment = department || "N/A";

    for (const studentData of students) {
      try {
        const student = await Student.findOne({ studentId: studentData.studentId });

        if (!student || !student.batchId || !student.universityEmail) {
          failures.push({ studentId: studentData.studentId, reason: "Missing batchId or universityEmail" });
          continue;
        }

        const assessments = (studentData.resultsRecords || []).map(a => ({
          name: a.name || "Final",
          obtainedMarks: Number(a.obtainedMarks ?? 0),
          totalMarks: Number(a.totalMarks ?? 100),
          weightage: Number(a.weightage ?? 0),
        }));

        const { totalObtained } = calculateTotalMarks(assessments);
        const totalMarks = 100; 
        const percentage = totalObtained; 

        const calculateGradeAndPoints = (perc) => {
          if (perc >= 90) return { grade: 'A+', gradePoints: 4.0 };
          if (perc >= 85) return { grade: 'A', gradePoints: 3.7 };
          if (perc >= 80) return { grade: 'A-', gradePoints: 3.3 };
          if (perc >= 75) return { grade: 'B+', gradePoints: 3.0 };
          if (perc >= 70) return { grade: 'B', gradePoints: 2.7 };
          if (perc >= 65) return { grade: 'B-', gradePoints: 2.3 };
          if (perc >= 60) return { grade: 'C+', gradePoints: 2.0 };
          if (perc >= 55) return { grade: 'C', gradePoints: 1.7 };
          if (perc >= 50) return { grade: 'C-', gradePoints: 1.3 };
          if (perc >= 45) return { grade: 'D+', gradePoints: 1.0 };
          if (perc >= 40) return { grade: 'D', gradePoints: 0.7 };
          return { grade: 'F', gradePoints: 0.0 };
        };

        const { grade, gradePoints } = calculateGradeAndPoints(percentage);
        const resolvedDepartment = department || student.department || "N/A";

        let studentDoc = await StudentResults.findOne({ studentId: studentData.studentId });

        if (!studentDoc) {
          studentDoc = new StudentResults({
            studentId: studentData.studentId,
            studentName: studentData.studentName || `${student.firstName || ""} ${student.lastName || ""}`.trim(),
            batchName: batchName,
            batchId: student.batchId,
            universityEmail: student.universityEmail,
            degreeLevel: student.degreeLevel || "Undergraduate",
            department: resolvedDepartment,
            currentSemester: Number(semester),
            academicProgress: []
          });
        } else {
          if (Number(semester) > studentDoc.currentSemester) {
            studentDoc.currentSemester = Number(semester);
          }
        }

        let sem = studentDoc.academicProgress.find(s => Number(s.semesterNumber) === Number(semester));
        if (!sem) {
          sem = { semesterNumber: Number(semester), courses: [] };
          studentDoc.academicProgress.push(sem);
        }

        let course = sem.courses.find(c =>
          c.courseCode === courseCode &&
          (c.sectionName || "") === (sectionName || "")
        );

        const courseObj = {
          courseCode,
          courseName,
          semester: Number(semester),
          assessments,
          obtainedMarks: totalObtained,
          totalMarks: 100, // Fixed to 100
          percentage,
          grade,
          gradePoints,
          status: "completed",
          batchName,
          sectionName: sectionName || "",
          department: resolvedDepartment 
        };

        if (course) {
          Object.assign(course, courseObj);
        } else {
          sem.courses.push(courseObj);
        }

        await studentDoc.save();

      } catch (err) {
        failures.push({ studentId: studentData.studentId, reason: err.message });
      }
    }

    const resultStudents = await Promise.all(
      students.map(async (studentData) => {
        const student = await Student.findOne({ studentId: studentData.studentId });

        const assessments = (studentData.resultsRecords || []).map(a => ({
          name: a.name || "Final",
          obtainedMarks: Number(a.obtainedMarks ?? 0),
          totalMarks: Number(a.totalMarks ?? 100),
          weightage: Number(a.weightage ?? 0),
        }));

        const { totalObtained } = calculateTotalMarks(assessments);
        const totalMarks = 100; // Fixed to 100
        const percentage = totalObtained; 

        const calculateGradeAndPoints = (perc) => {
          if (perc >= 90) return { grade: 'A+', gradePoints: 4.0 };
          if (perc >= 85) return { grade: 'A', gradePoints: 3.7 };
          if (perc >= 80) return { grade: 'A-', gradePoints: 3.3 };
          if (perc >= 75) return { grade: 'B+', gradePoints: 3.0 };
          if (perc >= 70) return { grade: 'B', gradePoints: 2.7 };
          if (perc >= 65) return { grade: 'B-', gradePoints: 2.3 };
          if (perc >= 60) return { grade: 'C+', gradePoints: 2.0 };
          if (perc >= 55) return { grade: 'C', gradePoints: 1.7 };
          if (perc >= 50) return { grade: 'C-', gradePoints: 1.3 };
          if (perc >= 45) return { grade: 'D+', gradePoints: 1.0 };
          if (perc >= 40) return { grade: 'D', gradePoints: 0.7 };
          return { grade: 'F', gradePoints: 0.0 };
        };

        const { grade, gradePoints } = calculateGradeAndPoints(percentage);

        return {
          studentId: studentData.studentId,
          studentName: studentData.studentName || `${student?.firstName || ""} ${student?.lastName || ""}`.trim(),
          assessments,
          obtainedMarks: totalObtained,
          totalMarks: 100, // Fixed to 100
          percentage,
          grade,
          gradePoints,
          status: "completed"
        };
      })
    );

    let resultDoc = await Result.findOne({
      courseCode,
      batchName,
      sectionName
    });

    if (!resultDoc) {
      resultDoc = new Result({
        courseCode,
        courseName,
        batchName,
        sectionName,
        department: courseDepartment,
        semester: Number(semester),
        totalStudents: students.length,
        totalMarks: 100, 
        results: resultStudents
      });
    } else {
      resultDoc.results = resultStudents;
      resultDoc.totalStudents = students.length;
      resultDoc.semester = Number(semester);
      resultDoc.department = courseDepartment;
      resultDoc.totalMarks = 100;
    }

    await resultDoc.save();

    return res.status(200).json({
      success: true,
      message: "Results updated successfully",
      failures,
      data: resultDoc
    });

  } catch (err) {
    console.error(" Error updating results:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update results",
      error: err.message
    });
  }
};

const getStudentResults = async (req, res) => {
  try {
    const data = await StudentResults.findOne({ studentId: req.params.studentId });
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getResultsByCourse = async (req, res) => {
  try {
    const { batchName, courseCode, sectionName } = req.params;

    const doc = await Result.findOne({
      batchName,
      courseCode,
      sectionName: sectionName || ""
    });

    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getResultsWithTeacher = async (req, res) => {
  try {
    const { batchName, courseCode, sectionName } = req.query;

    if (!batchName || !courseCode) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const doc = await Result.findOne({
      batchName: batchName.trim(),
      courseCode: courseCode.trim(),
      sectionName: (sectionName || "").trim()
    });

    if (!doc) {
      return res.json({
        students: [],
        teacherName: "N/A",
        courseCode,
        batchName,
        sectionName
      });
    }

    res.json({
      students: doc.results || [],
      teacherName: doc.teacherName || "N/A",
      courseCode: doc.courseCode,
      courseName: doc.courseName,
      batchName: doc.batchName,
      sectionName: doc.sectionName,
      semester: doc.semester,
      department: doc.department || "N/A"
    });
  } catch (err) {
    console.error("Error fetching results:", err);
    res.status(500).json({ error: err.message });
  }
};

const deleteResults = async (req, res) => {
  try {
    const { courseCode, batchName, sectionName } = req.body;

    if (!courseCode || !batchName) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const doc = await Result.findOne({
      courseCode,
      batchName,
      sectionName: sectionName || ""
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "No results found"
      });
    }

    const studentIds = (doc.results || []).map(r => r.studentId);

    await Result.deleteOne({
      courseCode,
      batchName,
      sectionName: sectionName || ""
    });

    for (const studentId of studentIds) {
      try {
        const studentDoc = await StudentResults.findOne({ studentId });
        if (!studentDoc) continue;

        studentDoc.academicProgress.forEach(semester => {
          semester.courses = semester.courses.filter(course =>
            !(course.courseCode === courseCode &&
              (course.sectionName || "") === (sectionName || ""))
          );
        });

        studentDoc.academicProgress = studentDoc.academicProgress.filter(
          semester => semester.courses.length > 0
        );

        await studentDoc.save();
      } catch (err) {
        console.error(`Error updating student ${studentId}:`, err);
      }
    }

    res.json({
      success: true,
      message: "Results deleted successfully"
    });
  } catch (err) {
    console.error("Error deleting results:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

module.exports = {
  saveFacultyResults,
  updateResults,
  getStudentResults,
  getResultsByCourse,
  getResultsWithTeacher,
  deleteResults
};