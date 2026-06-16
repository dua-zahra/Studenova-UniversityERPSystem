const FeeStructure = require('../models/FeeStructure');
const FeeAssignment = require('../models/FeeAssignment');
const Student = require('../models/Student');
const Batch = require('../models/Batch');

class FeeCalculationService {
  
  async calculateSemesterFee(studentId, semester, academicTerm) {
    const student = await Student.findById(studentId)
      .populate('batch');
    
    if (!student) throw new Error('Student not found');
    
    const feeStructure = await FeeStructure.findOne({
      degreeLevel: student.degreeLevel.toLowerCase(),
      department: student.department,
      batchYear: student.batch.enrollmentYear,
      isActive: true
    }).populate('components.feeType');
    
    if (!feeStructure) throw new Error('Fee structure not found');
    
    const batch = await Batch.findById(student.batch);
    const semesterData = batch.academicCalendar.find(s => s.semester === semester);
    
    if (!semesterData) throw new Error('Semester not found in academic calendar');
    
    return this.generateFeeAssignment(student, semester, academicTerm, feeStructure, semesterData);
  }
  
  generateFeeAssignment(student, semester, academicTerm, feeStructure, semesterData) {
    const components = [];
    let totalAmount = 0;
    let totalScholarshipReduction = 0;
    
    const installmentDates = this.calculateInstallmentDates(semesterData);
    
    for (const component of feeStructure.components) {
      if (component.appliesToSemesters.includes(semester)) {
        const componentData = this.processFeeComponent(component, student, semester);
        
        components.push({
          ...componentData,
          dueDate: this.calculateComponentDueDate(component, installmentDates)
        });
        
        totalAmount += componentData.discountedAmount;
        totalScholarshipReduction += componentData.scholarshipReduction;
      }
    }
    
    return {
      student: student._id,
      batch: student.batch,
      academicTerm,
      semester,
      components,
      totalAmount,
      totalScholarshipReduction,
      totalDue: totalAmount,
      status: 'Pending'
    };
  }
  
  processFeeComponent(component, student, semester) {
    let originalAmount = component.amount;
    let discountedAmount = component.amount;
    let scholarshipReduction = 0;
    let scholarshipApplied = false;
    
    if (component.isTuitionFee && student.isScholarshipApplicant && student.scholarshipPercentage > 0) {
      scholarshipReduction = originalAmount * (student.scholarshipPercentage / 100);
      discountedAmount = originalAmount - scholarshipReduction;
      scholarshipApplied = true;
    }
    
    if (this.isRepeatCourse(student, semester, component)) {
      scholarshipReduction = 0;
      discountedAmount = originalAmount;
      scholarshipApplied = false;
    }
    
    return {
      feeType: component.feeType._id,
      originalAmount,
      discountedAmount,
      scholarshipApplied,
      scholarshipPercentage: scholarshipApplied ? student.scholarshipPercentage : 0,
      scholarshipReduction,
      status: 'Pending',
      isOptionalService: component.isOptional,
      transactions: []
    };
  }
  
  calculateInstallmentDates(semesterData) {
    const { addDays, subWeeks } = require('date-fns');
    
    return {
      installment1: {
        generateDate: subWeeks(semesterData.midtermStart, 3),
        dueDate: addDays(subWeeks(semesterData.midtermStart, 3), 15)
      },
      installment2: {
        generateDate: subWeeks(semesterData.finalStart, 4),
        dueDate: addDays(subWeeks(semesterData.finalStart, 4), 15)
      }
    };
  }
  
  calculateComponentDueDate(component, installmentDates) {
    const dueDateOffset = component.dueDateOffset || 0;
    

    if (component.isTuitionFee) {
      return installmentDates.installment1.dueDate; 
    }
    
    return addDays(installmentDates.installment1.generateDate, dueDateOffset);
  }
  
  isRepeatCourse(student, semester, component) {
  
    return false; 
  }
}

module.exports = new FeeCalculationService();