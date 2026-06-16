const FeeType = require('../models/FeeType');
const StudentService = require('../models/StudentService');
const FeeAssignment = require('../models/FeeAssignment');

class OptionalPaymentService {
  
  async getAvailableServices() {
    return await FeeType.find({
      isServiceFee: true,
      isActive: true
    });
  }
  
  async addServiceToStudent(studentId, serviceId, assignedBy, semester, academicTerm) {
    const service = await FeeType.findById(serviceId);
    if (!service || !service.isServiceFee) {
      throw new Error('Invalid service or service not available');
    }
    
    const student = await Student.findById(studentId);
    if (!student) throw new Error('Student not found');
    
    const studentService = new StudentService({
      student: studentId,
      service: serviceId,
      assignedBy,
      amount: service.defaultAmount,
      semester,
      academicTerm
    });
    
    await studentService.save();
    
    await this.addServiceToFeeAssignment(studentId, service, semester, academicTerm);
    
    return studentService;
  }
  
  async addServiceToFeeAssignment(studentId, service, semester, academicTerm) {
    let feeAssignment = await FeeAssignment.findOne({
      student: studentId,
      semester,
      academicTerm,
      isActive: true
    });
    
    if (!feeAssignment) {
      const FeeCalculationService = require('./feeCalculationService');
      feeAssignment = await FeeCalculationService.calculateSemesterFee(studentId, semester, academicTerm);
      feeAssignment = new FeeAssignment(feeAssignment);
    }
    
    feeAssignment.components.push({
      feeType: service._id,
      originalAmount: service.defaultAmount,
      discountedAmount: service.defaultAmount,
      scholarshipApplied: false,
      scholarshipPercentage: 0,
      scholarshipReduction: 0,
      status: 'Pending',
      isOptionalService: true,
      serviceAddedBy: assignedBy,
      serviceAddedDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
      transactions: []
    });
    
    feeAssignment.totalAmount += service.defaultAmount;
    feeAssignment.totalDue += service.defaultAmount;
    
    await feeAssignment.save();
    return feeAssignment;
  }
  
  async autoApplyServicesToNewStudent(studentId) {
    const autoApplyServices = await FeeType.find({
      isServiceFee: true,
      autoApplyToNewStudents: true,
      isActive: true
    });
    
    const student = await Student.findById(studentId);
    const currentSemester = student.currentSemester;
    const academicTerm = `${new Date().getFullYear()}-${currentSemester}`;
    
    for (const service of autoApplyServices) {
      if (service.appliesToSemesters.includes(currentSemester)) {
        await this.addServiceToStudent(
          studentId, 
          service._id, 
          null, 
          currentSemester, 
          academicTerm
        );
      }
    }
  }
  
  async removeServiceFromStudent(studentId, serviceId, semester) {
    await StudentService.findOneAndUpdate(
      { student: studentId, service: serviceId, semester },
      { status: 'Cancelled' }
    );
    
    const feeAssignment = await FeeAssignment.findOne({
      student: studentId,
      semester,
      isActive: true
    });
    
    if (feeAssignment) {
      feeAssignment.components = feeAssignment.components.filter(
        comp => !comp.isOptionalService || comp.feeType.toString() !== serviceId
      );
      
      feeAssignment.totalAmount = feeAssignment.components.reduce(
        (sum, comp) => sum + comp.discountedAmount, 0
      );
      feeAssignment.totalDue = feeAssignment.totalAmount - feeAssignment.totalPaid;
      
      await feeAssignment.save();
    }
  }
}

module.exports = new OptionalPaymentService();