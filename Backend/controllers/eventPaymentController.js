const EventPayment = require('../models/EventPayment');
const Batch = require('../models/Batch');
const Student = require('../models/Student');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

exports.createEventPayment = async (req, res) => {
  try {
    const {
      title,
      eventTime,
      eventPlace,
      amount,
      eventDate,
      dueDate,
      batch,
      degreeLevel,
      department
    } = req.body;

    if (!title || !eventTime || !eventPlace || !amount || !eventDate || !dueDate || !batch || !degreeLevel || !department) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i;
    if (!timeRegex.test(eventTime)) {
      return res.status(400).json({
        success: false,
        message: 'Event time must be in HH:MM AM/PM format (e.g., 02:30 PM)'
      });
    }

    if (amount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    const eventDateObj = new Date(eventDate);
    const dueDateObj = new Date(dueDate);
    const currentDate = new Date();

    if (eventDateObj < currentDate) {
      return res.status(400).json({
        success: false,
        message: 'Event date cannot be in the past'
      });
    }

    if (dueDateObj < currentDate) {
      return res.status(400).json({
        success: false,
        message: 'Due date cannot be in the past'
      });
    }

    if (dueDateObj > eventDateObj) {
      return res.status(400).json({
        success: false,
        message: 'Due date cannot be after event date'
      });
    }

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

    const studentIds = [];
    if (batchInfo.sections && batchInfo.sections.length > 0) {
      batchInfo.sections.forEach(section => {
        if (section.students && section.students.length > 0) {
          section.students.forEach(student => {
            if (student.status === 'active') {
              studentIds.push(student.studentId);
            }
          });
        }
      });
    }

    if (studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active students found in the selected batch'
      });
    }

    const eventPayment = new EventPayment({
      title,
      eventTime,
      eventPlace,
      amount,
      eventDate: new Date(eventDate),
      dueDate: new Date(dueDate),
      batch,
      degreeLevel,
      department,
      createdBy: req.user?.id || 'admin',
      totalStudents: studentIds.length
    });

    await eventPayment.save();

    const studentPayments = studentIds.map((studentId) => {
      const invoiceNumber = EventPayment.generateInvoiceNumber();
      
      const qrCodeData = JSON.stringify({
        eventId: eventPayment._id.toString(), 
        studentId: studentId,
        invoiceNumber: invoiceNumber,
        amount: eventPayment.amount,
        eventTitle: eventPayment.title,
        dueDate: eventPayment.dueDate.toISOString(),
        type: 'event_payment'
      });

      return {
        studentId,
        status: 'pending',
        invoiceNumber,
        qrCodeData
      };
    });

    eventPayment.studentPayments = studentPayments;
    await eventPayment.save();

    res.status(201).json({
      success: true,
      message: 'Event payment created successfully with invoices for all students',
      data: {
        ...eventPayment.toObject(),
        invoicesGenerated: studentPayments.length
      }
    });

  } catch (error) {
    console.error('Error creating event payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create event payment: ' + error.message
    });
  }
};

exports.generateEventInvoice = async (req, res) => {
  try {
    const { id, studentId } = req.params;

    const eventPayment = await EventPayment.findById(id);
    if (!eventPayment) {
      return res.status(404).json({
        success: false,
        message: 'Event payment not found'
      });
    }

    const studentPayment = eventPayment.studentPayments.find(
      sp => sp.studentId === studentId
    );

    if (!studentPayment) {
      return res.status(404).json({
        success: false,
        message: 'Student not found in this event payment'
      });
    }

    const student = await Student.findOne({ studentId })
      .select('studentId firstName lastName currentSemester section universityEmail');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student details not found'
      });
    }

    if (studentPayment.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot download invoice for paid payment'
      });
    }

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=event-invoice-${studentPayment.invoiceNumber}.pdf`);
    
    doc.pipe(res);

    const addText = (text, x, y, options = {}) => {
      doc.fontSize(options.size || 10)
         .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(text, x, y, options);
    };

    addText('Superior University', 50, 50, { size: 20, bold: true });
    addText('EVENT PAYMENT INVOICE', 50, 75, { size: 16, bold: true });
    
    addText('Superior University', 50, 110);
    addText('Lahore, Pakistan', 50, 125);
    addText('Phone: +92 312343212', 50, 140);
    addText('Email: admin@superioruniversity.com', 50, 155);

    addText(`Invoice #: ${studentPayment.invoiceNumber}`, 350, 110, { bold: true });
    addText(`Issue Date: ${new Date().toLocaleDateString()}`, 350, 125);
    addText(`Due Date: ${eventPayment.dueDate.toLocaleDateString()}`, 350, 140);
    addText(`Status: ${studentPayment.status.toUpperCase()}`, 350, 155, { 
      color: studentPayment.status === 'overdue' ? 'red' : 'black'
    });

    doc.moveTo(50, 180).lineTo(550, 180).stroke();
    addText('STUDENT INFORMATION', 50, 190, { size: 14, bold: true });
    
    addText(`Student ID: ${student.studentId}`, 50, 220);
    addText(`Name: ${student.firstName} ${student.lastName}`, 50, 235);
    addText(`Semester: ${student.currentSemester}`, 50, 250);
    addText(`Section: ${student.section || 'N/A'}`, 50, 265);
    
    addText(`Degree: ${eventPayment.degreeLevel}`, 250, 220);
    addText(`Department: ${eventPayment.department}`, 250, 235);
    addText(`Batch: ${eventPayment.batch}`, 250, 250);

    doc.moveTo(50, 300).lineTo(550, 300).stroke();
    addText('EVENT DETAILS', 50, 310, { size: 14, bold: true });
    
    addText(`Event: ${eventPayment.title}`, 50, 340, { bold: true });
    addText(`Date: ${eventPayment.eventDate.toLocaleDateString()}`, 50, 355);
    addText(`Time: ${eventPayment.eventTime}`, 50, 370);
    addText(`Venue: ${eventPayment.eventPlace}`, 50, 385);

    doc.moveTo(50, 420).lineTo(550, 420).stroke();
    addText('PAYMENT DETAILS', 50, 430, { size: 14, bold: true });
    
    addText('Description', 50, 460, { bold: true });
    addText('Amount (Rs.)', 450, 460, { bold: true, align: 'right' });

    doc.moveTo(50, 475).lineTo(550, 475).stroke();

    addText(`Event Payment - ${eventPayment.title}`, 50, 490);
    addText(eventPayment.amount.toLocaleString(), 450, 490, { align: 'right' });

    doc.moveTo(50, 520).lineTo(550, 520).stroke();
    addText('TOTAL AMOUNT', 280, 535, { bold: true });
    addText(`Rs. ${eventPayment.amount.toLocaleString()}`, 450, 535, { bold: true, align: 'right' });

    addText(`Payment Status: ${studentPayment.status.toUpperCase()}`, 50, 565);
    addText(`Amount Paid: Rs. ${studentPayment.paidAmount.toLocaleString()}`, 50, 580);
    addText(`Balance Due: Rs. ${(eventPayment.amount - studentPayment.paidAmount).toLocaleString()}`, 50, 595);

    addText('SCAN TO PAY', 400, 620, { size: 12, bold: true, align: 'center', width: 100 });
    
    try {
      const qrCodeImage = await QRCode.toDataURL(studentPayment.qrCodeData);
      doc.image(qrCodeImage, 400, 640, { width: 80, height: 80 });
    } catch (qrError) {
      console.error('QR Code generation error:', qrError);
      addText('QR Code unavailable', 400, 660, { align: 'center', width: 100 });
    }

    addText('PAYMENT INSTRUCTIONS', 50, 620, { size: 12, bold: true });
    addText('1. Scan QR code or visit payment portal', 50, 640);
    addText('2. Use Invoice Number as reference', 50, 655);
    addText('3. Keep transaction ID for records', 50, 670);
    addText('4. Contact accounts for assistance', 50, 685);
    addText(`5. Due Date: ${eventPayment.dueDate.toLocaleDateString()}`, 50, 700);

    // Footer
    doc.moveTo(50, 730).lineTo(550, 730).stroke();
    addText('Thank you for your prompt payment!', 50, 740, { align: 'center', width: 500 });
    addText('For queries contact: admin@superioruniversity.com | Phone: +92 312343212', 50, 755, { align: 'center', width: 500, size: 8 });

    doc.end();

  } catch (error) {
    console.error('Error generating event invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice: ' + error.message
    });
  }
};

exports.downloadAllEventInvoices = async (req, res) => {
  try {
    const { id } = req.params;

    const eventPayment = await EventPayment.findById(id);
    if (!eventPayment) {
      return res.status(404).json({
        success: false,
        message: 'Event payment not found'
      });
    }

    const studentIds = eventPayment.studentPayments.map(sp => sp.studentId);
    const students = await Student.find({ studentId: { $in: studentIds } })
      .select('studentId firstName lastName currentSemester section');

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=event-${eventPayment._id}-all-invoices.pdf`);
    
    doc.pipe(res);

    const addText = (text, x, y, options = {}) => {
      doc.fontSize(options.size || 10)
         .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(text, x, y, options);
    };

    for (let i = 0; i < eventPayment.studentPayments.length; i++) {
      const studentPayment = eventPayment.studentPayments[i];
      const student = students.find(s => s.studentId === studentPayment.studentId);

      if (i > 0) {
        doc.addPage(); 
      }

      addText('Superior University', 50, 50, { size: 20, bold: true });
      addText('EVENT PAYMENT INVOICE', 50, 75, { size: 16, bold: true });
      
      addText(`Invoice #: ${studentPayment.invoiceNumber}`, 350, 110, { bold: true });
      addText(`Due Date: ${eventPayment.dueDate.toLocaleDateString()}`, 350, 125);
      addText(`Status: ${studentPayment.status.toUpperCase()}`, 350, 140);

      doc.moveTo(50, 180).lineTo(550, 180).stroke();
      addText('STUDENT INFORMATION', 50, 190, { size: 14, bold: true });
      
      addText(`Student ID: ${student?.studentId || studentPayment.studentId}`, 50, 220);
      addText(`Name: ${student ? `${student.firstName} ${student.lastName}` : 'Unknown Student'}`, 50, 235);
      addText(`Semester: ${student?.currentSemester || 'N/A'}`, 50, 250);
      
      addText(`Degree: ${eventPayment.degreeLevel}`, 250, 220);
      addText(`Department: ${eventPayment.department}`, 250, 235);
      addText(`Batch: ${eventPayment.batch}`, 250, 250);

      doc.moveTo(50, 300).lineTo(550, 300).stroke();
      addText('EVENT DETAILS', 50, 310, { size: 14, bold: true });
      
      addText(`Event: ${eventPayment.title}`, 50, 340);
      addText(`Date: ${eventPayment.eventDate.toLocaleDateString()}`, 50, 355);
      addText(`Time: ${eventPayment.eventTime}`, 50, 370);
      addText(`Venue: ${eventPayment.eventPlace}`, 50, 385);

      doc.moveTo(50, 420).lineTo(550, 420).stroke();
      addText('PAYMENT AMOUNT', 280, 435, { bold: true });
      addText(`Rs. ${eventPayment.amount.toLocaleString()}`, 450, 435, { bold: true, align: 'right' });

      addText('SCAN TO PAY', 400, 480, { size: 12, bold: true, align: 'center', width: 100 });
      
      try {
        const qrCodeImage = await QRCode.toDataURL(studentPayment.qrCodeData);
        doc.image(qrCodeImage, 400, 500, { width: 80, height: 80 });
      } catch (qrError) {
        addText('QR Code unavailable', 400, 520, { align: 'center', width: 100 });
      }

      doc.moveTo(50, 650).lineTo(550, 650).stroke();
      addText(`Page ${i + 1} of ${eventPayment.studentPayments.length}`, 50, 660, { align: 'center', width: 500 });
    }

    doc.end();

  } catch (error) {
    console.error('Error generating all event invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoices: ' + error.message
    });
  }
};

exports.recordEventPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, paidAmount, transactionId, paymentMethod, qrCodeData } = req.body;

    let actualStudentId = studentId;
    let actualEventId = id;

    if (qrCodeData) {
      try {
        const qrData = JSON.parse(qrCodeData);
        actualStudentId = qrData.studentId;
        actualEventId = qrData.eventId;
        
        if (actualEventId !== id) {
          return res.status(400).json({
            success: false,
            message: 'QR code does not match this event'
          });
        }
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid QR code data'
        });
      }
    }

    if (!actualStudentId || !paidAmount) {
      return res.status(400).json({
        success: false,
        message: 'Student ID and paid amount are required'
      });
    }

    const eventPayment = await EventPayment.findById(actualEventId);
    if (!eventPayment) {
      return res.status(404).json({
        success: false,
        message: 'Event payment not found'
      });
    }

    const studentPayment = eventPayment.studentPayments.find(
      sp => sp.studentId === actualStudentId
    );

    if (!studentPayment) {
      return res.status(404).json({
        success: false,
        message: 'Student not found in this event payment'
      });
    }

    studentPayment.status = 'paid';
    studentPayment.paidAmount = paidAmount;
    studentPayment.paidDate = new Date();
    studentPayment.transactionId = transactionId;
    studentPayment.paymentMethod = paymentMethod;

    eventPayment.paidStudents = eventPayment.studentPayments.filter(
      sp => sp.status === 'paid'
    ).length;
    eventPayment.totalCollected = eventPayment.studentPayments.reduce(
      (sum, sp) => sum + (sp.paidAmount || 0), 0
    );

    await eventPayment.save();

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        ...studentPayment.toObject(),
        eventTitle: eventPayment.title,
        studentName: actualStudentId 
      }
    });

  } catch (error) {
    console.error('Error recording event payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment: ' + error.message
    });
  }
};


exports.getEventPayments = async (req, res) => {
  try {
    const { batch, degreeLevel, department, status, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (batch) filter.batch = batch;
    if (degreeLevel) filter.degreeLevel = degreeLevel;
    if (department) filter.department = { $regex: new RegExp(department, 'i') };
    if (status) filter.status = status;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };

    const eventPayments = await EventPayment.find(filter)
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .sort(options.sort);

    const total = await EventPayment.countDocuments(filter);

    res.json({
      success: true,
      data: {
        eventPayments,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalRecords: total,
          hasNext: (options.page * options.limit) < total,
          hasPrev: options.page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching event payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event payments'
    });
  }
};

exports.getEventPaymentDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const eventPayment = await EventPayment.findById(id);
    if (!eventPayment) {
      return res.status(404).json({
        success: false,
        message: 'Event payment not found'
      });
    }

    const studentIds = eventPayment.studentPayments.map(sp => sp.studentId);
    const students = await Student.find({ studentId: { $in: studentIds } })
      .select('studentId firstName lastName universityEmail currentSemester');

    const studentPaymentsWithDetails = eventPayment.studentPayments.map(sp => {
      const student = students.find(s => s.studentId === sp.studentId);
      return {
        ...sp.toObject(),
        student: student || { studentId: sp.studentId, firstName: 'Unknown', lastName: 'Student' }
      };
    });

    res.json({
      success: true,
      data: {
        ...eventPayment.toObject(),
        studentPayments: studentPaymentsWithDetails
      }
    });

  } catch (error) {
    console.error('Error fetching event payment details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event payment details'
    });
  }
};

exports.updateEventPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const eventPayment = await EventPayment.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!eventPayment) {
      return res.status(404).json({
        success: false,
        message: 'Event payment not found'
      });
    }

    res.json({
      success: true,
      message: 'Event payment status updated successfully',
      data: eventPayment
    });

  } catch (error) {
    console.error('Error updating event payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event payment status'
    });
  }
};


exports.deleteEventPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const eventPayment = await EventPayment.findById(id);
    if (!eventPayment) {
      return res.status(404).json({
        success: false,
        message: 'Event payment not found'
      });
    }

    // Check if any payments have been made
    const paidCount = eventPayment.studentPayments.filter(sp => sp.status === 'paid').length;
    if (paidCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete event payment. ${paidCount} students have already paid.`
      });
    }

    await EventPayment.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Event payment deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting event payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete event payment: ' + error.message
    });
  }
};

exports.getStudentEventPayments = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status } = req.query;

    const filter = {
      'studentPayments.studentId': studentId
    };

    if (status) {
      filter['studentPayments.status'] = status;
    }

    const eventPayments = await EventPayment.find(filter);

    const studentEventPayments = eventPayments.map(event => {
      const studentPayment = event.studentPayments.find(
        sp => sp.studentId === studentId
      );
      return {
        eventId: event._id,
        title: event.title,
        description: event.description,
        amount: event.amount,
        eventDate: event.eventDate,
        dueDate: event.dueDate,
        instructions: event.instructions,
        status: studentPayment.status,
        paidAmount: studentPayment.paidAmount,
        paidDate: studentPayment.paidDate
      };
    });

    res.json({
      success: true,
      data: studentEventPayments
    });

  } catch (error) {
    console.error('Error fetching student event payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student event payments'
    });
  }
};






exports.getEventRevenueStats = async (req, res) => {
  try {
    const events = await Event.find({ status: 'active' });
    
    const eventStats = {
      totalEvents: 0,
      totalRevenue: 0,
      totalCollected: 0,
      totalPending: 0,
      upcomingEvents: [],
      eventBreakdown: []
    };
    
    events.forEach(event => {
      eventStats.totalEvents++;
      eventStats.totalRevenue += event.amount * event.totalStudents;
      eventStats.totalCollected += event.totalCollected;
      eventStats.totalPending += (event.amount * event.totalStudents) - event.totalCollected;
      
      // Event breakdown
      eventStats.eventBreakdown.push({
        title: event.title,
        date: event.eventDate,
        amount: event.amount,
        totalStudents: event.totalStudents,
        paidStudents: event.paidStudents,
        totalRevenue: event.amount * event.totalStudents,
        collected: event.totalCollected,
        pending: (event.amount * event.totalStudents) - event.totalCollected
      });
      
      // Upcoming events (within next 30 days)
      const eventDate = new Date(event.eventDate);
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      if (eventDate > now && eventDate <= thirtyDaysFromNow) {
        eventStats.upcomingEvents.push({
          title: event.title,
          date: event.eventDate,
          dueDate: event.dueDate,
          amount: event.amount,
          totalStudents: event.totalStudents,
          paidStudents: event.paidStudents,
          progress: calculateEventProgress(now, event.dueDate, event.eventDate)
        });
      }
    });
    
    res.json({
      success: true,
      data: eventStats
    });
    
  } catch (error) {
    console.error('Error fetching event revenue stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event statistics'
    });
  }
};

function calculateEventProgress(now, dueDate, eventDate) {
  const due = new Date(dueDate);
  const event = new Date(eventDate);
  
  if (now > event) return 100;
  if (now < due) {
    // Before due date - progress based on time until due date
    const totalWait = due - new Date(due.getFullYear(), due.getMonth(), 1);
    const elapsedWait = now - new Date(due.getFullYear(), due.getMonth(), 1);
    return Math.min(Math.round((elapsedWait / totalWait) * 100), 100);
  } else {
    // After due date - progress based on time until event
    const totalDuration = event - due;
    const elapsed = now - due;
    return Math.min(50 + Math.round((elapsed / totalDuration) * 50), 100);
  }
}

exports.getUpcomingEvents = async (req, res) => {
  try {
    const events = await Event.find({ status: 'active' });
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const upcomingEvents = events
      .filter(event => {
        const eventDate = new Date(event.eventDate);
        return eventDate > now && eventDate <= thirtyDaysFromNow;
      })
      .map(event => ({
        title: event.title,
        type: 'event',
        startDate: event.eventDate,
        endDate: event.eventDate,
        batch: event.batch,
        degreeLevel: event.degreeLevel,
        department: event.department,
        description: `Event: ${event.title}`,
        importance: 'medium',
        amount: event.amount,
        totalStudents: event.totalStudents,
        paidStudents: event.paidStudents,
        daysUntil: Math.ceil((new Date(event.eventDate) - now) / (1000 * 60 * 60 * 24)),
        progress: calculateEventProgress(now, event.dueDate, event.eventDate)
      }))
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    
    res.json({
      success: true,
      data: upcomingEvents
    });
    
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming events'
    });
  }
};