const mongoose = require('mongoose');

const installmentSchema = new mongoose.Schema({
  installmentNumber: { type: Number, required: true },
  amount: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  dueDate: { type: Date, required: true },
  paidDate: { type: Date },
  status: {
    type: String,
    enum: ['pending', 'paid', 'fine_applied', 'readmission_required'],
    default: 'pending'
  },
  fineAmount: { type: Number, default: 0 },
  daysOverdue: { type: Number, default: 0 },
  finePaid: { type: Boolean, default: false },
  readmissionFee: { type: Number, default: 0 },
  readmissionFeePaid: { type: Boolean, default: false },
  invoiceNumber: { type: String, default: null },
  invoiceGenerated: { type: Boolean, default: false }
}, { _id: false });

const semesterFeeSchema = new mongoose.Schema({
  semester: { type: Number, required: true },
  originalBaseFee: { type: Number, required: true },
  originalCourseFee: { type: Number, required: true },
  originalTotalFee: { type: Number, required: true },
  tuitionFee: { type: Number, required: true },
  courseFees: { type: Number, required: true },
  fixedFees: { type: Number, required: true },
  totalFee: { type: Number, required: true },
  scholarshipDiscount: { type: Number, default: 0 },
  discountedFee: { type: Number, required: true },
  totalFineAmount: { type: Number, default: 0 },
  finePaid: { type: Number, default: 0 },
  fineDue: { type: Number, default: 0 },
  totalReadmissionFee: { type: Number, default: 0 },
  readmissionFeePaid: { type: Number, default: 0 },
  readmissionFeeDue: { type: Number, default: 0 },
  currentPayableAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue', 'readmission_required'],
    default: 'pending'
  },
  installments: [installmentSchema],
  isCustomFee: { type: Boolean, default: false },
  feeStructureVersion: { type: Date, default: Date.now }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true },
  studentId: { type: String, required: true },
  semester: { type: Number, required: true },
  installmentNumber: { type: Number, required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  fineAmount: { type: Number, default: 0 },
  readmissionFee: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  qrCodeData: { type: String },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'overdue'],
    default: 'pending'
  },
  invoiceStatus: {
    type: String,
    enum: ['generated', 'downloaded', 'paid'],
    default: 'generated'
  },
  generatedAt: { type: Date, default: Date.now },
  downloadedAt: { type: Date },
  paidAt: { type: Date },
  isActive: { type: Boolean, default: true },
  isFineInvoice: { type: Boolean, default: false },
  isReadmissionInvoice: { type: Boolean, default: false }
}, { _id: true });

const StudentFeeSchema = new mongoose.Schema({
  studentId: { type: String, required: true, ref: 'Student' },
  degreeLevel: { type: String, required: true },
  department: { type: String, required: true },
  batch: { type: String, required: true },
  currentSemester: { type: Number, required: true },
  scholarshipPercentage: { type: Number, default: 0 },
  semesterFees: [semesterFeeSchema],
  invoices: { 
    type: [invoiceSchema], 
    default: [] 
  },
  totalDegreeFee: { type: Number, required: true },
  totalPaid: { type: Number, default: 0 },
  totalDue: { type: Number, required: true },
  totalFineAmount: { type: Number, default: 0 },
  totalFinePaid: { type: Number, default: 0 },
  totalFineDue: { type: Number, default: 0 },
  totalReadmissionFee: { type: Number, default: 0 },
  totalReadmissionFeePaid: { type: Number, default: 0 },
  totalReadmissionFeeDue: { type: Number, default: 0 },
  totalPayableAmount: { type: Number, required: true },
  totalAmountPaid: { type: Number, default: 0 },
  totalAmountDue: { type: Number, required: true },
  status: {
    type: String,
    enum: ['active', 'completed', 'overdue', 'readmission_required'],
    default: 'active'
  },
  feeStructureVersion: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

StudentFeeSchema.statics.generateInvoiceNumber = function() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `INV-${timestamp}-${random}`;
};

StudentFeeSchema.methods.generateInstallmentInvoices = function(semesterType = 'past_current', currentSemester) {
  const invoices = [];
  const now = new Date();
  
  if (!this.invoices) {
    this.invoices = [];
  }

  const existingInvoiceNumbers = new Set(this.invoices.map(inv => inv.invoiceNumber));
  
  const existingInvoicesMap = new Map();
  this.invoices.forEach(inv => {
    const key = `${inv.semester}-${inv.installmentNumber}-${inv.isFineInvoice ? 'fine' : 'normal'}-${inv.isReadmissionInvoice ? 'readmission' : 'normal'}`;
    existingInvoicesMap.set(key, inv);
  });

  for (const semesterFee of this.semesterFees) {
    let includeSemester = false;
    switch (semesterType) {
      case 'past': includeSemester = semesterFee.semester < currentSemester; break;
      case 'current': includeSemester = semesterFee.semester === currentSemester; break;
      case 'past_current': includeSemester = semesterFee.semester <= currentSemester; break;
      case 'all': includeSemester = true; break;
      default: includeSemester = semesterFee.semester <= currentSemester;
    }
    
    if (!includeSemester) continue;
    
    for (const installment of semesterFee.installments) {
      const normalKey = `${semesterFee.semester}-${installment.installmentNumber}-normal-normal`;
      const fineKey = `${semesterFee.semester}-${installment.installmentNumber}-fine-normal`;
      
      const existingNormalInvoice = existingInvoicesMap.get(normalKey);
      if (existingNormalInvoice && existingNormalInvoice.isActive) {
        console.log(`ℹ Invoice already exists for semester ${semesterFee.semester} installment ${installment.installmentNumber}`);
        
        if (installment.fineAmount > 0 && existingNormalInvoice.fineAmount !== installment.fineAmount) {
          console.log(` Updating fine amount in existing invoice from ${existingNormalInvoice.fineAmount} to ${installment.fineAmount}`);
          existingNormalInvoice.fineAmount = installment.fineAmount;
          existingNormalInvoice.totalAmount = existingNormalInvoice.amount + installment.fineAmount + existingNormalInvoice.readmissionFee;
          existingNormalInvoice.description = this.getInvoiceDescription(semesterFee.semester, installment);
        }
        continue;
      }
      
      if (installment.status === 'pending' || installment.fineAmount > 0 || installment.readmissionFee > 0) {
        let invoiceNumber;
        let attempts = 0;
        
        do {
          invoiceNumber = this.constructor.generateInvoiceNumber();
          attempts++;
          if (attempts > 5) {
            throw new Error('Failed to generate unique invoice number after 5 attempts');
          }
        } while (existingInvoiceNumbers.has(invoiceNumber));
        
        const description = this.getInvoiceDescription(semesterFee.semester, installment);
        const totalAmount = installment.amount + (installment.fineAmount || 0) + (installment.readmissionFee || 0);
        
        const invoice = {
          invoiceNumber, 
          studentId: this.studentId,
          semester: semesterFee.semester,
          installmentNumber: installment.installmentNumber,
          description,
          amount: installment.amount,
          dueDate: installment.dueDate,
          fineAmount: installment.fineAmount || 0,
          readmissionFee: installment.readmissionFee || 0,
          totalAmount,
          paymentStatus: 'pending',
          invoiceStatus: 'generated',
          generatedAt: now,
          isActive: true,
          isFineInvoice: false,
          isReadmissionInvoice: false
        };
        
        installment.invoiceNumber = invoiceNumber;
        installment.invoiceGenerated = true;
        
        invoices.push(invoice);
        this.invoices.push(invoice);
        existingInvoiceNumbers.add(invoiceNumber);
        existingInvoicesMap.set(normalKey, invoice);
        
        console.log(` Generated invoice ${invoiceNumber} for semester ${semesterFee.semester} installment ${installment.installmentNumber} with fine: Rs. ${installment.fineAmount || 0}`);
      }
    }
  }
  
  return invoices;
};

StudentFeeSchema.methods.generateFineAndReadmissionInvoices = function(currentSemester) {
  const invoices = [];
  const now = new Date();
  
  if (!this.invoices) {
    this.invoices = [];
  }

  const existingInvoiceNumbers = new Set(this.invoices.map(inv => inv.invoiceNumber));

  for (const semesterFee of this.semesterFees) {
    if (semesterFee.semester > currentSemester) continue;
    
    for (const installment of semesterFee.installments) {
      const normalKey = `${semesterFee.semester}-${installment.installmentNumber}-normal-normal`;
      
      const existingNormalInvoice = this.invoices.find(inv => 
        inv.semester === semesterFee.semester && 
        inv.installmentNumber === installment.installmentNumber && 
        !inv.isFineInvoice && 
        !inv.isReadmissionInvoice &&
        inv.isActive
      );
      
      const existingFineInvoice = this.invoices.find(inv => 
        inv.semester === semesterFee.semester && 
        inv.installmentNumber === installment.installmentNumber && 
        inv.isFineInvoice
      );
      
      
      if (installment.fineAmount > 0 && !installment.finePaid && !existingFineInvoice) {
        if (existingNormalInvoice && existingNormalInvoice.fineAmount === 0) {
     
          const fineInvoiceNumber = this.generateFineInvoiceNumber(existingInvoiceNumbers);
          const fineDescription = `Semester ${semesterFee.semester} - Installment ${installment.installmentNumber} Late Fine`;
          
          const fineInvoice = {
            invoiceNumber: fineInvoiceNumber,
            studentId: this.studentId,
            semester: semesterFee.semester,
            installmentNumber: installment.installmentNumber,
            description: fineDescription,
            amount: 0,
            dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), 
            fineAmount: installment.fineAmount,
            readmissionFee: 0,
            totalAmount: installment.fineAmount,
            paymentStatus: 'pending',
            invoiceStatus: 'generated',
            generatedAt: now,
            isActive: true,
            isFineInvoice: true,
            isReadmissionInvoice: false
          };
          
          invoices.push(fineInvoice);
          this.invoices.push(fineInvoice);
          existingInvoiceNumbers.add(fineInvoiceNumber);
          
          console.log(` Generated SEPARATE fine invoice ${fineInvoiceNumber} for existing invoice without fine`);
        } else if (!existingNormalInvoice) {
          console.log(` Fine will be included in main invoice for semester ${semesterFee.semester} installment ${installment.installmentNumber}`);
        }
      }
      
      if (installment.readmissionFee > 0 && !installment.readmissionFeePaid) {
        const existingReadmissionInvoice = this.invoices.find(inv => 
          inv.semester === semesterFee.semester && 
          inv.installmentNumber === installment.installmentNumber && 
          inv.isReadmissionInvoice
        );
        
        if (!existingReadmissionInvoice) {
          if (existingNormalInvoice && existingNormalInvoice.readmissionFee === 0) {
            const readmissionInvoiceNumber = this.generateReadmissionInvoiceNumber(existingInvoiceNumbers);
            const readmissionDescription = `Semester ${semesterFee.semester} - Installment ${installment.installmentNumber} Readmission Fee`;
            
            const readmissionInvoice = {
              invoiceNumber: readmissionInvoiceNumber,
              studentId: this.studentId,
              semester: semesterFee.semester,
              installmentNumber: installment.installmentNumber,
              description: readmissionDescription,
              amount: 0,
              dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
              fineAmount: 0,
              readmissionFee: installment.readmissionFee,
              totalAmount: installment.readmissionFee,
              paymentStatus: 'pending',
              invoiceStatus: 'generated',
              generatedAt: now,
              isActive: true,
              isFineInvoice: false,
              isReadmissionInvoice: true
            };
            
            invoices.push(readmissionInvoice);
            this.invoices.push(readmissionInvoice);
            existingInvoiceNumbers.add(readmissionInvoiceNumber);
            
            console.log(`Generated SEPARATE readmission invoice ${readmissionInvoiceNumber} for existing invoice without readmission fee`);
          }
        }
      }
    }
  }
  
  return invoices;
};

StudentFeeSchema.methods.getInvoiceDescription = function(semester, installment) {
  let description = `Semester ${semester} - Installment ${installment.installmentNumber}`;
  
  if (installment.fineAmount > 0) {
    description += ` (Includes Late Fine: Rs. ${installment.fineAmount.toLocaleString()})`;
  }
  
  if (installment.readmissionFee > 0) {
    description += ` (Includes Readmission Fee: Rs. ${installment.readmissionFee.toLocaleString()})`;
  }
  
  return description;
};

StudentFeeSchema.methods.generateFineInvoiceNumber = function(existingInvoiceNumbers) {
  let invoiceNumber;
  let attempts = 0;
  
  do {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    invoiceNumber = `FINE-${timestamp}-${random}`;
    attempts++;
    
    if (attempts > 5) {
      throw new Error('Failed to generate unique fine invoice number');
    }
  } while (existingInvoiceNumbers.has(invoiceNumber));
  
  return invoiceNumber;
};

StudentFeeSchema.methods.generateReadmissionInvoiceNumber = function(existingInvoiceNumbers) {
  let invoiceNumber;
  let attempts = 0;
  
  do {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    invoiceNumber = `READM-${timestamp}-${random}`;
    attempts++;
    
    if (attempts > 5) {
      throw new Error('Failed to generate unique readmission invoice number');
    }
  } while (existingInvoiceNumbers.has(invoiceNumber));
  
  return invoiceNumber;
};


StudentFeeSchema.methods.autoDetectFinesAndReadmission = function() {
  const now = new Date();
  let changesMade = false;
  
  const existingInvoicesMap = new Map();
  this.invoices.forEach(inv => {
    if (!inv.isFineInvoice && !inv.isReadmissionInvoice) {
      const key = `${inv.semester}-${inv.installmentNumber}`;
      existingInvoicesMap.set(key, inv);
    }
  });

  for (const semesterFee of this.semesterFees) {
    for (const installment of semesterFee.installments) {
      if (installment.status === 'pending' && new Date(installment.dueDate) < now) {
        const daysOverdue = Math.floor((now - new Date(installment.dueDate)) / (1000 * 60 * 60 * 24));
        
        if (daysOverdue > 0) {
          const monthlyFineRate = 0.02;
          const dailyFineRate = monthlyFineRate / 30;
          const calculatedFine = Math.round(installment.amount * dailyFineRate * daysOverdue);
          
          const newFineAmount = Math.min(calculatedFine, installment.amount * 0.5);
          
          if (newFineAmount !== installment.fineAmount) {
            installment.fineAmount = newFineAmount;
            installment.daysOverdue = daysOverdue;
            
            const invoiceKey = `${semesterFee.semester}-${installment.installmentNumber}`;
            const existingInvoice = existingInvoicesMap.get(invoiceKey);
            
            if (existingInvoice) {
              console.log(` Updating existing invoice with new fine amount: Rs. ${newFineAmount}`);
              existingInvoice.fineAmount = newFineAmount;
              existingInvoice.totalAmount = existingInvoice.amount + newFineAmount + existingInvoice.readmissionFee;
              existingInvoice.description = this.getInvoiceDescription(semesterFee.semester, installment);
            }
            
            if (daysOverdue > 90 && installment.readmissionFee === 0) {
              installment.readmissionFee = Math.round(installment.amount * 0.1); 
              installment.status = 'readmission_required';
              
              if (existingInvoice) {
                existingInvoice.readmissionFee = installment.readmissionFee;
                existingInvoice.totalAmount = existingInvoice.amount + existingInvoice.fineAmount + installment.readmissionFee;
                existingInvoice.description = this.getInvoiceDescription(semesterFee.semester, installment);
              }
            } else if (installment.fineAmount > 0) {
              installment.status = 'fine_applied';
            }
            
            changesMade = true;
            console.log(`⚡ Auto-applied/updated fine: Rs. ${installment.fineAmount} for semester ${semesterFee.semester} installment ${installment.installmentNumber} (${daysOverdue} days overdue)`);
          }
        }
      }
    }
  }
  
  return changesMade;
};

StudentFeeSchema.methods.applyScholarship = function(scholarshipPercentage) {
  console.log(` Applying ${scholarshipPercentage}% scholarship to student ${this.studentId}`);
  
  this.scholarshipPercentage = scholarshipPercentage;
  
  this.semesterFees.forEach(semesterFee => {
    const originalTotal = semesterFee.originalBaseFee + semesterFee.originalCourseFee;
    
    const scholarshipDiscount = Math.round(originalTotal * (scholarshipPercentage / 100));
    
    const discountedBaseFee = Math.round(semesterFee.originalBaseFee * (1 - scholarshipPercentage / 100));
    const discountedCourseFee = Math.round(semesterFee.originalCourseFee * (1 - scholarshipPercentage / 100));
    
    const totalDiscountedFee = discountedBaseFee + discountedCourseFee;
    
    semesterFee.tuitionFee = Math.round(semesterFee.tuitionFee * (1 - scholarshipPercentage / 100));
    semesterFee.courseFees = discountedCourseFee;
    semesterFee.totalFee = totalDiscountedFee;
    semesterFee.scholarshipDiscount = scholarshipDiscount;
    semesterFee.discountedFee = totalDiscountedFee;
    
    const installmentAmount = Math.round(totalDiscountedFee / 2);
    semesterFee.installments.forEach(installment => {
      if (installment.status === 'pending') {
        installment.amount = installmentAmount;
      }
    });
    
    semesterFee.currentPayableAmount = totalDiscountedFee + semesterFee.totalFineAmount + semesterFee.totalReadmissionFee;
    
    console.log(` Semester ${semesterFee.semester}: Original ${originalTotal} -> Discounted ${totalDiscountedFee} (${scholarshipDiscount} discount)`);
  });
  
  console.log(` Scholarship ${scholarshipPercentage}% applied successfully to ${this.studentId}`);
};

StudentFeeSchema.pre('save', function(next) {
  try {
    console.log(' Calculating fee totals for student:', this.studentId);
    
    if (!Array.isArray(this.invoices)) {
      this.invoices = [];
    } else {
      this.invoices = this.invoices.filter(inv => 
        inv && inv.invoiceNumber && typeof inv.invoiceNumber === 'string' && inv.invoiceNumber.trim() !== ''
      );
    }

    let totalDiscountedDegreeFee = 0;
    let totalOriginalDegreeFee = 0;
    let totalScholarshipDiscount = 0;
    let totalAcademicPaid = 0;
    let totalFineAmount = 0;
    let totalReadmissionFee = 0;
    let totalFinePaid = 0;
    let totalReadmissionFeePaid = 0;

    this.semesterFees.forEach(semester => {
      semester.totalFineAmount = semester.installments.reduce((sum, inst) => sum + (inst.fineAmount || 0), 0);
      semester.totalReadmissionFee = semester.installments.reduce((sum, inst) => sum + (inst.readmissionFee || 0), 0);
      semester.currentPayableAmount = semester.totalFee + semester.totalFineAmount + semester.totalReadmissionFee;
      
      totalDiscountedDegreeFee += semester.totalFee; 
      totalOriginalDegreeFee += semester.originalTotalFee; 
      totalScholarshipDiscount += semester.scholarshipDiscount;
      totalFineAmount += semester.totalFineAmount;
      totalReadmissionFee += semester.totalReadmissionFee;

      const semesterPaid = semester.installments.reduce((paid, inst) => {
        if (inst.status === 'paid' || inst.status === 'fine_applied' || inst.status === 'readmission_required') {
          return paid + (inst.amountPaid || 0);
        }
        return paid;
      }, 0);
      
      totalAcademicPaid += semesterPaid;

      totalFinePaid += semester.installments.reduce((paid, inst) => 
        inst.finePaid ? paid + (inst.fineAmount || 0) : paid, 0
      );
      
      totalReadmissionFeePaid += semester.installments.reduce((paid, inst) => 
        inst.readmissionFeePaid ? paid + (inst.readmissionFee || 0) : paid, 0
      );
    });

    this.totalDegreeFee = totalOriginalDegreeFee; 
    this.totalPaid = totalAcademicPaid;
    
    this.totalDue = Math.max(0, totalDiscountedDegreeFee - this.totalPaid);
    
    this.totalFineAmount = totalFineAmount;
    this.totalFinePaid = totalFinePaid;
    this.totalFineDue = Math.max(0, this.totalFineAmount - this.totalFinePaid);
    
    this.totalReadmissionFee = totalReadmissionFee;
    this.totalReadmissionFeePaid = totalReadmissionFeePaid;
    this.totalReadmissionFeeDue = Math.max(0, this.totalReadmissionFee - this.totalReadmissionFeePaid);
    
    this.totalPayableAmount = totalDiscountedDegreeFee + this.totalFineAmount + this.totalReadmissionFee;
    this.totalAmountPaid = this.totalPaid + this.totalFinePaid + this.totalReadmissionFeePaid;
    this.totalAmountDue = this.totalDue + this.totalFineDue + this.totalReadmissionFeeDue;

    console.log(' FINAL TOTALS WITH SCHOLARSHIP:', {
      studentId: this.studentId,
      scholarshipPercentage: `${this.scholarshipPercentage}%`,
      originalTotal: totalOriginalDegreeFee,
      totalScholarshipDiscount,
      discountedTotal: totalDiscountedDegreeFee,
      totalPaid: this.totalPaid,
      totalDue: this.totalDue,
      netPayable: totalDiscountedDegreeFee - this.totalPaid,
      totalAmountDue: this.totalAmountDue
    });

    if (this.totalReadmissionFeeDue > 0) {
      this.status = 'readmission_required';
    } else if (this.totalFineDue > 0) {
      this.status = 'overdue';
    } else if (this.totalDue === 0) {
      this.status = 'completed';
    } else {
      this.status = 'active';
    }
    
    this.updatedAt = new Date();
    next();
    
  } catch (error) {
    console.error(' Error in pre-save hook:', error);
    next(error);
  }
});
StudentFeeSchema.methods.calculateOverallStatus = function() {
  const hasFrozenSemesters = this.semesterFees.some(sf => sf.status === 'frozen');
  const hasReadmissionDue = this.totalReadmissionFeeDue > 0;
  const hasFineDue = this.totalFineDue > 0;
  const hasAmountDue = this.totalAmountDue > 0;

  if (hasFrozenSemesters) {
    return 'frozen';
  } else if (hasReadmissionDue) {
    return 'readmission_required';
  } else if (hasFineDue) {
    return 'overdue';
  } else if (hasAmountDue === 0) {
    return 'completed';
  } else {
    return 'active';
  }
};

StudentFeeSchema.methods.calculateTotals = function() {
  
  let totalDegreeFee = 0;
  let totalPaid = 0;
  let totalFineAmount = 0;
  let totalReadmissionFee = 0;

  this.semesterFees.forEach(semester => {
    totalDegreeFee += semester.originalTotalFee || 0;
    totalPaid += semester.installments.reduce((sum, inst) => 
      sum + (inst.amountPaid || 0), 0
    );
    totalFineAmount += semester.installments.reduce((sum, inst) => 
      sum + (inst.fineAmount || 0), 0
    );
    totalReadmissionFee += semester.installments.reduce((sum, inst) => 
      sum + (inst.readmissionFee || 0), 0
    );
  });

  this.totalDegreeFee = totalDegreeFee;
  this.totalPaid = totalPaid;
  this.totalDue = Math.max(0, totalDegreeFee - totalPaid);
  this.totalFineAmount = totalFineAmount;
  this.totalReadmissionFee = totalReadmissionFee;
  this.totalPayableAmount = totalDegreeFee + totalFineAmount + totalReadmissionFee;
  this.totalAmountDue = this.totalDue + this.totalFineAmount + this.totalReadmissionFee;
};
StudentFeeSchema.methods.unfreezeSemesterFeesWithTransfer = async function(
  semesterNumber, 
  newBatch, 
  newFeeStructure, 
  reason = 'Academic continuation',
  session = null
) {
  try {
    console.log(` Unfreezing fees for semester ${semesterNumber} with batch transfer to ${newBatch.batchName}`);
    
    const semesterFee = this.semesterFees.find(sf => sf.semester === semesterNumber);
    if (!semesterFee) {
      throw new Error(`No fee record found for semester ${semesterNumber}`);
    }

    if (semesterFee.status !== 'frozen') {
      throw new Error(`Semester ${semesterNumber} fees are not frozen`);
    }

    const newSemesterFeeData = newFeeStructure.semesterBreakdown.find(s => s.semester === semesterNumber);
    if (!newSemesterFeeData) {
      throw new Error(`No fee structure found for semester ${semesterNumber} in batch ${newBatch.batchName}`);
    }

    const newSemesterBaseFee = newFeeStructure.semesterBaseFees && newFeeStructure.semesterBaseFees.get(semesterNumber.toString()) 
      ? newFeeStructure.semesterBaseFees.get(semesterNumber.toString()).totalBaseFee
      : newFeeStructure.masterBaseFee.totalBaseFee;

    const newCourseFee = newSemesterFeeData.courseFee;
    const newOriginalTotal = newSemesterBaseFee + newCourseFee;

    const scholarshipPercentage = this.scholarshipPercentage || 0;
    
    const newSemesterFeeConfig = newFeeStructure.semesterBaseFees && newFeeStructure.semesterBaseFees.get(semesterNumber.toString()) 
      ? newFeeStructure.semesterBaseFees.get(semesterNumber.toString())
      : newFeeStructure.masterBaseFee;

    const discountedTuition = Math.round(newSemesterFeeConfig.tuitionFee * (1 - scholarshipPercentage / 100));
    const discountedCourseFee = Math.round(newCourseFee * (1 - scholarshipPercentage / 100));
    
    const discountedBaseFee = discountedTuition + newSemesterFeeConfig.miscellaneousFee + 
                            newSemesterFeeConfig.examFee + newSemesterFeeConfig.libraryFee + newSemesterFeeConfig.labFee;
    
    const totalDiscountedFee = discountedBaseFee + discountedCourseFee;
    const scholarshipDiscount = newOriginalTotal - totalDiscountedFee;

    semesterFee.originalBaseFee = newSemesterBaseFee;
    semesterFee.originalCourseFee = newCourseFee;
    semesterFee.originalTotalFee = newOriginalTotal;
    semesterFee.tuitionFee = discountedTuition;
    semesterFee.courseFees = discountedCourseFee;
    semesterFee.fixedFees = newSemesterFeeConfig.examFee + newSemesterFeeConfig.libraryFee + newSemesterFeeConfig.labFee;
    semesterFee.totalFee = totalDiscountedFee;
    semesterFee.scholarshipDiscount = scholarshipDiscount;
    semesterFee.discountedFee = totalDiscountedFee;
    semesterFee.currentPayableAmount = totalDiscountedFee + semesterFee.totalFineAmount + semesterFee.totalReadmissionFee;

    semesterFee.status = 'pending';
    semesterFee.unfrozenAt = new Date();
    semesterFee.unfreezeReason = reason;
    semesterFee.transferredFromBatch = this.batch;
    semesterFee.transferredToBatch = newBatch.batchName;
    semesterFee.transferDate = new Date();

    const academicSemester = newBatch.academicCalendar?.find(s => s.semester === semesterNumber);
    
    if (academicSemester && academicSemester.midtermStart && academicSemester.finalStart) {
      const firstInstallmentDueDate = addDays(new Date(academicSemester.midtermStart), -21);
      const secondInstallmentDueDate = addDays(new Date(academicSemester.finalStart), -28);

      const installmentAmount = Math.round(totalDiscountedFee / 2);

      semesterFee.installments = [
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
          invoiceGenerated: false
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
          invoiceGenerated: false
        }
      ];
    }

    this.batch = newBatch.batchName;
    this.currentSemester = semesterNumber;

    this.status = this.calculateOverallStatus();
    
    const saveOptions = session ? { session } : {};
    await this.save(saveOptions);

    console.log(` Fees unfrozen and transferred to batch ${newBatch.batchName} for semester ${semesterNumber}`);

    return {
      success: true,
      message: `Fees unfrozen and transferred to ${newBatch.batchName}`,
      data: {
        semester: semesterNumber,
        newBatch: newBatch.batchName,
        originalBatch: semesterFee.transferredFromBatch,
        newTotalFee: semesterFee.totalFee,
        unfrozenAt: semesterFee.unfrozenAt,
        newInstallments: semesterFee.installments.length
      }
    };

  } catch (error) {
    console.error(` Error unfreezing fees for semester ${semesterNumber}:`, error);
    throw error;
  }
};
StudentFeeSchema.methods.freezeSemesterFees = async function(semesterNumber, reason = 'Academic freeze', session = null) {
  try {
    console.log(`Freezing fees for semester ${semesterNumber}: ${reason}`);
    
    const semesterFee = this.semesterFees.find(sf => sf.semester === semesterNumber);
    if (!semesterFee) {
      throw new Error(`No fee record found for semester ${semesterNumber}`);
    }

    semesterFee.status = 'frozen';
    semesterFee.frozenAt = new Date();
    semesterFee.freezeReason = reason;
    
    semesterFee.installments.forEach(installment => {
      if (installment.status === 'pending') {
        installment.status = 'frozen';
        installment.frozenAt = new Date();
      }
    });

    this.status = this.calculateOverallStatus();
    
    const saveOptions = session ? { session } : {};
    await this.save(saveOptions);

    console.log(` Fees frozen for semester ${semesterNumber}`);

    return {
      success: true,
      message: `Fees frozen for semester ${semesterNumber}`,
      data: {
        semester: semesterNumber,
        frozenAt: semesterFee.frozenAt,
        frozenInstallments: semesterFee.installments.filter(inst => inst.status === 'frozen').length
      }
    };

  } catch (error) {
    console.error(` Error freezing fees for semester ${semesterNumber}:`, error);
    throw error;
  }
};
StudentFeeSchema.methods.adjustFeeForDroppedCourse = async function(courseCode, semesterNumber, creditHrs, session = null) {
  try {
    console.log(` Adjusting fees for dropped course: ${courseCode}, Semester: ${semesterNumber}, Credits: ${creditHrs}`);
    
    const semesterFee = this.semesterFees.find(sf => sf.semester === semesterNumber);
    if (!semesterFee) {
      throw new Error(`No fee record found for semester ${semesterNumber}`);
    }

    const courseFeePerCredit = semesterFee.originalCourseFee / (this.getTotalCreditsForSemester(semesterNumber) || creditHrs);
    const feeToDeduct = Math.round(courseFeePerCredit * creditHrs);
    
    console.log(`Course fee calculation:`, {
      originalCourseFee: semesterFee.originalCourseFee,
      courseFeePerCredit,
      creditHrs,
      feeToDeduct
    });

    const originalCourseFee = semesterFee.courseFees;
    const originalTotalFee = semesterFee.totalFee;
    const originalDiscountedFee = semesterFee.discountedFee;

    semesterFee.courseFees = Math.max(0, semesterFee.courseFees - feeToDeduct);
    semesterFee.totalFee = semesterFee.tuitionFee + semesterFee.courseFees + semesterFee.fixedFees;
    semesterFee.discountedFee = semesterFee.totalFee;
    semesterFee.currentPayableAmount = semesterFee.totalFee + semesterFee.totalFineAmount + semesterFee.totalReadmissionFee;

    const adjustmentRatio = semesterFee.totalFee / (originalTotalFee || semesterFee.totalFee);
    
    semesterFee.installments.forEach(installment => {
      if (installment.status === 'pending') {
        installment.amount = Math.round(installment.amount * adjustmentRatio);
      }
    });

    if (!semesterFee.droppedCourses) {
      semesterFee.droppedCourses = [];
    }
    
    semesterFee.droppedCourses.push({
      courseCode,
      creditHrs,
      originalCourseFee: feeToDeduct,
      adjustedCourseFee: 0,
      adjustmentDate: new Date(),
      adjustmentType: 'drop'
    });

    console.log(` Fee adjustment completed:`, {
      semester: semesterNumber,
      courseCode,
      originalCourseFee: originalCourseFee,
      newCourseFee: semesterFee.courseFees,
      originalTotalFee: originalTotalFee,
      newTotalFee: semesterFee.totalFee,
      feeReduction: feeToDeduct
    });

    await this.calculateTotals();
    
    const saveOptions = session ? { session } : {};
    await this.save(saveOptions);

    return {
      success: true,
      message: `Fee adjusted for dropped course ${courseCode}`,
      data: {
        courseCode,
        semester: semesterNumber,
        feeReduction: feeToDeduct,
        originalTotalFee: originalTotalFee,
        newTotalFee: semesterFee.totalFee,
        originalDiscountedFee,
        newDiscountedFee: semesterFee.discountedFee
      }
    };

  } catch (error) {
    console.error(` Error adjusting fee for dropped course ${courseCode}:`, error);
    throw error;
  }
};

StudentFeeSchema.methods.getTotalCreditsForSemester = function(semesterNumber) {

  const defaultCredits = {
    1: 18, 2: 18, 3: 18, 4: 18, 5: 17, 6: 17, 7: 15, 8: 12
  };
  return defaultCredits[semesterNumber] || 18;
};
module.exports = mongoose.model('StudentFee', StudentFeeSchema);