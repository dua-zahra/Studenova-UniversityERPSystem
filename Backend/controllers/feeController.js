const mongoose = require('mongoose');
const StudentFee = require('../models/StudentFee');
const Student = require('../models/Student');
const Batch = require('../models/Batch');
const CourseEntry = require('../models/CourseEntry');
const AssignedCourseFee = require('../models/AssignedCourseFee');
const FeeStructure = require('../models/FeeStructure');
const { addDays, isAfter, isBefore, format } = require('date-fns');

const calculateSuggestedFee = (creditHrs, type) => {
  const baseRate = type === 'Lab' ? 2500 : 2000;
  return creditHrs * baseRate;
};

const calculateInstallmentStatus = (installment, currentDate) => {
  const dueDate = new Date(installment.dueDate);
  const daysOverdue = Math.max(0, Math.floor((currentDate - dueDate) / (1000 * 60 * 60 * 24)));
  
  let status = 'pending';
  let fineAmount = 0;
  let requiresReadmission = false;
  const readmissionFee = 30000;
  const maxDailyFine = 100;
  const maxFineDays = 7;
  const maxFineAmount = maxDailyFine * maxFineDays; 

  if (daysOverdue > 0) {
    if (daysOverdue <= maxFineDays) {
      fineAmount = Math.min(daysOverdue * maxDailyFine, maxFineAmount);
      status = 'fine_applied';
    } else {
      fineAmount = readmissionFee;
      status = 'readmission_required';
      requiresReadmission = true;
    }
  }

  return {
    status,
    fineAmount,
    daysOverdue,
    requiresReadmission,
    readmissionFee: requiresReadmission ? readmissionFee : 0
  };
};

exports.getExistingFeeStructure = async (req, res) => {
  try {
    const { degreeLevel, department, batch } = req.query;
    
    if (!degreeLevel || !department) {
      return res.status(400).json({
        success: false,
        message: 'Degree level and department are required'
      });
    }

    const query = {
      degreeLevel,
      department: { $regex: new RegExp(`^${department}$`, 'i') },
      isActive: true
    };

    if (batch) {
      query.batch = batch;
    }

    const feeStructure = await FeeStructure.findOne(query).sort({ createdAt: -1 });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'No fee structure found for this department and batch'
      });
    }

    res.json({
      success: true,
      data: feeStructure
    });
  } catch (err) {
    console.error('Error fetching existing fee structure:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee structure'
    });
  }
};

exports.getCoursesForFeeAssignment = async (req, res) => {
  try {
    const { degreeLevel, department, semester } = req.query;
    
    if (!degreeLevel || !department || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Degree level, department, and semester are required'
      });
    }

    const courseEntry = await CourseEntry.findOne({
      degreeLevel,
      department: { $regex: new RegExp(`^${department}$`, 'i') }
    });

    if (!courseEntry) {
      return res.status(404).json({
        success: false,
        message: 'Course structure not found for this department'
      });
    }

    const semesterCourses = courseEntry.semesters.find(
      s => s.semesterNumber === parseInt(semester)
    );

    if (!semesterCourses) {
      return res.status(404).json({
        success: false,
        message: 'No courses found for this semester'
      });
    }

    res.json({
      success: true,
      data: semesterCourses.courses.map(course => ({
        courseCode: course.courseCode,
        courseName: course.courseName,
        creditHrs: course.creditHrs,
        type: course.type,
        suggestedFee: calculateSuggestedFee(course.creditHrs, course.type)
      }))
    });
  } catch (err) {
    console.error('Error fetching courses for fee assignment:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.getAssignedCourseFees = async (req, res) => {
  try {
    const { degreeLevel, department } = req.query;
    
    if (!degreeLevel || !department) {
      return res.status(400).json({
        success: false,
        message: 'Degree level and department are required'
      });
    }
    
    const assignedFees = await AssignedCourseFee.findOne({
      degreeLevel, 
      department: { $regex: new RegExp(`^${department}$`, 'i') }
    });
    
    const formattedFees = {};
    if (assignedFees && assignedFees.semesters) {
      assignedFees.semesters.forEach(semesterData => {
        formattedFees[semesterData.semester] = {};
        semesterData.courses.forEach(course => {
          formattedFees[semesterData.semester][course.courseCode] = course.feeAmount;
        });
      });
    }
    
    res.json({
      success: true,
      data: formattedFees
    });
  } catch (error) {
    console.error('Error fetching assigned course fees:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

exports.saveCourseFees = async (req, res) => {
  try {
    const { degreeLevel, department, semester, courseFees } = req.body;
    
    if (!degreeLevel || !department || !semester || !courseFees) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: degreeLevel, department, semester, courseFees'
      });
    }
    
    if (!Array.isArray(courseFees)) {
      return res.status(400).json({
        success: false,
        message: 'courseFees must be an array'
      });
    }
    
    const validCourseFees = courseFees.filter(course => 
      course.courseCode && course.courseName && course.feeAmount > 0
    ).map(course => ({
      courseCode: course.courseCode,
      courseName: course.courseName,
      feeAmount: course.feeAmount,
      creditHrs: course.creditHrs || 0,
      type: course.type || 'Core'
    }));
    
    if (validCourseFees.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid course fees to save'
      });
    }
    
    let assignedFee = await AssignedCourseFee.findOne({
      degreeLevel, 
      department: department.trim()
    });
    
    if (!assignedFee) {
      assignedFee = new AssignedCourseFee({
        degreeLevel,
        department: department.trim(),
        semesters: [{
          semester: parseInt(semester),
          courses: validCourseFees
        }]
      });
    } else {
      const semesterIndex = assignedFee.semesters.findIndex(
        s => s.semester === parseInt(semester)
      );
      
      if (semesterIndex > -1) {
        assignedFee.semesters[semesterIndex].courses = validCourseFees;
      } else {
        assignedFee.semesters.push({
          semester: parseInt(semester),
          courses: validCourseFees
        });
      }
      
      assignedFee.semesters.sort((a, b) => a.semester - b.semester);
    }
    
    await assignedFee.save();
    
    res.json({ 
      success: true, 
      message: `Course fees for semester ${semester} saved successfully!`,
      data: assignedFee 
    });
    
  } catch (error) {
    console.error('Error saving course fees:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

exports.getFeeStructureByBatch = async (req, res) => {
  try {
    const { degreeLevel, department, batch } = req.query;
    
    if (!degreeLevel || !department || !batch) {
      return res.status(400).json({
        success: false,
        message: 'Degree level, department, and batch are required'
      });
    }

    const feeStructure = await FeeStructure.findOne({
      degreeLevel,
      department: { $regex: new RegExp(`^${department}$`, 'i') },
      batch,
      isActive: true
    });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'No fee structure found for this batch'
      });
    }

    res.json({
      success: true,
      data: feeStructure
    });
  } catch (err) {
    console.error('Error fetching fee structure by batch:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee structure'
    });
  }
};

exports.getFeeStructure = async (req, res) => {
  try {
    const { degreeLevel, department, batch } = req.query;
    
    if (!degreeLevel || !department || !batch) {
      return res.status(400).json({
        success: false,
        message: 'Degree level, department, and batch are required'
      });
    }

    const feeStructure = await FeeStructure.findOne({
      degreeLevel,
      department: { $regex: new RegExp(`^${department}$`, 'i') },
      batch,
      isActive: true
    });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'No fee structure found for this batch'
      });
    }

    res.json({
      success: true,
      data: feeStructure
    });
  } catch (err) {
    console.error('Error fetching fee structure:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee structure'
    });
  }
};


const autoGenerateStudentFees = async (feeStructure) => {
  try {
    console.log(' Starting autoGenerateStudentFees for:', {
      degreeLevel: feeStructure.degreeLevel,
      department: feeStructure.department,
      batch: feeStructure.batch,
      feeStructureVersion: feeStructure.updatedAt
    });

    const batchInfo = await Batch.findOne({ 
      batchName: feeStructure.batch 
    });

    if (!batchInfo) {
      throw new Error(`Batch not found: ${feeStructure.batch}`);
    }

    console.log(' Found batch:', batchInfo.batchName, 'ID:', batchInfo._id);

    let students = [];
    
    if (batchInfo.sections && batchInfo.sections.length > 0) {
      batchInfo.sections.forEach(section => {
        if (section.students && section.students.length > 0) {
          section.students.forEach(studentData => {
            students.push({
              studentId: studentData.studentId,
              firstName: studentData.firstName,
              lastName: studentData.lastName,
              degreeLevel: batchInfo.degreeLevel,
              department: batchInfo.departmentName,
              batch: batchInfo._id,
              currentSemester: batchInfo.currentSemester,
              scholarshipPercentage: studentData.scholarshipPercentage || 0,
              status: studentData.status,
              universityEmail: studentData.universityEmail,
              contact: studentData.contact,
              enrollmentDate: studentData.enrollmentDate
            });
          });
        }
      });
    }

    console.log(` Extracted ${students.length} students from batch sections`);

    if (students.length === 0) {
      console.log(' No students found in batch sections, fetching from Student collection...');
      
      const studentsFromDB = await Student.find({
        batch: batchInfo._id,
        status: 'active'
      }).select('studentId firstName lastName degreeLevel department batch currentSemester scholarshipPercentage universityEmail contact enrollmentDate status');
      
      students = studentsFromDB.map(student => ({
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        degreeLevel: student.degreeLevel,
        department: student.department,
        batch: student.batch,
        currentSemester: student.currentSemester,
        scholarshipPercentage: student.scholarshipPercentage || 0,
        status: student.status,
        universityEmail: student.universityEmail,
        contact: student.contact,
        enrollmentDate: student.enrollmentDate
      }));
      
      console.log(` Fetched ${students.length} students from Student collection`);
    }

    if (students.length === 0) {
      console.warn(' No students found for fee generation');
      return {
        total: 0,
        created: 0,
        updated: 0,
        errors: 0,
        details: [{
          status: 'warning',
          message: 'No students found for fee generation'
        }]
      };
    }

    const results = {
      total: students.length,
      created: 0,
      updated: 0,
      errors: 0,
      details: []
    };

    for (const student of students) {
      try {
        console.log(` Processing student: ${student.studentId}`);
        
        const freshStudent = await Student.findOne({ studentId: student.studentId });
        const scholarshipPercentage = freshStudent ? (freshStudent.scholarshipPercentage || 0) : (student.scholarshipPercentage || 0);
        
        console.log(`🎓 Student ${student.studentId} scholarship: ${scholarshipPercentage}% (from ${freshStudent ? 'fresh fetch' : 'batch data'})`);

        let studentFee = await StudentFee.findOne({
          studentId: student.studentId
        });

        const currentSemesterFees = studentFee ? [...studentFee.semesterFees] : [];
        const updatedSemesterFees = [];
        
        for (const semesterData of feeStructure.semesterBreakdown) {
          console.log(` Processing semester ${semesterData.semester} for student ${student.studentId}`);
          
          const existingSemesterFee = currentSemesterFees.find(sf => sf.semester === semesterData.semester);
          
          let semesterBaseFee = 0;
          let semesterFeeConfig = feeStructure.masterBaseFee;
          
          if (feeStructure.semesterBaseFees && feeStructure.semesterBaseFees.get(semesterData.semester.toString())) {
            semesterFeeConfig = feeStructure.semesterBaseFees.get(semesterData.semester.toString());
            semesterBaseFee = semesterFeeConfig.totalBaseFee;
            console.log(` Using CUSTOM fees for semester ${semesterData.semester}: Rs. ${semesterBaseFee}`);
          } else {
            semesterBaseFee = feeStructure.masterBaseFee.totalBaseFee;
            console.log(` Using MASTER fees for semester ${semesterData.semester}: Rs. ${semesterBaseFee}`);
          }

          const originalCourseFee = semesterData.courseFee;
          const originalSemesterTotal = semesterBaseFee + originalCourseFee;

          let scholarshipDiscount = 0;
          let totalDiscountedFee = originalSemesterTotal;
          let discountedBaseFee = semesterBaseFee;
          let discountedCourseFee = originalCourseFee;
          let tuitionPortion = semesterFeeConfig.tuitionFee;
          
          if (scholarshipPercentage > 0) {
            scholarshipDiscount = Math.round(originalSemesterTotal * (scholarshipPercentage / 100));
            
            discountedBaseFee = Math.round(semesterBaseFee * (1 - scholarshipPercentage / 100));
            discountedCourseFee = Math.round(originalCourseFee * (1 - scholarshipPercentage / 100));
            totalDiscountedFee = discountedBaseFee + discountedCourseFee;
            
            tuitionPortion = Math.round(semesterFeeConfig.tuitionFee * (1 - scholarshipPercentage / 100));
            
            console.log(` APPLYING ${scholarshipPercentage}% SCHOLARSHIP to semester ${semesterData.semester}:`, {
              originalTotal: originalSemesterTotal,
              scholarshipDiscount,
              discountedTotal: totalDiscountedFee,
              discountApplied: `Rs. ${scholarshipDiscount}`
            });
          } else {
            console.log(`No scholarship applied for semester ${semesterData.semester} (0% scholarship)`);
          }

          const miscellaneousPortion = semesterFeeConfig.miscellaneousFee; 
          const fixedFees = semesterFeeConfig.examFee + 
                           semesterFeeConfig.libraryFee + 
                           semesterFeeConfig.labFee;

          const academicSemester = batchInfo.academicCalendar?.find(s => s.semester === semesterData.semester);
          
          let installments = [];
          if (academicSemester && academicSemester.midtermStart && academicSemester.finalStart) {
            const firstInstallmentDueDate = addDays(new Date(academicSemester.midtermStart), -21);
            const secondInstallmentDueDate = addDays(new Date(academicSemester.finalStart), -28);

            const installmentAmount = Math.round(totalDiscountedFee / 2);

            installments = [
              {
                installmentNumber: 1,
                amount: installmentAmount,
                amountPaid: 0,
                dueDate: firstInstallmentDueDate,
                status: 'pending',
                fineAmount: 0,
                daysOverdue: 0,
                finePaid: false,
                readmissionFee: 0,
                readmissionFeePaid: false,
                invoiceNumber: null,
                invoiceGenerated: false,
                invoiceStatus: 'not_generated'
              },
              {
                installmentNumber: 2,
                amount: installmentAmount,
                amountPaid: 0,
                dueDate: secondInstallmentDueDate,
                status: 'pending',
                fineAmount: 0,
                daysOverdue: 0,
                finePaid: false,
                readmissionFee: 0,
                readmissionFeePaid: false,
                invoiceNumber: null,
                invoiceGenerated: false,
                invoiceStatus: 'not_generated'
              }
            ];
          }

          if (existingSemesterFee && existingSemesterFee.feeStructureVersion) {
            const semesterConfigChanged = feeStructure.semesterBaseFees && 
                                        feeStructure.semesterBaseFees.get(semesterData.semester.toString()) &&
                                        existingSemesterFee.feeStructureVersion.getTime() < feeStructure.updatedAt.getTime();
            
            if (!semesterConfigChanged) {
              console.log(`📝 Preserving existing installments for semester ${semesterData.semester}`);
              installments = existingSemesterFee.installments;
            }
          }

          const isCustomFee = feeStructure.semesterBaseFees && 
                            feeStructure.semesterBaseFees.get(semesterData.semester.toString());

          updatedSemesterFees.push({
            semester: semesterData.semester,
            originalBaseFee: semesterBaseFee,
            originalCourseFee: originalCourseFee,
            originalTotalFee: originalSemesterTotal,
            tuitionFee: tuitionPortion,
            courseFees: discountedCourseFee,
            fixedFees: fixedFees,
            totalFee: totalDiscountedFee,
            scholarshipDiscount: scholarshipDiscount,
            discountedFee: totalDiscountedFee,
            totalFineAmount: 0,
            finePaid: 0,
            fineDue: 0,
            totalReadmissionFee: 0,
            readmissionFeePaid: 0,
            readmissionFeeDue: 0,
            currentPayableAmount: totalDiscountedFee,
            status: 'pending',
            installments: installments,
            isCustomFee: !!isCustomFee,
            feeStructureVersion: feeStructure.updatedAt
          });
        }

        console.log(` Generated ${updatedSemesterFees.length} semester fees for student ${student.studentId}`);

        const totalDegreeFee = updatedSemesterFees.reduce((sum, sf) => sum + sf.originalTotalFee, 0);
        const totalScholarshipDiscount = updatedSemesterFees.reduce((sum, sf) => sum + sf.scholarshipDiscount, 0);
        
        let totalPaid = 0;
        let totalFinePaid = 0;
        let totalReadmissionFeePaid = 0;
        
        if (studentFee) {
          totalPaid = studentFee.totalPaid || 0;
          totalFinePaid = studentFee.totalFinePaid || 0;
          totalReadmissionFeePaid = studentFee.totalReadmissionFeePaid || 0;
        }
        
        const totalDue = Math.max(0, totalDegreeFee - totalPaid);
        
        const totalFineAmount = 0;
        const totalReadmissionFee = 0;
        const totalFineDue = totalFineAmount - totalFinePaid;
        const totalReadmissionFeeDue = totalReadmissionFee - totalReadmissionFeePaid;
        
        const totalPayableAmount = totalDegreeFee + totalFineAmount + totalReadmissionFee;
        const totalAmountPaid = totalPaid + totalFinePaid + totalReadmissionFeePaid;
        const totalAmountDue = totalDue + totalFineDue + totalReadmissionFeeDue;

        console.log(` FINAL TOTALS for student ${student.studentId}:`, {
          totalDegreeFee,
          totalScholarshipDiscount,
          netPayable: totalDegreeFee - totalScholarshipDiscount,
          scholarshipPercentage: `${scholarshipPercentage}%`,
          totalPaid,
          totalDue
        });

        if (studentFee) {
          studentFee.semesterFees = updatedSemesterFees;
          studentFee.totalDegreeFee = totalDegreeFee;
          studentFee.totalPaid = totalPaid;
          studentFee.totalDue = totalDue;
          
          studentFee.totalFineAmount = totalFineAmount;
          studentFee.totalFinePaid = totalFinePaid;
          studentFee.totalFineDue = totalFineDue;
          studentFee.totalReadmissionFee = totalReadmissionFee;
          studentFee.totalReadmissionFeePaid = totalReadmissionFeePaid;
          studentFee.totalReadmissionFeeDue = totalReadmissionFeeDue;
          studentFee.totalPayableAmount = totalPayableAmount;
          studentFee.totalAmountPaid = totalAmountPaid;
          studentFee.totalAmountDue = totalAmountDue;
          
          studentFee.scholarshipPercentage = scholarshipPercentage; 
          studentFee.currentSemester = student.currentSemester;
          studentFee.status = 'active';
          studentFee.feeStructureVersion = feeStructure.updatedAt;
          
          if (!studentFee.invoices) {
            studentFee.invoices = [];
          }
          
          await studentFee.save();
          results.updated++;
          results.details.push({
            studentId: student.studentId,
            status: 'updated',
            message: `Fee record updated with ${scholarshipPercentage}% scholarship (Total: Rs. ${totalDegreeFee}, Discount: Rs. ${totalScholarshipDiscount})`
          });
          console.log(` UPDATED fee record for student ${student.studentId} with ${scholarshipPercentage}% scholarship`);
        } else {
          studentFee = new StudentFee({
            studentId: student.studentId,
            degreeLevel: student.degreeLevel,
            department: student.department,
            batch: feeStructure.batch,
            currentSemester: student.currentSemester,
            scholarshipPercentage: scholarshipPercentage, 
            semesterFees: updatedSemesterFees,
            invoices: [],
            
            totalDegreeFee: totalDegreeFee,
            totalPaid: 0,
            totalDue: totalDue,
            
            totalFineAmount: 0,
            totalFinePaid: 0,
            totalFineDue: 0,
            totalReadmissionFee: 0,
            totalReadmissionFeePaid: 0,
            totalReadmissionFeeDue: 0,
            
            totalPayableAmount: totalPayableAmount,
            totalAmountPaid: 0,
            totalAmountDue: totalAmountDue,
            
            status: 'active',
            feeStructureVersion: feeStructure.updatedAt
          });

          await studentFee.save();
          results.created++;
          results.details.push({
            studentId: student.studentId,
            status: 'created',
            message: `Fee record created with ${scholarshipPercentage}% scholarship (Total: Rs. ${totalDegreeFee}, Discount: Rs. ${totalScholarshipDiscount})`
          });
          console.log(` CREATED fee record for student ${student.studentId} with ${scholarshipPercentage}% scholarship`);
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          studentId: student.studentId,
          status: 'error',
          message: error.message
        });
        console.error(` Error generating fee for student ${student.studentId}:`, error);
      }
    }

    console.log(' Student fee generation completed:', results);
    return results;
  } catch (error) {
    console.error(' Error in autoGenerateStudentFees:', error);
    throw error;
  }
};

exports.saveFeeStructure = async (req, res) => {
  try {
    const { degreeLevel, department, batch, masterBaseFee, semesterBaseFees } = req.body;
    
    if (!degreeLevel || !department || !batch) {
      return res.status(400).json({
        success: false,
        message: 'Degree level, department, and batch are required'
      });
    }

    if (!masterBaseFee || masterBaseFee.totalBaseFee === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Master base fee configuration is required'
      });
    }

    const batchInfo = await Batch.findOne({ batchName: batch });
    if (!batchInfo) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const assignedCourseFees = await AssignedCourseFee.findOne({
      degreeLevel,
      department: { $regex: new RegExp(`^${department}$`, 'i') }
    });

    const courseEntry = await CourseEntry.findOne({
      degreeLevel,
      department: { $regex: new RegExp(`^${department}$`, 'i') }
    });

    if (!courseEntry) {
      return res.status(404).json({
        success: false,
        message: 'Course structure not found'
      });
    }

    const semesterBreakdown = [];
    let degreeTotal = 0;

    for (let semester = 1; semester <= batchInfo.totalSemesters; semester++) {
      const semesterData = courseEntry.semesters.find(s => s.semesterNumber === semester);
      
      if (semesterData) {
        const credits = semesterData.courses.reduce((sum, course) => sum + course.creditHrs, 0);
        const courseCount = semesterData.courses.length;
        
        let courseFee = 0;
        if (assignedCourseFees) {
          const semesterFees = assignedCourseFees.semesters.find(s => s.semester === semester);
          if (semesterFees) {
            courseFee = semesterFees.courses.reduce((sum, course) => sum + course.feeAmount, 0);
          }
        }

        let baseFee = 0;
        if (semesterBaseFees && semesterBaseFees[semester]) {
          baseFee = semesterBaseFees[semester].totalBaseFee;
        } else {
          baseFee = masterBaseFee.totalBaseFee;
        }

        const semesterTotal = baseFee + courseFee;
        degreeTotal += semesterTotal;

        semesterBreakdown.push({
          semester,
          credits,
          courses: courseCount,
          baseFee: baseFee,
          courseFee: courseFee,
          semesterTotal: semesterTotal
        });
      }
    }

    let existingFeeStructure = await FeeStructure.findOne({
      degreeLevel,
      department: { $regex: new RegExp(`^${department}$`, 'i') },
      batch,
      isActive: true
    });

    let isNew = false;
    
    if (existingFeeStructure) {
      existingFeeStructure.masterBaseFee = {
        tuitionFee: masterBaseFee.tuitionFee || 0,
        miscellaneousFee: masterBaseFee.miscellaneousFee || 0,
        examFee: masterBaseFee.examFee || 0,
        libraryFee: masterBaseFee.libraryFee || 0,
        labFee: masterBaseFee.labFee || 0,
        totalBaseFee: masterBaseFee.totalBaseFee || 0
      };
      
      if (semesterBaseFees) {
        const semesterBaseFeesMap = new Map();
        Object.keys(semesterBaseFees).forEach(semester => {
          const semesterFee = semesterBaseFees[semester];
          semesterBaseFeesMap.set(semester, {
            tuitionFee: semesterFee.tuitionFee || 0,
            miscellaneousFee: semesterFee.miscellaneousFee || 0,
            examFee: semesterFee.examFee || 0,
            libraryFee: semesterFee.libraryFee || 0,
            labFee: semesterFee.labFee || 0,
            totalBaseFee: semesterFee.totalBaseFee || 0
          });
        });
        existingFeeStructure.semesterBaseFees = semesterBaseFeesMap;
      } else {
        existingFeeStructure.semesterBaseFees = new Map();
      }
      
      existingFeeStructure.semesterBreakdown = semesterBreakdown;
      existingFeeStructure.degreeTotal = degreeTotal;
      existingFeeStructure.updatedAt = new Date();

      await existingFeeStructure.save();
    } else {
      const feeStructureData = {
        degreeLevel,
        department,
        batch,
        masterBaseFee: {
          tuitionFee: masterBaseFee.tuitionFee || 0,
          miscellaneousFee: masterBaseFee.miscellaneousFee || 0,
          examFee: masterBaseFee.examFee || 0,
          libraryFee: masterBaseFee.libraryFee || 0,
          labFee: masterBaseFee.labFee || 0,
          totalBaseFee: masterBaseFee.totalBaseFee || 0
        },
        semesterBreakdown,
        degreeTotal,
        isActive: true
      };

      if (semesterBaseFees) {
        const semesterBaseFeesMap = new Map();
        Object.keys(semesterBaseFees).forEach(semester => {
          const semesterFee = semesterBaseFees[semester];
          semesterBaseFeesMap.set(semester, {
            tuitionFee: semesterFee.tuitionFee || 0,
            miscellaneousFee: semesterFee.miscellaneousFee || 0,
            examFee: semesterFee.examFee || 0,
            libraryFee: semesterFee.libraryFee || 0,
            labFee: semesterFee.labFee || 0,
            totalBaseFee: semesterFee.totalBaseFee || 0
          });
        });
        feeStructureData.semesterBaseFees = semesterBaseFeesMap;
      }

      existingFeeStructure = new FeeStructure(feeStructureData);
      await existingFeeStructure.save();
      isNew = true;
    }

    let generationResults = null;
    
    try {
      console.log(' AUTOMATICALLY regenerating student fees with updated fee structure...');
      generationResults = await autoGenerateStudentFees(existingFeeStructure);
      console.log('Student fee AUTOMATIC regeneration completed:', {
        total: generationResults.total,
        updated: generationResults.updated,
        created: generationResults.created,
        errors: generationResults.errors
      });
    } catch (genError) {
      console.error(' Error in AUTOMATIC student fee regeneration:', genError);
      generationResults = {
        total: 0,
        created: 0,
        updated: 0,
        errors: 1,
        details: [{
          status: 'error',
          message: `Automatic student fee regeneration failed: ${genError.message}`
        }]
      };
    }

    let successMessage = `Fee structure ${isNew ? 'created' : 'updated'} successfully`;
    
    if (generationResults) {
      if (generationResults.updated > 0 || generationResults.created > 0) {
        successMessage += ` and ${generationResults.updated + generationResults.created} student fee records were ${isNew ? 'created' : 'updated'}`;
      }
      if (generationResults.errors > 0) {
        successMessage += ` (${generationResults.errors} errors occurred during student fee update)`;
      }
    }

    res.json({
      success: true,
      message: successMessage,
      data: {
        feeStructure: existingFeeStructure,
        studentFeeGeneration: generationResults,
        isNew
      }
    });

  } catch (err) {
    console.error('Error saving fee structure:', err);
    
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A fee structure already exists for this batch. The system will update the existing one.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to save fee structure: ' + err.message
    });
  }
};

exports.calculateStudentFees = async (req, res) => {
  try {
    const { studentId, semester } = req.body;
    
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    const student = await Student.findOne({ studentId });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const feeStructure = await FeeStructure.findOne({
      degreeLevel: student.degreeLevel,
      department: student.department,
      batch: student.batch,
      isActive: true
    });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found for student\'s batch'
      });
    }

    const batch = await Batch.findOne({ batchName: student.batch });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const targetSemester = semester || student.currentSemester;
    const semesterData = feeStructure.semesterBreakdown.find(s => s.semester === targetSemester);
    
    if (!semesterData) {
      return res.status(404).json({
        success: false,
        message: `Fee structure not found for semester ${targetSemester}`
      });
    }

    const scholarshipPercentage = student.scholarshipPercentage || 0;
    
    const semesterFeeConfig = feeStructure.semesterBaseFees && feeStructure.semesterBaseFees.get(targetSemester.toString()) 
      ? feeStructure.semesterBaseFees.get(targetSemester.toString())
      : feeStructure.masterBaseFee;

    const discountedTuitionFee = semesterFeeConfig.tuitionFee * (1 - scholarshipPercentage / 100);
    const discountedCourseFees = semesterData.courseFee * (1 - scholarshipPercentage / 100);
    
    const fixedFees = semesterFeeConfig.examFee + 
                     semesterFeeConfig.libraryFee + 
                     semesterFeeConfig.labFee +
                     semesterFeeConfig.miscellaneousFee;

    const totalFee = discountedTuitionFee + discountedCourseFees + fixedFees;
    const scholarshipDiscount = (semesterFeeConfig.tuitionFee + semesterData.courseFee) * (scholarshipPercentage / 100);

    const academicSemester = batch.academicCalendar.find(s => s.semester === targetSemester);
    if (!academicSemester) {
      return res.status(404).json({
        success: false,
        message: 'Academic calendar not found for this semester'
      });
    }

    const firstInstallmentDueDate = addDays(academicSemester.midtermStart, -21);
    const secondInstallmentDueDate = addDays(academicSemester.finalStart, -28);

    const installments = [
      {
        installmentNumber: 1,
        amount: totalFee / 2,
        amountPaid: 0,
        dueDate: firstInstallmentDueDate,
        status: 'pending',
        fineAmount: 0,
        daysOverdue: 0,
        finePaid: false,
        readmissionFee: 0,
        readmissionFeePaid: false,
        invoiceNumber: null,
        invoiceGenerated: false,
        invoiceStatus: 'not_generated'
      },
      {
        installmentNumber: 2,
        amount: totalFee / 2,
        amountPaid: 0,
        dueDate: secondInstallmentDueDate,
        status: 'pending',
        fineAmount: 0,
        daysOverdue: 0,
        finePaid: false,
        readmissionFee: 0,
        readmissionFeePaid: false,
        invoiceNumber: null,
        invoiceGenerated: false,
        invoiceStatus: 'not_generated'
      }
    ];

    let studentFee = await StudentFee.findOne({ studentId });
    
    if (!studentFee) {
      studentFee = new StudentFee({
        studentId,
        degreeLevel: student.degreeLevel,
        department: student.department,
        batch: student.batch,
        currentSemester: student.currentSemester,
        scholarshipPercentage,
        semesterFees: [],
        invoices: [],
        totalDegreeFee: feeStructure.degreeTotal,
        totalPaid: 0,
        totalDue: totalFee,
        totalFineAmount: 0,
        totalFinePaid: 0,
        totalFineDue: 0,
        totalReadmissionFee: 0,
        totalReadmissionFeePaid: 0,
        totalReadmissionFeeDue: 0,
        totalPayableAmount: totalFee,
        totalAmountPaid: 0,
        totalAmountDue: totalFee,
        status: 'active'
      });
    }

    const existingSemesterIndex = studentFee.semesterFees.findIndex(sf => sf.semester === targetSemester);
    
    const semesterFeeData = {
      semester: targetSemester,
      originalBaseFee: semesterFeeConfig.totalBaseFee,
      originalCourseFee: semesterData.courseFee,
      originalTotalFee: semesterFeeConfig.totalBaseFee + semesterData.courseFee,
      tuitionFee: discountedTuitionFee,
      courseFees: discountedCourseFees,
      fixedFees: fixedFees,
      totalFee: totalFee,
      scholarshipDiscount: scholarshipDiscount,
      discountedFee: totalFee,
      totalFineAmount: 0,
      finePaid: 0,
      fineDue: 0,
      totalReadmissionFee: 0,
      readmissionFeePaid: 0,
      readmissionFeeDue: 0,
      currentPayableAmount: totalFee,
      status: 'pending',
      installments: installments,
      isCustomFee: false
    };

    if (existingSemesterIndex > -1) {
      studentFee.semesterFees[existingSemesterIndex] = semesterFeeData;
    } else {
      studentFee.semesterFees.push(semesterFeeData);
    }

    await studentFee.save();

    res.json({
      success: true,
      data: {
        studentFee,
        semesterBreakdown: semesterData,
        baseFeeConfiguration: semesterFeeConfig,
        installments
      }
    });
  } catch (err) {
    console.error('Error calculating student fees:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate student fees'
    });
  }
};

exports.updateInstallmentStatus = async (req, res) => {
  try {
    const { studentId, semester, installmentNumber, paymentAmount } = req.body;
    
    if (!studentId || !semester || !installmentNumber || !paymentAmount) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, semester, installment number, and payment amount are required'
      });
    }

    const studentFee = await StudentFee.findOne({ studentId });
    if (!studentFee) {
      return res.status(404).json({
        success: false,
        message: 'Student fee record not found'
      });
    }

    const semesterFee = studentFee.semesterFees.find(sf => sf.semester === parseInt(semester));
    if (!semesterFee) {
      return res.status(404).json({
        success: false,
        message: 'Semester fee record not found'
      });
    }

    const installment = semesterFee.installments.find(inst => inst.installmentNumber === parseInt(installmentNumber));
    if (!installment) {
      return res.status(404).json({
        success: false,
        message: 'Installment not found'
      });
    }

    const now = new Date();
    
    const { status, fineAmount, daysOverdue, requiresReadmission, readmissionFee } = 
      calculateInstallmentStatus(installment, now);

    let totalAmountDue = installment.amount;
    
    if (requiresReadmission) {
      totalAmountDue += readmissionFee;
    } else if (fineAmount > 0) {
      totalAmountDue += fineAmount;
    }

    if (paymentAmount < totalAmountDue) {
      return res.status(400).json({
        success: false,
        message: `Payment amount insufficient. Required: Rs. ${totalAmountDue} (Installment: Rs. ${installment.amount} + ${requiresReadmission ? 'Readmission: Rs. ' + readmissionFee : 'Fine: Rs. ' + fineAmount})`
      });
    }

    installment.paidDate = now;
    installment.status = status;
    installment.fineAmount = fineAmount;
    installment.daysOverdue = daysOverdue;
    installment.amountPaid = paymentAmount;
    
    if (requiresReadmission) {
      installment.readmissionFee = readmissionFee;
      installment.readmissionFeePaid = true;
    } else {
      installment.readmissionFee = 0;
      installment.readmissionFeePaid = false;
    }
    
    if (fineAmount > 0) {
      installment.finePaid = true;
    } else {
      installment.finePaid = false;
    }

    await studentFee.save();

    res.json({
      success: true,
      message: `Installment ${installmentNumber} for semester ${semester} updated successfully`,
      data: {
        studentFee,
        installment,
        fineApplied: fineAmount > 0,
        fineAmount,
        requiresReadmission,
        readmissionFee: requiresReadmission ? readmissionFee : 0,
        daysOverdue,
        totalAmountPaid: paymentAmount
      }
    });
  } catch (err) {
    console.error('Error updating installment:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update installment: ' + err.message
    });
  }
};

exports.getStudentFeeDetails = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const studentFee = await StudentFee.findOne({ studentId })
      .populate('studentId', 'firstName lastName universityEmail currentSemester');
    
    if (!studentFee) {
      return res.status(404).json({
        success: false,
        message: 'Student fee record not found'
      });
    }

    res.json({
      success: true,
      data: studentFee
    });
  } catch (err) {
    console.error('Error fetching student fee details:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student fee details'
    });
  }
};

exports.getStudentFeeStructure = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const feeStructure = await FeeStructure.findOne({
      degreeLevel: student.degreeLevel,
      department: student.department,
      batch: student.batch,
      isActive: true
    });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found for your batch'
      });
    }

    const scholarshipPercentage = student.scholarshipPercentage || 0;
    
    const semesterBreakdownWithScholarship = feeStructure.semesterBreakdown.map(semester => {
      const semesterFeeConfig = feeStructure.semesterBaseFees && feeStructure.semesterBaseFees.get(semester.semester.toString()) 
        ? feeStructure.semesterBaseFees.get(semester.semester.toString())
        : feeStructure.masterBaseFee;

      const discountedBaseFee = semesterFeeConfig.totalBaseFee * (1 - scholarshipPercentage / 100);
      const discountedCourseFee = semester.courseFee * (1 - scholarshipPercentage / 100);
      const semesterTotal = discountedBaseFee + discountedCourseFee;
      
      return {
        ...semester.toObject(),
        baseFee: Math.round(discountedBaseFee),
        courseFee: Math.round(discountedCourseFee),
        semesterTotal: Math.round(semesterTotal),
        scholarshipDiscount: Math.round((semesterFeeConfig.totalBaseFee + semester.courseFee) * (scholarshipPercentage / 100))
      };
    });

    const totalDegreeFee = semesterBreakdownWithScholarship.reduce((sum, semester) => sum + semester.semesterTotal, 0);
    const totalScholarshipDiscount = semesterBreakdownWithScholarship.reduce((sum, semester) => sum + semester.scholarshipDiscount, 0);

    res.json({
      success: true,
      data: {
        student: {
          studentId: student.studentId,
          firstName: student.firstName,
          lastName: student.lastName,
          degreeLevel: student.degreeLevel,
          department: student.department,
          batch: student.batch,
          currentSemester: student.currentSemester,
          scholarshipPercentage: student.scholarshipPercentage
        },
        feeStructure: {
          ...feeStructure.toObject(),
          semesterBreakdown: semesterBreakdownWithScholarship,
          degreeTotal: totalDegreeFee,
          totalScholarshipDiscount
        }
      }
    });
  } catch (err) {
    console.error('Error fetching student fee structure:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee structure'
    });
  }
};

exports.getCurrentSemesterFees = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    let studentFee = await StudentFee.findOne({ studentId })
      .populate('studentId', 'firstName lastName currentSemester scholarshipPercentage');

    if (!studentFee) {
      const student = await Student.findOne({ studentId });
      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found'
        });
      }

      const feeStructure = await FeeStructure.findOne({
        degreeLevel: student.degreeLevel,
        department: student.department,
        batch: student.batch,
        isActive: true
      });

      if (!feeStructure) {
        return res.status(404).json({
          success: false,
          message: 'Fee structure not found for student\'s batch'
        });
      }

      // Calculate fees for current semester
      const mockReq = { body: { studentId, semester: student.currentSemester } };
      const mockRes = {
        json: (data) => data,
        status: (code) => ({ json: (data) => data })
      };

      return await this.calculateStudentFees(mockReq, mockRes);
    }

    const student = studentFee.studentId;
    const currentSemesterFee = studentFee.semesterFees.find(sf => sf.semester === student.currentSemester);

    if (!currentSemesterFee) {
      return res.status(404).json({
        success: false,
        message: `Fee record not found for semester ${student.currentSemester}`
      });
    }

    res.json({
      success: true,
      data: {
        student: {
          studentId: student.studentId,
          name: `${student.firstName} ${student.lastName}`,
          currentSemester: student.currentSemester,
          scholarshipPercentage: student.scholarshipPercentage
        },
        currentSemester: currentSemesterFee,
        overallSummary: {
          totalDegreeFee: studentFee.totalDegreeFee,
          totalPaid: studentFee.totalPaid,
          totalDue: studentFee.totalDue,
          totalFineAmount: studentFee.totalFineAmount,
          totalReadmissionFee: studentFee.totalReadmissionFee,
          totalPayableAmount: studentFee.totalPayableAmount,
          totalAmountDue: studentFee.totalAmountDue,
          status: studentFee.status
        }
      }
    });
  } catch (err) {
    console.error('Error fetching current semester fees:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current semester fees'
    });
  }
};

exports.getStudentsForBatchFee = async (req, res) => {
  try {
    const { degreeLevel, department, batch } = req.query;
    
    if (!degreeLevel || !department || !batch) {
      return res.status(400).json({
        success: false,
        message: 'Degree level, department, and batch are required'
      });
    }

    console.log(`📊 Fetching students for batch: ${batch}, department: ${department}, degree: ${degreeLevel}`);

    const batchInfo = await Batch.findOne({ 
      batchName: batch,
      degreeLevel: degreeLevel.toLowerCase(),
      departmentName: { $regex: new RegExp(`^${department}$`, 'i') }
    });

    if (!batchInfo) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const students = await Student.find({
      batch: batchInfo._id,
      status: 'active'
    }).select('studentId firstName lastName currentSemester scholarshipPercentage degreeLevel department batch');

    console.log(` Found ${students.length} active students in batch`);

    const studentIds = students.map(s => s.studentId);
    
    const studentFees = await StudentFee.find({
      studentId: { $in: studentIds }
    });

    console.log(` Found ${studentFees.length} student fee records`);

    const studentsWithFees = students.map(student => {
      const feeRecord = studentFees.find(sf => sf.studentId === student.studentId);
      
      if (feeRecord) {
        const totalDegreeFee = feeRecord.totalDegreeFee || 0;
        const totalAmountPaid = feeRecord.totalAmountPaid || 0;
        const totalAmountDue = feeRecord.totalAmountDue || 0;
        const totalFineDue = feeRecord.totalFineDue || 0;
        const totalReadmissionFeeDue = feeRecord.totalReadmissionFeeDue || 0;
        
        const currentSemester = student.currentSemester || 1;
        let currentSemesterTotal = 0;
        let currentPayableAmount = 0;
        let totalPayableAmount = 0;
        let totalScholarshipDiscount = 0;

        if (feeRecord.semesterFees && Array.isArray(feeRecord.semesterFees)) {
          const currentSemesterFee = feeRecord.semesterFees.find(
            sf => sf.semester === currentSemester
          );
          
          if (currentSemesterFee) {
            currentSemesterTotal = currentSemesterFee.originalTotalFee || 0;
            currentPayableAmount = currentSemesterFee.currentPayableAmount || currentSemesterFee.totalFee || 0;
          }

          // Calculate total payable amount (with scholarship) and scholarship discount
          totalPayableAmount = feeRecord.semesterFees.reduce((sum, sf) => 
            sum + (sf.totalFee || 0), 0
          );

          totalScholarshipDiscount = feeRecord.semesterFees.reduce((sum, sf) => 
            sum + (sf.scholarshipDiscount || 0), 0
          );
        }

        const finalTotalPayableAmount = feeRecord.totalPayableAmount || totalPayableAmount || (totalDegreeFee - totalScholarshipDiscount);

        const totalInvoices = feeRecord.invoices?.length || 0;
        const pendingInvoices = feeRecord.invoices?.filter(inv => 
          inv.paymentStatus === 'pending' && inv.isActive !== false
        ).length || 0;

        return {
          ...student.toObject(),
          feeRecord: {
            hasFeeRecord: true,
            totalDegreeFee, 
            totalAmountPaid,
            totalAmountDue,
            totalPayableAmount: finalTotalPayableAmount,
            totalScholarshipDiscount,
            currentSemesterTotal,
            currentPayableAmount: currentPayableAmount || 0,
            
            totalPaid: feeRecord.totalPaid || 0,
            totalDue: feeRecord.totalDue || 0,
            totalFineAmount: feeRecord.totalFineAmount || 0,
            totalFineDue,
            totalReadmissionFee: feeRecord.totalReadmissionFee || 0,
            totalReadmissionFeeDue,
            totalInvoices,
            pendingInvoices,
            semesterFees: feeRecord.semesterFees || [],
            scholarshipPercentage: student.scholarshipPercentage || 0,
            
            status: feeRecord.status || 'active'
          }
        };
      } else {
        return {
          ...student.toObject(),
          feeRecord: {
            hasFeeRecord: false,
            // All zero values for calculations
            totalDegreeFee: 0,
            totalAmountPaid: 0,
            totalAmountDue: 0,
            totalPayableAmount: 0,
            totalScholarshipDiscount: 0,
            currentSemesterTotal: 0,
            currentPayableAmount: 0,
            totalPaid: 0,
            totalDue: 0,
            totalFineAmount: 0,
            totalFineDue: 0,
            totalReadmissionFee: 0,
            totalReadmissionFeeDue: 0,
            totalInvoices: 0,
            pendingInvoices: 0,
            semesterFees: [],
            scholarshipPercentage: student.scholarshipPercentage || 0,
            status: 'not_generated'
          }
        };
      }
    });

    console.log(`✅ Processed ${studentsWithFees.length} students with CORRECTED fee calculations`);

    res.json({
      success: true,
      data: {
        batch: batch,
        degreeLevel: degreeLevel,
        department: department,
        studentCount: students.length,
        students: studentsWithFees,
        summary: {
          totalStudents: students.length,
          studentsWithFeeRecords: studentFees.length,
          studentsWithoutFeeRecords: students.length - studentFees.length
        }
      }
    });
  } catch (err) {
    console.error(' Error fetching students for batch:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students: ' + err.message
    });
  }
};

exports.generateStudentFeeRecords = async (req, res) => {
  try {
    const { degreeLevel, department, batch } = req.body;
    
    if (!degreeLevel || !department || !batch) {
      return res.status(400).json({
        success: false,
        message: 'Degree level, department, and batch are required'
      });
    }

    const feeStructure = await FeeStructure.findOne({
      degreeLevel,
      department: { $regex: new RegExp(`^${department}$`, 'i') },
      batch,
      isActive: true
    });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'No active fee structure found for this batch'
      });
    }

    const generationResults = await autoGenerateStudentFees(feeStructure);

    res.json({
      success: true,
      message: `Generated fee records for ${generationResults.total} students`,
      data: generationResults
    });

  } catch (err) {
    console.error('Error generating student fee records:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate student fee records: ' + err.message
    });
  }
};

exports.getAllStudentFees = async (req, res) => {
  try {
    const { 
      degreeLevel, 
      department, 
      batch, 
      status, 
      page = 1, 
      limit = 10,
      search 
    } = req.query;
    
    const filter = {};
    
    if (degreeLevel) filter.degreeLevel = degreeLevel;
    if (department) filter.department = { $regex: new RegExp(department, 'i') };
    if (batch) filter.batch = batch;
    if (status) filter.status = status;

    if (search) {
      const studentFilter = {
        $or: [
          { studentId: { $regex: new RegExp(search, 'i') } },
          { firstName: { $regex: new RegExp(search, 'i') } },
          { lastName: { $regex: new RegExp(search, 'i') } }
        ]
      };

      const matchingStudents = await Student.find(studentFilter).select('studentId');
      const studentIds = matchingStudents.map(s => s.studentId);
      
      filter.studentId = { $in: studentIds };
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };

    const studentFees = await StudentFee.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: 'studentId',
          as: 'studentData'
        }
      },
      { $unwind: { path: '$studentData', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          studentId: 1,
          degreeLevel: 1,
          department: 1,
          batch: 1,
          currentSemester: 1,
          scholarshipPercentage: 1,
          totalDegreeFee: 1,
          totalPaid: 1,
          totalDue: 1,
          totalFineAmount: 1,
          totalReadmissionFee: 1,
          totalPayableAmount: 1,
          totalAmountDue: 1,
          status: 1,
          invoices: 1,
          createdAt: 1,
          updatedAt: 1,
          'studentData.firstName': 1,
          'studentData.lastName': 1,
          'studentData.universityEmail': 1,
          'studentData.currentSemester': 1
        }
      },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    ]);

    const total = await StudentFee.countDocuments(filter);

    res.json({
      success: true,
      data: {
        studentFees,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalRecords: total,
          hasNext: (parseInt(page) * parseInt(limit)) < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (err) {
    console.error('Error fetching all student fees:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student fees: ' + err.message
    });
  }
};

exports.getStudentFeeOverview = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    const studentFee = await StudentFee.findOne({ studentId })
      .populate('studentId', 'firstName lastName universityEmail currentSemester scholarshipPercentage');

    if (!studentFee) {
      return res.status(404).json({
        success: false,
        message: 'No fee record found for this student'
      });
    }

    const currentSemesterFee = studentFee.semesterFees.find(
      sf => sf.semester === studentFee.currentSemester
    );

    const pendingInvoices = studentFee.invoices ? studentFee.invoices.filter(inv => inv.paymentStatus === 'pending') : [];
    const upcomingInstallments = currentSemesterFee ? 
      currentSemesterFee.installments.filter(inst => inst.status === 'pending') : [];

    const paymentHistory = studentFee.semesterFees.flatMap(semester => 
      semester.installments
        .filter(inst => inst.status === 'paid' || inst.status === 'fine_applied' || inst.status === 'readmission_required')
        .map(inst => ({
          semester: semester.semester,
          installmentNumber: inst.installmentNumber,
          amount: inst.amount,
          amountPaid: inst.amountPaid,
          paidDate: inst.paidDate,
          status: inst.status,
          fineAmount: inst.fineAmount,
          readmissionFee: inst.readmissionFee
        }))
    ).sort((a, b) => new Date(b.paidDate) - new Date(a.paidDate));

    res.json({
      success: true,
      data: {
        student: studentFee.studentId,
        feeSummary: {
          totalDegreeFee: studentFee.totalDegreeFee,
          totalPaid: studentFee.totalPaid,
          totalDue: studentFee.totalDue,
          totalFineAmount: studentFee.totalFineAmount,
          totalReadmissionFee: studentFee.totalReadmissionFee,
          totalPayableAmount: studentFee.totalPayableAmount,
          totalAmountDue: studentFee.totalAmountDue,
          status: studentFee.status,
          pendingInvoices: pendingInvoices.length,
          totalInvoices: studentFee.invoices ? studentFee.invoices.length : 0
        },
        currentSemester: currentSemesterFee,
        upcomingInstallments,
        paymentHistory,
        invoices: studentFee.invoices || [],
        allSemesters: studentFee.semesterFees.map(semester => ({
          semester: semester.semester,
          originalTotalFee: semester.originalTotalFee,
          totalFee: semester.totalFee,
          totalFineAmount: semester.totalFineAmount,
          totalReadmissionFee: semester.totalReadmissionFee,
          currentPayableAmount: semester.currentPayableAmount,
          paidAmount: semester.installments.reduce((sum, inst) => 
            (inst.status === 'paid' || inst.status === 'fine_applied' || inst.status === 'readmission_required') ? sum + inst.amountPaid : sum, 0
          ),
          dueAmount: semester.currentPayableAmount - semester.installments.reduce((sum, inst) => 
            (inst.status === 'paid' || inst.status === 'fine_applied' || inst.status === 'readmission_required') ? sum + inst.amountPaid : sum, 0
          ),
          status: semester.status
        }))
      }
    });
  } catch (err) {
    console.error('Error fetching student fee overview:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee overview'
    });
  }
};

exports.recalculateStudentFees = async (req, res) => {
  try {
    const { degreeLevel, department, batch, studentId } = req.body;
    
    if (!degreeLevel || !department || !batch) {
      return res.status(400).json({
        success: false,
        message: 'Degree level, department, and batch are required'
      });
    }

    const feeStructure = await FeeStructure.findOne({
      degreeLevel,
      department: { $regex: new RegExp(`^${department}$`, 'i') },
      batch,
      isActive: true
    });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'No active fee structure found'
      });
    }

    const batchInfo = await Batch.findOne({ batchName: batch });
    if (!batchInfo) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    let studentQuery = {
      degreeLevel,
      department: { $regex: new RegExp(`^${department}$`, 'i') },
      batch: batchInfo._id,
      status: 'active'
    };

    if (studentId) {
      studentQuery.studentId = studentId;
    }

    const students = await Student.find(studentQuery);
    console.log(`Recalculating fees for ${students.length} students`);

    const results = {
      total: students.length,
      recalculated: 0,
      errors: 0,
      details: []
    };

    for (const student of students) {
      try {
        let studentFee = await StudentFee.findOne({
          studentId: student.studentId
        });

        if (!studentFee) {
          results.errors++;
          results.details.push({
            studentId: student.studentId,
            status: 'error',
            message: 'No fee record found'
          });
          continue;
        }

        const scholarshipPercentage = student.scholarshipPercentage || 0;

        const semesterFees = feeStructure.semesterBreakdown.map(semesterData => {
          const semesterBaseFee = feeStructure.semesterBaseFees && feeStructure.semesterBaseFees.get(semesterData.semester.toString()) 
            ? feeStructure.semesterBaseFees.get(semesterData.semester.toString()).totalBaseFee
            : feeStructure.masterBaseFee.totalBaseFee;

          const originalCourseFee = semesterData.courseFee;
          const originalSemesterTotal = semesterBaseFee + originalCourseFee;

          const semesterFeeConfig = feeStructure.semesterBaseFees && feeStructure.semesterBaseFees.get(semesterData.semester.toString()) 
            ? feeStructure.semesterBaseFees.get(semesterData.semester.toString())
            : feeStructure.masterBaseFee;

          const tuitionPortion = semesterFeeConfig.tuitionFee;
          const miscellaneousPortion = semesterFeeConfig.miscellaneousFee;
          const fixedFees = semesterFeeConfig.examFee + 
                           semesterFeeConfig.libraryFee + 
                           semesterFeeConfig.labFee;
          
          const discountedTuition = Math.round(tuitionPortion * (1 - scholarshipPercentage / 100));
          const discountedCourseFee = Math.round(originalCourseFee * (1 - scholarshipPercentage / 100));
          
          const discountedBaseFee = discountedTuition + miscellaneousPortion + fixedFees;
          const totalDiscountedFee = discountedBaseFee + discountedCourseFee;
          const scholarshipDiscount = originalSemesterTotal - totalDiscountedFee;

          const academicSemester = batchInfo.academicCalendar?.find(s => s.semester === semesterData.semester);
          
          let installments = [];
          if (academicSemester && academicSemester.midtermStart && academicSemester.finalStart) {
            const firstInstallmentDueDate = addDays(new Date(academicSemester.midtermStart), -21);
            const secondInstallmentDueDate = addDays(new Date(academicSemester.finalStart), -28);

            const installmentAmount = Math.round(totalDiscountedFee / 2);

            installments = [
              {
                installmentNumber: 1,
                amount: installmentAmount,
                amountPaid: 0,
                dueDate: firstInstallmentDueDate,
                status: 'pending',
                fineAmount: 0,
                daysOverdue: 0,
                finePaid: false,
                readmissionFee: 0,
                readmissionFeePaid: false,
                invoiceNumber: null,
                invoiceGenerated: false,
                invoiceStatus: 'not_generated'
              },
              {
                installmentNumber: 2,
                amount: installmentAmount,
                amountPaid: 0,
                dueDate: secondInstallmentDueDate,
                status: 'pending',
                fineAmount: 0,
                daysOverdue: 0,
                finePaid: false,
                readmissionFee: 0,
                readmissionFeePaid: false,
                invoiceNumber: null,
                invoiceGenerated: false,
                invoiceStatus: 'not_generated'
              }
            ];
          }

          return {
            semester: semesterData.semester,
            originalBaseFee: semesterBaseFee,
            originalCourseFee: originalCourseFee,
            originalTotalFee: originalSemesterTotal,
            tuitionFee: discountedTuition,
            courseFees: discountedCourseFee,
            fixedFees: fixedFees,
            totalFee: totalDiscountedFee,
            scholarshipDiscount: scholarshipDiscount,
            discountedFee: totalDiscountedFee,
            totalFineAmount: 0,
            finePaid: 0,
            fineDue: 0,
            totalReadmissionFee: 0,
            readmissionFeePaid: 0,
            readmissionFeeDue: 0,
            currentPayableAmount: totalDiscountedFee,
            status: 'pending',
            installments: installments
          };
        });

        studentFee.semesterFees = semesterFees;
        studentFee.totalDegreeFee = semesterFees.reduce((sum, sf) => sum + sf.originalTotalFee, 0);
        studentFee.scholarshipPercentage = scholarshipPercentage;
        studentFee.currentSemester = student.currentSemester;

        await studentFee.save();
        results.recalculated++;
        results.details.push({
          studentId: student.studentId,
          status: 'recalculated',
          message: 'Fees recalculated successfully'
        });
        console.log(`Recalculated fees for student ${student.studentId}`);

      } catch (error) {
        results.errors++;
        results.details.push({
          studentId: student.studentId,
          status: 'error',
          message: error.message
        });
        console.error(`Error recalculating fees for student ${student.studentId}:`, error);
      }
    }

    res.json({
      success: true,
      message: `Recalculated fees for ${results.recalculated} students`,
      data: results
    });

  } catch (err) {
    console.error('Error recalculating student fees:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to recalculate student fees: ' + err.message
    });
  }
};

exports.getFeeStructureSummary = async (req, res) => {
  try {
    const { degreeLevel, department } = req.query;
    
    if (!degreeLevel || !department) {
      return res.status(400).json({
        success: false,
        message: 'Degree level and department are required'
      });
    }

    const feeStructures = await FeeStructure.find({
      degreeLevel,
      department: { $regex: new RegExp(`^${department}$`, 'i') },
      isActive: true
    }).sort({ batch: 1 });

    const summary = feeStructures.map(structure => ({
      batch: structure.batch,
      degreeLevel: structure.degreeLevel,
      department: structure.department,
      totalSemesters: structure.semesterBreakdown.length,
      totalDegreeFee: structure.degreeTotal,
      createdAt: structure.createdAt,
      updatedAt: structure.updatedAt
    }));

    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    console.error('Error fetching fee structure summary:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee structure summary'
    });
  }
};

exports.deleteFeeStructure = async (req, res) => {
  try {
    const { degreeLevel, department, batch } = req.body;
    
    if (!degreeLevel || !department || !batch) {
      return res.status(400).json({
        success: false,
        message: 'Degree level, department, and batch are required'
      });
    }

    const feeStructure = await FeeStructure.findOneAndUpdate(
      {
        degreeLevel,
        department: { $regex: new RegExp(`^${department}$`, 'i') },
        batch,
        isActive: true
      },
      { isActive: false },
      { new: true }
    );

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }

    res.json({
      success: true,
      message: 'Fee structure deleted successfully',
      data: feeStructure
    });
  } catch (err) {
    console.error('Error deleting fee structure:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete fee structure: ' + err.message
    });
  }
};

exports.updateExistingStudentFees = async (req, res) => {
  try {
    const { degreeLevel, department, batch } = req.body;
    
    if (!degreeLevel || !department || !batch) {
      return res.status(400).json({
        success: false,
        message: 'Degree level, department, and batch are required'
      });
    }

    const feeStructure = await FeeStructure.findOne({
      degreeLevel,
      department: { $regex: new RegExp(`^${department}$`, 'i') },
      batch,
      isActive: true
    });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'No active fee structure found for this batch'
      });
    }

    console.log(' Updating existing student fees with new fee structure...');
    
    const generationResults = await autoGenerateStudentFees(feeStructure);

    res.json({
      success: true,
      message: `Updated ${generationResults.updated} student fee records`,
      data: generationResults
    });
  } catch (err) {
    console.error('Error updating student fees:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update student fees: ' + err.message
    });
  }
};
exports.getBatchFeeTotals = async (req, res) => {
  try {
    const { degreeLevel, department, batch } = req.query;
    
    if (!degreeLevel || !department || !batch) {
      return res.status(400).json({
        success: false,
        message: 'Degree level, department, and batch are required'
      });
    }

    console.log(`Calculating batch totals for: ${batch}, ${department}, ${degreeLevel}`);

    const studentFees = await StudentFee.find({
      degreeLevel,
      department: { $regex: new RegExp(`^${department}$`, 'i') },
      batch
    });

    console.log(` Found ${studentFees.length} student fee records for batch totals`);

    const batchTotals = {
      totalRequiredAmount: 0, 
      totalPaidBatch: 0,
      totalDueAmount: 0,
      totalFineDue: 0,
      totalInvoices: 0,
      studentsWithRecords: studentFees.length,
      totalStudents: 0,
      collectionRate: 0,
      totalScholarshipDiscount: 0,
      totalOriginalDegreeFee: 0 
    };

    
    studentFees.forEach(student => {
      const studentPayableAmount = student.totalPayableAmount || 0;
      batchTotals.totalRequiredAmount += studentPayableAmount;
      
      batchTotals.totalPaidBatch += student.totalAmountPaid || 0;
      batchTotals.totalDueAmount += student.totalAmountDue || 0;
      batchTotals.totalFineDue += student.totalFineDue || 0;
      batchTotals.totalInvoices += student.invoices?.length || 0;
      batchTotals.totalOriginalDegreeFee += student.totalDegreeFee || 0;
      
      if (student.semesterFees && Array.isArray(student.semesterFees)) {
        const studentScholarshipDiscount = student.semesterFees.reduce((sum, sf) => 
          sum + (sf.scholarshipDiscount || 0), 0
        );
        batchTotals.totalScholarshipDiscount += studentScholarshipDiscount;
      }
    });

    const batchInfo = await Batch.findOne({ 
      batchName: batch,
      degreeLevel: degreeLevel.toLowerCase(),
      departmentName: { $regex: new RegExp(`^${department}$`, 'i') }
    });

    if (batchInfo) {
      let totalStudents = 0;
      if (batchInfo.sections && batchInfo.sections.length > 0) {
        batchInfo.sections.forEach(section => {
          totalStudents += section.students?.length || 0;
        });
      } else {
        const studentsCount = await Student.countDocuments({
          batch: batchInfo._id,
          status: 'active'
        });
        totalStudents = studentsCount;
      }
      batchTotals.totalStudents = totalStudents;
    } else {
      batchTotals.totalStudents = studentFees.length; 
    }

    if (batchTotals.totalRequiredAmount > 0) {
      batchTotals.collectionRate = Math.round((batchTotals.totalPaidBatch / batchTotals.totalRequiredAmount) * 100);
    } else {
      batchTotals.collectionRate = 0;
    }

    batchTotals.totalDueAmount = Math.max(0, batchTotals.totalDueAmount);
    batchTotals.totalFineDue = Math.max(0, batchTotals.totalFineDue);

    console.log(` Batch totals calculated:`, {
      totalRequired: batchTotals.totalRequiredAmount,
      totalPaid: batchTotals.totalPaidBatch,
      totalDue: batchTotals.totalDueAmount,
      totalStudents: batchTotals.totalStudents,
      collectionRate: batchTotals.collectionRate,
      totalScholarshipDiscount: batchTotals.totalScholarshipDiscount,
      totalOriginalDegreeFee: batchTotals.totalOriginalDegreeFee
    });

    res.json({
      success: true,
      data: batchTotals
    });
  } catch (err) {
    console.error(' Error fetching batch fee totals:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch batch fee totals: ' + err.message
    });
  }
};





exports.getFeeRevenueStats = async (req, res) => {
  try {
    const { timeframe = 'monthly', year = new Date().getFullYear() } = req.query;
    
    const studentFees = await StudentFee.find({})
      .populate('studentId', 'firstName lastName batch degreeLevel department');
    
    const revenueStats = {
      totalRevenue: 0,
      totalPaid: 0,
      totalPending: 0,
      monthlyBreakdown: [],
      batchWiseRevenue: [],
      departmentWiseRevenue: [],
      semesterWiseRevenue: []
    };
    
    studentFees.forEach(fee => {
      revenueStats.totalRevenue += fee.totalPayableAmount || 0;
      revenueStats.totalPaid += fee.totalAmountPaid || 0;
      revenueStats.totalPending += fee.totalAmountDue || 0;
    });
    
    const monthlyData = {};
    const currentYear = new Date().getFullYear();
    
    studentFees.forEach(fee => {
      if (fee.invoices && fee.invoices.length > 0) {
        fee.invoices.forEach(invoice => {
          if (invoice.paidAt) {
            const paidDate = new Date(invoice.paidAt);
            const monthKey = `${paidDate.getFullYear()}-${(paidDate.getMonth() + 1).toString().padStart(2, '0')}`;
            const monthName = paidDate.toLocaleString('default', { month: 'short' });
            
            if (!monthlyData[monthKey]) {
              monthlyData[monthKey] = {
                month: monthName,
                paid: 0,
                pending: 0,
                revenue: 0
              };
            }
            
            monthlyData[monthKey].paid += invoice.totalAmount || 0;
            monthlyData[monthKey].revenue += invoice.totalAmount || 0;
          }
        });
      }
    });
    
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const monthName = date.toLocaleString('default', { month: 'short' });
      
      if (monthlyData[monthKey]) {
        months.push(monthlyData[monthKey]);
      } else {
        const monthlyPending = studentFees.reduce((sum, fee) => {
          return sum + (fee.totalAmountDue || 0) / 6;
        }, 0);
        
        months.push({
          month: monthName,
          paid: 0,
          pending: Math.round(monthlyPending),
          revenue: 0
        });
      }
    }
    
    revenueStats.monthlyBreakdown = months;
    
    const batchRevenue = {};
    studentFees.forEach(fee => {
      const batch = fee.batch || 'Unknown';
      if (!batchRevenue[batch]) {
        batchRevenue[batch] = { paid: 0, pending: 0 };
      }
      batchRevenue[batch].paid += fee.totalAmountPaid || 0;
      batchRevenue[batch].pending += fee.totalAmountDue || 0;
    });
    
    revenueStats.batchWiseRevenue = Object.entries(batchRevenue).map(([batch, amounts]) => ({
      batch,
      paid: Math.round(amounts.paid),
      pending: Math.round(amounts.pending)
    }));
    
    const semesterRevenue = {};
    studentFees.forEach(fee => {
      if (fee.semesterFees) {
        fee.semesterFees.forEach(semesterFee => {
          const semester = semesterFee.semester;
          if (!semesterRevenue[semester]) {
            semesterRevenue[semester] = { paid: 0, pending: 0 };
          }
          
          const semesterPaid = semesterFee.installments.reduce((sum, installment) => {
            return sum + (installment.amountPaid || 0);
          }, 0);
          
          const semesterPending = semesterFee.currentPayableAmount - semesterPaid;
          
          semesterRevenue[semester].paid += semesterPaid;
          semesterRevenue[semester].pending += Math.max(0, semesterPending);
        });
      }
    });
    
    revenueStats.semesterWiseRevenue = Object.entries(semesterRevenue).map(([semester, amounts]) => ({
      semester: `Semester ${semester}`,
      paid: Math.round(amounts.paid),
      pending: Math.round(amounts.pending)
    }));
    
    res.json({
      success: true,
      data: revenueStats
    });
    
  } catch (err) {
    console.error('Error fetching fee revenue stats:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue statistics'
    });
  }
};

module.exports = exports;

