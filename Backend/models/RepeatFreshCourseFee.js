const mongoose = require('mongoose');

const repeatFreshCourseFeeSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    ref: 'Student'
  },
  studentName: {
    type: String,
    required: true
  },
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
  currentSemester: {
    type: Number,
    required: true
  },
  section: {
    type: String,
    required: true
  },
  courseType: {
    type: String,
    enum: ['repeat', 'fresh'],
    required: true
  },
  courseName: {
    type: String,
    required: true
  },
  courseCode: {
    type: String
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  dueDate: {
    type: Date,
    required: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  paidDate: {
    type: Date
  },
  paymentHistory: [{
    amount: Number,
    paymentDate: Date,
    paymentMethod: String,
    transactionId: String,
    recordedBy: String
  }],
  description: {
    type: String
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

repeatFreshCourseFeeSchema.statics.generateInvoiceNumber = function() {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CRS-${timestamp.slice(-6)}-${random}`;
};

repeatFreshCourseFeeSchema.methods.checkOverdue = function() {
  if (this.paymentStatus === 'pending' && new Date() > this.dueDate) {
    this.paymentStatus = 'overdue';
    return true;
  }
  return false;
};

repeatFreshCourseFeeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  this.checkOverdue();
  
  if (this.amountPaid >= this.amount) {
    this.paymentStatus = 'paid';
    if (!this.paidDate) {
      this.paidDate = new Date();
    }
  }
  
  next();
});

module.exports = mongoose.model('RepeatFreshCourseFee', repeatFreshCourseFeeSchema);