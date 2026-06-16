const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  expenseTitle: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  paidDate: {
    type: Date
  },
  qrCodeData: {
    type: String
  },
  paymentHistory: [{
    amount: Number,
    paymentDate: Date,
    paymentMethod: String,
    transactionId: String,
    recordedBy: String
  }]
});

const expenseSchema = new mongoose.Schema({
  degreeLevel: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  batch: {
    type: String,
    required: true
  },
  
  studentId: {
    type: String,
    required: true,
    ref: 'Student'
  },
  studentName: {
    type: String,
    required: true
  },
  currentSemester: {
    type: Number,
    required: true
  },
  section: {
    type: String,
    required: true
  },
  
  expenseConfigurations: [{
    expenseTitle: {
      type: String,
      required: true,
      enum: ['bus', 'hostel', 'sports', 'society', 'fine', 'library']
    },
    durationInMonths: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    paymentDueDate: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active'
    },
    calculatedAmount: {
      type: Number,
      default: 0
    },
    invoiceNumber: {
      type: String,
      unique: true
    }
  }],
  
  invoices: [invoiceSchema],
  
  transportDetails: {
    routeName: String,
    busStop: String,
    vehicleNumber: String,
    driverName: String,
    contactNumber: String,
    monthlyFee: { type: Number, default: 0 }
  },
  
  hostelDetails: {
    hostelName: String,
    roomNumber: String,
    roomType: {
      type: String,
      enum: ['single', 'double', 'triple', 'dormitory']
    },
    monthlyRent: { type: Number, default: 0 },
    monthlyMessCharges: { type: Number, default: 0 },
    amenities: [String]
  },
  
  sportsDetails: {
    activityName: String,
    coachName: String,
    equipmentProvided: [String],
    trainingSchedule: String,
    membershipType: {
      type: String,
      enum: ['basic', 'premium', 'vip']
    },
    monthlyFee: { type: Number, default: 0 }
  },
  
  societyDetails: {
    societyName: String,
    eventName: String,
    eventType: String,
    organizer: String,
    venue: String,
    participationType: {
      type: String,
      enum: ['individual', 'team']
    },
    fee: { type: Number, default: 0 }
  },
  
  fineDetails: {
    reason: String,
    fineType: {
      type: String,
      enum: ['late_fee', 'damage', 'disciplinary', 'other']
    },
    applicableRule: String,
    issuedBy: String,
    amount: { type: Number, default: 0 }
  },
  
  libraryDetails: {
    membershipType: {
      type: String,
      enum: ['basic', 'premium', 'research']
    },
    monthlyFee: { type: Number, default: 0 },
    maxBooks: Number
  },
  
  totalAmount: {
    type: Number,
    required: true
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
    createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

expenseSchema.statics.generateInvoiceNumber = function() {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${timestamp.slice(-6)}-${random}`;
};

expenseSchema.statics.checkDuplicateExpense = async function(studentId, newExpenseConfigurations) {
  const existingExpense = await this.findOne({
    studentId: studentId,
    status: 'active'
  });

  if (!existingExpense) {
    return { isDuplicate: false };
  }

  const conflicts = [];

  for (const newConfig of newExpenseConfigurations) {
    const newStart = new Date(newConfig.startDate);
    const newEnd = new Date(newConfig.endDate);
    
    const existingConfigs = existingExpense.expenseConfigurations.filter(existing => 
      existing.expenseTitle === newConfig.expenseTitle && 
      existing.status === 'active'
    );

    for (const existingConfig of existingConfigs) {
      const existingStart = new Date(existingConfig.startDate);
      const existingEnd = new Date(existingConfig.endDate);

      const hasOverlap = (
        (newStart >= existingStart && newStart <= existingEnd) ||
        (newEnd >= existingStart && newEnd <= existingEnd) ||
        (newStart <= existingStart && newEnd >= existingEnd)
      );

      if (hasOverlap) {
        conflicts.push({
          expenseTitle: newConfig.expenseTitle,
          newPeriod: `${newStart.toDateString()} to ${newEnd.toDateString()}`,
          existingPeriod: `${existingStart.toDateString()} to ${existingEnd.toDateString()}`,
          message: `Student already has ${newConfig.expenseTitle} expense for overlapping period`
        });
      }
    }
  }

  if (conflicts.length > 0) {
    return {
      isDuplicate: true,
      conflicts: conflicts
    };
  }

  return { isDuplicate: false };
};

expenseSchema.statics.findOrCreateForStudent = async function(studentData, newExpenseConfigurations, expenseDetails) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let expense = await this.findOne({
      studentId: studentData.studentId,
      status: 'active'
    }).session(session);

    const processedConfigurations = newExpenseConfigurations.map(config => ({
      ...config,
      startDate: new Date(config.startDate),
      endDate: new Date(config.endDate),
      paymentDueDate: new Date(config.paymentDueDate),
      invoiceNumber: this.generateInvoiceNumber()
    }));

    if (expense) {
      Object.keys(expenseDetails).forEach(key => {
        if (expenseDetails[key] && Object.keys(expenseDetails[key]).length > 0) {
          if (!expense[key]) {
            expense[key] = expenseDetails[key];
          } else {
            expense[key] = { 
              ...expense[key], 
              ...expenseDetails[key] 
            };
          }
        }
      });

      this.ensureExpenseDetailsHaveDefaults(expense);

      expense.calculateAmounts();

      for (const newConfig of processedConfigurations) {
        const newStartTime = newConfig.startDate.getTime();
        const newEndTime = newConfig.endDate.getTime();
        
        const isExactDuplicate = expense.expenseConfigurations.some(existing => {
          const existingStartTime = existing.startDate.getTime();
          const existingEndTime = existing.endDate.getTime();
          
          return (
            existing.expenseTitle === newConfig.expenseTitle &&
            existingStartTime === newStartTime &&
            existingEndTime === newEndTime &&
            existing.durationInMonths === newConfig.durationInMonths
          );
        });

        if (!isExactDuplicate) {
          const calculatedAmount = expense.calculateExpenseAmount(
            newConfig.expenseTitle, 
            newConfig.durationInMonths
          );

          const configWithAmount = {
            ...newConfig,
            status: 'active',
            calculatedAmount: calculatedAmount
          };

          expense.expenseConfigurations.push(configWithAmount);

          const invoice = this.createIndividualInvoice(expense, configWithAmount);
          expense.invoices.push(invoice);
        }
      }

    } else {
      expense = new this({
        ...studentData,
        ...expenseDetails,
        createdBy: 'admin',
        status: 'active'
      });

      this.ensureExpenseDetailsHaveDefaults(expense);

      const configurationsWithAmounts = processedConfigurations.map(config => {
        const calculatedAmount = expense.calculateExpenseAmount(
          config.expenseTitle, 
          config.durationInMonths
        );
        
        return {
          ...config,
          status: 'active',
          calculatedAmount: calculatedAmount
        };
      });

      expense.expenseConfigurations = configurationsWithAmounts;

      expense.invoices = configurationsWithAmounts.map(config => 
        this.createIndividualInvoice(expense, config)
      );
    }

    expense.totalAmount = expense.expenseConfigurations.reduce(
      (total, config) => total + (config.calculatedAmount || 0), 0
    );
    
    await expense.save({ session });
    await session.commitTransaction();

    return expense;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

expenseSchema.statics.createIndividualInvoice = function(expense, config) {
  const invoiceNumber = config.invoiceNumber || this.generateInvoiceNumber();
  
  const amount = config.calculatedAmount || 0;
  
  const qrData = JSON.stringify({
    studentId: expense.studentId,
    invoiceNumber: invoiceNumber,
    amount: amount,
    expenseTitle: config.expenseTitle,
    dueDate: config.paymentDueDate
  });

  return {
    invoiceNumber: invoiceNumber,
    expenseTitle: config.expenseTitle,
    description: this.getExpenseLabel(config.expenseTitle),
    amount: amount, 
    dueDate: config.paymentDueDate,
    qrCodeData: qrData,
    paymentStatus: 'pending'
  };
};


expenseSchema.methods.calculateExpenseAmount = function(expenseTitle, durationInMonths) {
  let amount = 0;
  
  switch(expenseTitle) {
    case 'bus':
      const transportFee = this.transportDetails?.monthlyFee;
      amount = (transportFee !== undefined && transportFee !== null ? transportFee : 2000) * durationInMonths;
      break;
    case 'hostel':
      const rent = this.hostelDetails?.monthlyRent !== undefined ? this.hostelDetails.monthlyRent : 8000;
      const mess = this.hostelDetails?.monthlyMessCharges !== undefined ? this.hostelDetails.monthlyMessCharges : 5000;
      amount = (rent + mess) * durationInMonths;
      break;
    case 'sports':
      const sportsFee = this.sportsDetails?.monthlyFee;
      amount = (sportsFee !== undefined && sportsFee !== null ? sportsFee : 1000) * durationInMonths;
      break;
    case 'society':
      const societyFee = this.societyDetails?.fee;
      amount = societyFee !== undefined && societyFee !== null ? societyFee : 500;
      break;
    case 'fine':
      const fineAmount = this.fineDetails?.amount;
      amount = fineAmount !== undefined && fineAmount !== null ? fineAmount : 0;
      break;
    case 'library':
      const libraryFee = this.libraryDetails?.monthlyFee;
      amount = (libraryFee !== undefined && libraryFee !== null ? libraryFee : 500) * durationInMonths;
      break;
    default:
      amount = 0;
  }
  
  return amount;
};

expenseSchema.methods.calculateAmounts = function() {
  this.expenseConfigurations.forEach(config => {
    config.calculatedAmount = this.calculateExpenseAmount(
      config.expenseTitle, 
      config.durationInMonths
    );
  });

  this.invoices.forEach(invoice => {
    const correspondingConfig = this.expenseConfigurations.find(
      config => config.invoiceNumber === invoice.invoiceNumber
    );
    if (correspondingConfig) {
      invoice.amount = correspondingConfig.calculatedAmount;
    }
  });

  this.totalAmount = this.expenseConfigurations.reduce(
    (total, config) => total + (config.calculatedAmount || 0), 0
  );
};

expenseSchema.statics.getExpenseLabel = function(expenseType) {
  const labels = {
    'bus': 'Transport Fee',
    'hostel': 'Hostel Charges',
    'sports': 'Sports Activity',
    'society': 'Society Participation',
    'fine': 'Fine/Penalty',
    'library': 'Library Management'
  };
  return labels[expenseType] || expenseType;
};

expenseSchema.methods.cleanEmptyDetails = function() {
  const expenseDetailsFields = ['transportDetails', 'hostelDetails', 'sportsDetails', 'societyDetails', 'fineDetails', 'libraryDetails'];
  
  expenseDetailsFields.forEach(field => {
    if (this[field]) {
      const details = this[field];
      const hasData = Object.values(details).some(value => {
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'number') return value > 0;
        return value && value !== '';
      });
      
      if (!hasData) {
        this[field] = undefined;
      }
    }
  });
};
expenseSchema.statics.ensureExpenseDetailsHaveDefaults = function(expense) {
  const expenseTypes = [
    'transportDetails',
    'hostelDetails', 
    'sportsDetails',
    'societyDetails',
    'fineDetails',
    'libraryDetails'
  ];

  expenseTypes.forEach(detailType => {
    if (!expense[detailType]) {
      expense[detailType] = {};
    }
    
    switch(detailType) {
      case 'transportDetails':
        if (expense.transportDetails.monthlyFee === undefined || expense.transportDetails.monthlyFee === null) {
          expense.transportDetails.monthlyFee = 2000;
        }
        break;
      case 'hostelDetails':
        if (expense.hostelDetails.monthlyRent === undefined || expense.hostelDetails.monthlyRent === null) {
          expense.hostelDetails.monthlyRent = 8000;
        }
        if (expense.hostelDetails.monthlyMessCharges === undefined || expense.hostelDetails.monthlyMessCharges === null) {
          expense.hostelDetails.monthlyMessCharges = 5000;
        }
        break;
      case 'sportsDetails':
        if (expense.sportsDetails.monthlyFee === undefined || expense.sportsDetails.monthlyFee === null) {
          expense.sportsDetails.monthlyFee = 1000;
        }
        break;
      case 'societyDetails':
        if (expense.societyDetails.fee === undefined || expense.societyDetails.fee === null) {
          expense.societyDetails.fee = 500;
        }
        break;
      case 'fineDetails':
        if (expense.fineDetails.amount === undefined || expense.fineDetails.amount === null) {
          expense.fineDetails.amount = 0;
        }
        break;
      case 'libraryDetails':
        if (expense.libraryDetails.monthlyFee === undefined || expense.libraryDetails.monthlyFee === null) {
          expense.libraryDetails.monthlyFee = 500;
        }
        break;
    }
  });
};
expenseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  this.cleanEmptyDetails();
  
  if (this.isModified('expenseConfigurations') || 
      this.isModified('transportDetails') || this.isModified('hostelDetails') ||
      this.isModified('sportsDetails') || this.isModified('societyDetails') ||
      this.isModified('fineDetails') || this.isModified('libraryDetails')) {
    
    this.constructor.ensureExpenseDetailsHaveDefaults(this);
    this.calculateAmounts();
  }
  
  if (this.amountPaid >= this.totalAmount) {
    this.paymentStatus = 'paid';
  } else {
    const now = new Date();
    const hasOverdue = this.expenseConfigurations.some(config => 
      config.paymentDueDate < now && this.paymentStatus !== 'paid'
    );
    
    if (hasOverdue) {
      this.paymentStatus = 'overdue';
    } else {
      this.paymentStatus = 'pending';
    }
  }
  
  this.invoices.forEach(invoice => {
    const correspondingConfig = this.expenseConfigurations.find(
      config => config.invoiceNumber === invoice.invoiceNumber
    );
    if (correspondingConfig) {
      invoice.amount = correspondingConfig.calculatedAmount;
    }
  });
  
  next();
});

module.exports = mongoose.model('UniversityExpense', expenseSchema);


