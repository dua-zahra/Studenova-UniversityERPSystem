const express = require('express');
const router = express.Router();
const CourseEntry = require('../models/CourseEntry');
const Department = require('../models/Department'); 

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

const DEGREE_LEVELS = Object.keys(DEGREE_CONFIG);

const formatCourseName = (name) => {
  if (!name) return '';
  return name.trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatCourseCode = (code) => {
  return code ? code.trim().toUpperCase() : '';
};

const flattenCourses = (semesters) =>
  semesters.flatMap((s) => s.courses.map((c) => ({ 
    ...c, 
    semesterNumber: s.semesterNumber 
  })));

const findDup = (courses) => {
  const codes = new Set();
  const names = new Set();
  for (const c of courses) {
    const code = c.courseCode.toLowerCase();
    const name = c.courseName.toLowerCase();
    if (codes.has(code)) return { type: 'code', value: c.courseCode };
    if (names.has(name)) return { type: 'name', value: c.courseName };
    codes.add(code);
    names.add(name);
  }
  return null;
};

const sumCredits = (courses) => courses.reduce((total, c) => total + c.creditHrs, 0);

const sortSemesters = (semesters) => semesters.sort((a, b) => a.semesterNumber - b.semesterNumber);

const sameSemData = (a, b) => {
  if (a.length !== b.length) return false;
  const s1 = sortSemesters([...a]);
  const s2 = sortSemesters([...b]);
  return s1.every((sem, i) => {
    const other = s2[i];
    if (sem.semesterNumber !== other.semesterNumber || sem.courses.length !== other.courses.length) return false;
    const c1 = [...sem.courses].sort((x, y) => x.courseCode.localeCompare(y.courseCode));
    const c2 = [...other.courses].sort((x, y) => x.courseCode.localeCompare(y.courseCode));
    return c1.every((c, j) =>
      c.courseCode.toLowerCase() === c2[j].courseCode.toLowerCase() &&
      c.courseName.toLowerCase() === c2[j].courseName.toLowerCase() &&
      c.creditHrs === c2[j].creditHrs &&
      c.type === c2[j].type
    );
  });
};

exports.getDegreeConfig = async (_req, res) => {
  try {
    res.json(DEGREE_CONFIG);
  } catch (err) {
    console.error('getDegreeConfig error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.addOrUpdateCourseEntry = async (req, res) => {
  try {
    let { degreeLevel, department, semesters } = req.body;

    if (!degreeLevel || !department || !Array.isArray(semesters)) {
      return res.status(400).json({ message: 'Invalid input: degreeLevel, department and semesters array are required' });
    }

    if (!DEGREE_LEVELS.includes(degreeLevel)) {
      return res.status(400).json({ message: 'Invalid degree level' });
    }

    department = department.trim();
    if (!department) {
      return res.status(400).json({ message: 'Department name cannot be empty' });
    }

    semesters = semesters.map(semester => ({
      ...semester,
      courses: semester.courses.map(course => ({
        ...course,
        courseName: formatCourseName(course.courseName),
        courseCode: formatCourseCode(course.courseCode),
        creditHrs: Number(course.creditHrs) || 0,
        type: course.type || 'Core'
      }))
    }));

    for (const sem of semesters) {
      for (const c of sem.courses) {
        if (!c.courseName || !c.courseCode) {
          return res.status(400).json({ message: 'Course name and code are required' });
        }
      }
    }

    semesters = sortSemesters(semesters);
    const semesterNumbers = semesters.map((s) => s.semesterNumber);
    const uniqueSemesters = new Set(semesterNumbers);
    if (uniqueSemesters.size !== semesterNumbers.length) {
      return res.status(400).json({ message: 'Duplicate semester numbers in request.' });
    }

    const errDup = findDup(flattenCourses(semesters));
    if (errDup) {
      return res.status(400).json({ message: `Duplicate course ${errDup.type} in request: ${errDup.value}` });
    }

    const degreeInfo = DEGREE_CONFIG[degreeLevel];
    for (const s of semesters) {
      if (s.semesterNumber < 1 || s.semesterNumber > degreeInfo.maxSemesters) {
        return res.status(400).json({ 
          message: `Semester number must be between 1 and ${degreeInfo.maxSemesters} for ${degreeLevel} programs.` 
        });
      }
      
      const semesterLimit = degreeInfo.semesterLimits[s.semesterNumber];
      if (sumCredits(s.courses) > semesterLimit) {
        return res.status(400).json({
          message: `Semester ${s.semesterNumber} exceeds credit limit of ${semesterLimit} for ${degreeLevel} programs.`
        });
      }
    }

    let entry = await CourseEntry.findOne({ degreeLevel, department });

    if (!entry) {
      const created = await CourseEntry.create({ degreeLevel, department, semesters });
      return res.status(201).json({ message: 'Courses saved.', data: created });
    }

    if (sameSemData(entry.semesters, semesters)) {
      return res.status(200).json({ message: 'No changes — identical data already stored.' });
    }

    const existingCodes = new Set();
    const existingNames = new Set();
    const existingCreditMap = {};

    entry.semesters.forEach((sem) => {
      existingCreditMap[sem.semesterNumber] = sumCredits(sem.courses);
      sem.courses.forEach((c) => {
        existingCodes.add(c.courseCode.toLowerCase());
        existingNames.add(c.courseName.toLowerCase());
      });
    });

    for (const sem of semesters) {
      const incomingCredits = sumCredits(sem.courses);
      const combined = (existingCreditMap[sem.semesterNumber] || 0) + incomingCredits;
      const semesterLimit = degreeInfo.semesterLimits[sem.semesterNumber];

      if (combined > semesterLimit) {
        return res.status(400).json({
          message: `Semester ${sem.semesterNumber} would reach ${combined} credits (limit ${semesterLimit}).`
        });
      }

      for (const c of sem.courses) {
        const code = c.courseCode.toLowerCase();
        const name = c.courseName.toLowerCase();
        if (existingCodes.has(code)) return res.status(409).json({ message: `Course code already exists: ${c.courseCode}` });
        if (existingNames.has(name)) return res.status(409).json({ message: `Course name already exists: ${c.courseName}` });
      }
    }

    for (const incSem of semesters) {
      const targetSem = entry.semesters.find((s) => s.semesterNumber === incSem.semesterNumber);
      if (!targetSem) {
        entry.semesters.push(incSem);
      } else {
        incSem.courses.forEach((c) => targetSem.courses.push(c));
      }
    }

    sortSemesters(entry.semesters);
    await entry.save();
    return res.status(200).json({ message: 'Courses updated.', data: entry });
  } catch (err) {
    console.error('addOrUpdateCourseEntry error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.getDegreeLevels = async (_req, res) => {
  try {
    res.json(DEGREE_LEVELS);
  } catch (err) {
    console.error('getDegreeLevels error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getDepartments = async (req, res) => {
  try {
    const { degreeLevel } = req.query;
    if (!degreeLevel) {
      return res.status(400).json({ message: 'Degree level is required' });
    }

    if (!DEGREE_LEVELS.includes(degreeLevel)) {
      return res.status(400).json({ message: 'Invalid degree level' });
    }

    const departments = await CourseEntry.distinct('department', { degreeLevel });
    res.json(departments.sort());
  } catch (err) {
    console.error('getDepartments error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getSemesters = async (req, res) => {
  try {
    const { degreeLevel, department } = req.query;
    
    if (!degreeLevel || !department) {
      return res.status(400).json({ message: 'Degree level and department are required' });
    }

    const decodedDepartment = decodeURIComponent(department).trim();
    
    const entry = await CourseEntry.findOne({ 
      degreeLevel, 
      department: { $regex: new RegExp(`^${decodedDepartment}$`, 'i') }
    });

    if (!entry || !entry.semesters || entry.semesters.length === 0) {
      return res.json([]);
    }

    const semesters = [...new Set(entry.semesters.map(s => s.semesterNumber))].sort((a, b) => a - b);
    res.json(semesters);
  } catch (err) {
    console.error('getSemesters error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getCourses = async (req, res) => {
  try {
    const { degreeLevel, department, semester } = req.query;
    
    if (!degreeLevel || !department || !semester) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    const decodedDepartment = decodeURIComponent(department).trim();
    const semesterNumber = parseInt(semester);

    const entry = await CourseEntry.findOne({
      degreeLevel,
      department: { $regex: new RegExp(`^${decodedDepartment}$`, 'i') }
    });

    if (!entry) return res.json([]);

    const semesterData = entry.semesters.find(s => s.semesterNumber === semesterNumber);
    if (!semesterData) return res.json([]);

    res.json(semesterData.courses.map(course => ({
      courseName: course.courseName,
      courseCode: course.courseCode,
      creditHrs: course.creditHrs,
      type: course.type
    })));
  } catch (err) {
    console.error('getCourses error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getSemesterCredits = async (req, res) => {
  try {
    const { degreeLevel, department } = req.query;
    if (!degreeLevel || !department) return res.status(400).json({ message: 'Missing degree level or department' });

    if (!DEGREE_LEVELS.includes(degreeLevel)) {
      return res.status(400).json({ message: 'Invalid degree level' });
    }

    const decodedDepartment = decodeURIComponent(department).trim();
    const entry = await CourseEntry.findOne({ 
      degreeLevel, 
      department: { $regex: new RegExp(`^${decodedDepartment}$`, 'i') }
    });
    
    const usedCredits = {};
    if (entry) {
      entry.semesters.forEach((sem) => {
        usedCredits[sem.semesterNumber] = sumCredits(sem.courses);
      });
    }

    const degreeInfo = DEGREE_CONFIG[degreeLevel];
    for (let i = 1; i <= degreeInfo.maxSemesters; i++) {
      if (!usedCredits[i]) usedCredits[i] = 0;
    }

    res.json({ 
      limits: degreeInfo.semesterLimits, 
      used: usedCredits,
      maxSemester: degreeInfo.maxSemesters
    });
  } catch (err) {
    console.error('getSemesterCredits error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.getAllCourseEntries = async (req, res) => {
  try {
    const entries = await CourseEntry.find({}).lean();
    
    const result = {};
    
    entries.forEach(entry => {
      const department = entry.department;
      
      if (!result[department]) {
        result[department] = {
          department: department,
          degreeLevels: {}
        };
      }
      
      // Sort semesters and add to result
      entry.semesters = entry.semesters.sort((a, b) => a.semesterNumber - b.semesterNumber);
      result[department].degreeLevels[entry.degreeLevel] = entry;
    });
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (err) {
    console.error('getAllCourseEntries error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: err.message 
    });
  }
};
exports.getCourseEntries = async (req, res) => {
  try {
    const { degreeLevel, department } = req.query;
    
    if (!degreeLevel || !department) {
      return res.status(400).json({ 
        message: 'Degree level and department are required' 
      });
    }

    const dept = await Department.findOne({
      departmentName: { $regex: new RegExp(`^${department.trim()}$`, 'i') },
      degreeLevel
    });

    if (!dept) {
      return res.status(404).json({ 
        message: 'Department not found for the specified degree level'
      });
    }

    const entry = await CourseEntry.findOne({ 
      degreeLevel, 
      department: { $regex: new RegExp(`^${department.trim()}$`, 'i') }
    }).lean();

    if (!entry) {
      return res.status(404).json({ 
        message: 'No course entries found',
        department: department.trim(),
        departmentCode: dept.departmentCode
      });
    }

    entry.semesters = entry.semesters.sort((a, b) => a.semesterNumber - b.semesterNumber);
    
    entry.departmentCode = dept.departmentCode;
    
    res.json(entry);
  } catch (err) {
    console.error('getCourseEntries error:', err);
    res.status(500).json({ 
      message: 'Internal server error',
      error: err.message 
    });
  }
};

exports.getAllSemesterCourseCounts = async (req, res) => {
  try {
    const courseEntries = await CourseEntry.find({}).lean();
    
    const result = {};
    
    courseEntries.forEach(entry => {
      const key = `${entry.degreeLevel}_${entry.department}`;
      
      if (!result[key]) {
        result[key] = {
          degreeLevel: entry.degreeLevel,
          department: entry.department,
          semesterCounts: {},
          totalCourses: 0
        };
      }
      
      entry.semesters.forEach(semester => {
        const courseCount = semester.courses.length;
        result[key].semesterCounts[semester.semesterNumber] = 
          (result[key].semesterCounts[semester.semesterNumber] || 0) + courseCount;
        result[key].totalCourses += courseCount;
      });
    });
    
    const data = Object.values(result);
    
    res.json({
      success: true,
      data: data
    });
    
  } catch (err) {
    console.error('getAllSemesterCourseCounts error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};
exports.getCoursesForFeeAssignment = async (req, res) => {
  try {
    const { degreeLevel, department, semester } = req.query;
    
    if (!degreeLevel || !department || !semester) {
      return res.status(400).json({ 
        success: false,
        message: 'Degree level, department and semester are required' 
      });
    }

    const decodedDepartment = decodeURIComponent(department).trim();
    const semesterNumber = parseInt(semester);

    console.log('Searching for courses:', { 
      degreeLevel, 
      department: decodedDepartment, 
      semesterNumber 
    });

    // Improved department search - more flexible matching
    const entry = await CourseEntry.findOne({
      degreeLevel,
      department: { 
        $regex: new RegExp(`^${decodedDepartment.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') 
      }
    });

    if (!entry) {
      console.log('No entry found. Available entries:');
      const allEntries = await CourseEntry.find({ degreeLevel });
      allEntries.forEach(e => console.log(`- ${e.department}`));
      
      return res.status(404).json({
        success: false,
        message: `Course structure not found for ${degreeLevel} - ${decodedDepartment}. Available: ${allEntries.map(e => e.department).join(', ')}`
      });
    }

    console.log(`Found entry for department: "${entry.department}"`);

    const semesterData = entry.semesters.find(s => s.semesterNumber === semesterNumber);
    
    if (!semesterData || !semesterData.courses.length) {
      return res.status(404).json({
        success: false,
        message: `No courses found for semester ${semesterNumber} in ${entry.department}`
      });
    }

    console.log(`Found ${semesterData.courses.length} courses for semester ${semesterNumber}`);

    const calculateSuggestedFee = (creditHrs, type) => {
      const baseRate = type === 'Lab' ? 2500 : 2000;
      return creditHrs * baseRate;
    };

    const coursesWithFees = semesterData.courses.map(course => ({
      courseName: course.courseName,
      courseCode: course.courseCode,
      creditHrs: course.creditHrs,
      type: course.type,
      suggestedFee: calculateSuggestedFee(course.creditHrs, course.type)
    }));

    res.json({
      success: true,
      data: coursesWithFees
    });
  } catch (err) {
    console.error('getCoursesForFeeAssignment error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: err.message 
    });
  }
};