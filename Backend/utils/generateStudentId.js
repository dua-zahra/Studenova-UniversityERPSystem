// const Student = require('../models/Student');

// module.exports = async (batch) => {
//   if (!batch?.departmentCode || !batch?.semesterStart || !batch?.enrollmentYear) {
//     throw new Error('Invalid batch data for ID generation');
//   }

//   // Extract components
//   const deptCode = batch.departmentCode.toUpperCase();
//   const semesterChar = batch.semesterStart === 'spring' ? 'S' : 'F';
//   const yearShort = String(batch.enrollmentYear).slice(-2);

//   // Find last sequence number
//   const lastStudent = await Student.findOne({ batch: batch._id })
//     .sort({ studentId: -1 })
//     .select('studentId')
//     .lean();

//   let sequence = 1;
//   if (lastStudent?.studentId) {
//     const lastSeq = parseInt(lastStudent.studentId.split('-')[2]);
//     if (!isNaN(lastSeq)) sequence = lastSeq + 1;
//   }

//   // Format: DEPT-SYNN-SSS (e.g. BSCS-F25-001)
//   return `${deptCode}-${semesterChar}${yearShort}-${sequence.toString().padStart(3, '0')}`;
// };