module.exports = {
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