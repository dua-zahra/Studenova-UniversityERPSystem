const mongoose = require('mongoose');

const studentPaymentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue'],
    default: 'pending'
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  paidDate: Date,
  transactionId: String,
  paymentMethod: String,
  invoiceNumber: {
    type: String,
    unique: true
  },
  qrCodeData: String
});

const eventPaymentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  eventTime: {
    type: String,
    required: true,
    trim: true
  },
  eventPlace: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  eventDate: {
    type: Date,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  batch: {
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
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  createdBy: {
    type: String,
    required: true
  },
  studentPayments: [studentPaymentSchema],
  totalStudents: {
    type: Number,
    default: 0
  },
  paidStudents: {
    type: Number,
    default: 0
  },
  totalCollected: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

eventPaymentSchema.statics.generateInvoiceNumber = function() {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `EVT-${timestamp.slice(-6)}-${random}`;
};

eventPaymentSchema.statics.generateQRCodeData = function(eventData, studentId, invoiceNumber) {
  const qrData = {
    studentId: studentId,
    invoiceNumber: invoiceNumber,
    amount: eventData.amount,
    eventTitle: eventData.title,
    dueDate: eventData.dueDate,
    type: 'event_payment'
  };
  
  if (eventData._id) {
    qrData.eventId = eventData._id.toString();
  }
  
  return JSON.stringify(qrData);
};

eventPaymentSchema.index({ batch: 1, status: 1 });
eventPaymentSchema.index({ dueDate: 1 });
eventPaymentSchema.index({ eventDate: 1 });

module.exports = mongoose.model('EventPayment', eventPaymentSchema);