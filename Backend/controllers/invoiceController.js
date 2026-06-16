const mongoose = require('mongoose');
const StudentFee = require('../models/StudentFee');
const Student = require('../models/Student');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

async function cleanupDuplicateInvoices(studentId) {
  try {
    const studentFee = await StudentFee.findOne({ studentId });
    if (!studentFee) return 0;

    const invoiceMap = new Map();
    const uniqueInvoices = [];
    let duplicatesRemoved = 0;

    for (const invoice of studentFee.invoices) {
      const key = `${invoice.semester}-${invoice.installmentNumber}-${invoice.isFineInvoice ? 'fine' : 'normal'}-${invoice.isReadmissionInvoice ? 'readmission' : 'normal'}`;
      
      if (!invoiceMap.has(key)) {
        invoiceMap.set(key, invoice);
        uniqueInvoices.push(invoice);
      } else {
        duplicatesRemoved++;
        console.log(` Removed duplicate invoice: ${invoice.invoiceNumber} for semester ${invoice.semester} installment ${invoice.installmentNumber}`);
      }
    }

    if (duplicatesRemoved > 0) {
      studentFee.invoices = uniqueInvoices;
      await studentFee.save();
      console.log(`Removed ${duplicatesRemoved} duplicate invoices for student ${studentId}`);
    }

    return duplicatesRemoved;
  } catch (error) {
    console.error('Error cleaning up duplicate invoices:', error);
    return 0;
  }
}

async function cleanupDuplicateFines(studentId) {
  try {
    const studentFee = await StudentFee.findOne({ studentId });
    if (!studentFee) return 0;

    let removedCount = 0;
    const validInvoices = [];
    const processedKeys = new Set();

    for (const invoice of studentFee.invoices) {
      const key = `${invoice.semester}-${invoice.installmentNumber}`;
      
      if (!processedKeys.has(key)) {
        processedKeys.add(key);
        
        const groupInvoices = studentFee.invoices.filter(inv => 
          inv.semester === invoice.semester && 
          inv.installmentNumber === invoice.installmentNumber
        );
        
        const normalInvoices = groupInvoices.filter(inv => !inv.isFineInvoice && !inv.isReadmissionInvoice);
        const fineInvoices = groupInvoices.filter(inv => inv.isFineInvoice);
        
        if (normalInvoices.length > 0 && fineInvoices.length > 0) {
          const normalInvoice = normalInvoices[0];
          
          if (normalInvoice.fineAmount > 0) {
            console.log(` Removing separate fine invoices for semester ${invoice.semester} installment ${invoice.installmentNumber}`);
            validInvoices.push(normalInvoice);
            fineInvoices.forEach(fineInvoice => {
              console.log(`Removing duplicate fine invoice: ${fineInvoice.invoiceNumber}`);
              removedCount++;
            });
          } else {
            validInvoices.push(...groupInvoices);
          }
        } else {
          validInvoices.push(...groupInvoices);
        }
      }
    }

    if (removedCount > 0) {
      studentFee.invoices = validInvoices;
      await studentFee.save();
      console.log(` Removed ${removedCount} duplicate fine invoices for student ${studentId}`);
    }

    return removedCount;
  } catch (error) {
    console.error('Error cleaning up duplicate fines:', error);
    return 0;
  }
}

exports.generateStudentInvoices = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { studentId, semesterType = 'past_current', includeFines = true } = req.body;
      
      if (!studentId) {
        throw new Error('Student ID is required');
      }

      const studentFee = await StudentFee.findOne({ studentId }).session(session);
      if (!studentFee) {
        throw new Error('Student fee record not found');
      }

      const student = await Student.findOne({ studentId }).session(session);
      if (!student) {
        throw new Error('Student not found');
      }

      console.log(` Generating invoices for student ${studentId}, semester type: ${semesterType}, current semester: ${student.currentSemester}`);

      let totalInvoices = 0;
      const results = {
        installmentInvoices: [],
        fineInvoices: [],
        readmissionInvoices: []
      };

      const finesApplied = studentFee.autoDetectFinesAndReadmission();
      if (finesApplied) {
        console.log(` Auto-applied/updated fines/readmission requirements for ${studentId}`);
        await studentFee.save({ session });
      }

      const installmentInvoices = studentFee.generateInstallmentInvoices(semesterType, student.currentSemester);
      results.installmentInvoices = installmentInvoices;
      totalInvoices += installmentInvoices.length;

      if (includeFines) {
        const additionalInvoices = studentFee.generateFineAndReadmissionInvoices(student.currentSemester);
        results.fineInvoices = additionalInvoices.filter(inv => inv.isFineInvoice);
        results.readmissionInvoices = additionalInvoices.filter(inv => inv.isReadmissionInvoice);
        totalInvoices += additionalInvoices.length;
        
        console.log(` Generated ${additionalInvoices.length} separate fine/readmission invoices for existing invoices`);
      }

      await studentFee.save({ session });

      await cleanupDuplicateInvoices(studentFee.studentId);

      await cleanupDuplicateFines(studentFee.studentId);

      res.json({
        success: true,
        message: `Generated ${totalInvoices} invoices for ${semesterType} semesters`,
        data: {
          studentId,
          semesterType,
          currentSemester: student.currentSemester,
          totalInvoices,
          breakdown: {
            past: installmentInvoices.filter(inv => inv.semester < student.currentSemester).length,
            current: installmentInvoices.filter(inv => inv.semester === student.currentSemester).length,
            future: installmentInvoices.filter(inv => inv.semester > student.currentSemester).length,
            fines: results.fineInvoices.length,
            readmission: results.readmissionInvoices.length
          },
          details: {
            installmentInvoices: results.installmentInvoices,
            fineInvoices: results.fineInvoices,
            readmissionInvoices: results.readmissionInvoices
          }
        }
      });
    });
  } catch (error) {
    console.error(' Error generating student invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoices: ' + error.message
    });
  } finally {
    session.endSession();
  }
};

exports.generateBatchInvoices = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { degreeLevel, department, batch, semesterType = 'past_current', includeFines = true } = req.body;
    
    if (!degreeLevel || !department || !batch) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Degree level, department, and batch are required'
      });
    }

    const studentFees = await StudentFee.find({
      degreeLevel,
      department: { $regex: new RegExp(`^${department}$`, 'i') },
      batch
    }).session(session);

    if (!studentFees.length) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'No student fee records found for this batch'
      });
    }

    const results = {
      total: studentFees.length,
      generated: 0,
      errors: 0,
      totalInvoices: 0,
      details: []
    };

    for (const studentFee of studentFees) {
      try {
        const student = await Student.findOne({ studentId: studentFee.studentId }).session(session);
        if (!student) {
          throw new Error('Student not found');
        }

        let totalStudentInvoices = 0;
        const studentResults = {
          installmentInvoices: 0,
          fineInvoices: 0,
          readmissionInvoices: 0
        };

        studentFee.autoDetectFinesAndReadmission();

        const installmentInvoices = studentFee.generateInstallmentInvoices(semesterType, student.currentSemester);
        studentResults.installmentInvoices = installmentInvoices.length;
        totalStudentInvoices += installmentInvoices.length;

        if (includeFines) {
          const additionalInvoices = studentFee.generateFineAndReadmissionInvoices(student.currentSemester);
          studentResults.fineInvoices = additionalInvoices.filter(inv => inv.isFineInvoice).length;
          studentResults.readmissionInvoices = additionalInvoices.filter(inv => inv.isReadmissionInvoice).length;
          totalStudentInvoices += additionalInvoices.length;
        }

        await studentFee.save({ session });
        
        await cleanupDuplicateFines(studentFee.studentId);
        
        results.generated++;
        results.totalInvoices += totalStudentInvoices;
        results.details.push({
          studentId: studentFee.studentId,
          status: 'success',
          message: `Generated ${totalStudentInvoices} invoices`,
          breakdown: studentResults,
          currentSemester: student.currentSemester
        });

      } catch (error) {
        results.errors++;
        results.details.push({
          studentId: studentFee.studentId,
          status: 'error',
          message: error.message
        });
      }
    }

    await session.commitTransaction();

    res.json({
      success: true,
      message: `Generated ${results.totalInvoices} invoices for ${results.generated} students`,
      data: results
    });

  } catch (error) {
    await session.abortTransaction();
    console.error(' Error generating batch invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate batch invoices: ' + error.message
    });
  } finally {
    session.endSession();
  }
};

exports.cleanupInvoiceNumbers = async (req, res) => {
  try {
    console.log('Starting invoice number cleanup...');
    
    const studentFees = await StudentFee.find({
      $or: [
        { 'invoices.invoiceNumber': null },
        { 'invoices.invoiceNumber': { $exists: false } },
        { 'invoices': { $elemMatch: { invoiceNumber: null } } }
      ]
    });

    let fixedCount = 0;
    let errorCount = 0;

    for (const studentFee of studentFees) {
      try {
        const originalCount = studentFee.invoices.length;
        studentFee.invoices = studentFee.invoices.filter(inv => 
          inv.invoiceNumber !== null && 
          inv.invoiceNumber !== undefined
        );
        
        if (studentFee.invoices.length !== originalCount) {
          await studentFee.save();
          fixedCount++;
          console.log(`Fixed student ${studentFee.studentId}: removed ${originalCount - studentFee.invoices.length} invalid invoices`);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error fixing student ${studentFee.studentId}:`, error);
      }
    }

    res.json({
      success: true,
      message: `Invoice cleanup completed. Fixed ${fixedCount} records, ${errorCount} errors.`,
      data: { fixedCount, errorCount }
    });

  } catch (error) {
    console.error('Error in invoice cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Cleanup failed: ' + error.message
    });
  }
};


exports.getStudentInvoices = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { semesterType = 'all', includeFines = true } = req.query;
    
    console.log(' Fetching invoices for student:', studentId);
    
    if (!studentId || studentId === 'undefined' || studentId === 'null' || studentId.trim() === '') {
      console.error(' Invalid student ID in request:', studentId);
      return res.status(400).json({
        success: false,
        message: 'Valid Student ID is required'
      });
    }

    const cleanStudentId = studentId.trim();

    const studentFee = await StudentFee.findOne({ studentId: cleanStudentId });
    if (!studentFee) {
      console.error(' Student fee record not found:', cleanStudentId);
      return res.status(404).json({
        success: false,
        message: 'Student fee record not found'
      });
    }

    const student = await Student.findOne({ studentId: cleanStudentId });
    if (!student) {
      console.error(' Student not found:', cleanStudentId);
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    console.log(' Found student and fee records');

    let activeInvoices = studentFee.invoices.filter(invoice => invoice.isActive);

    if (!includeFines) {
      activeInvoices = activeInvoices.filter(inv => !inv.isFineInvoice && !inv.isReadmissionInvoice);
    }

    if (semesterType === 'past') {
      activeInvoices = activeInvoices.filter(inv => inv.semester < student.currentSemester);
    } else if (semesterType === 'current') {
      activeInvoices = activeInvoices.filter(inv => inv.semester === student.currentSemester);
    } else if (semesterType === 'pending') {
      activeInvoices = activeInvoices.filter(inv => inv.paymentStatus === 'pending');
    }

    const installmentInvoices = activeInvoices.filter(inv => !inv.isFineInvoice && !inv.isReadmissionInvoice);
    const fineInvoices = activeInvoices.filter(inv => inv.isFineInvoice);
    const readmissionInvoices = activeInvoices.filter(inv => inv.isReadmissionInvoice);

    console.log(` Returning ${activeInvoices.length} invoices for student ${cleanStudentId}`);

    res.json({
      success: true,
      data: {
        studentInfo: {
          studentId: student.studentId,
          firstName: student.firstName,
          lastName: student.lastName,
          universityEmail: student.universityEmail,
          currentSemester: student.currentSemester,
          degreeLevel: student.degreeLevel,
          department: student.department,
          batch: student.batch,
          scholarshipPercentage: student.scholarshipPercentage || 0
        },
        invoices: activeInvoices.map(invoice => ({
          invoiceNumber: invoice.invoiceNumber,
          description: invoice.description,
          semester: invoice.semester,
          installmentNumber: invoice.installmentNumber,
          amount: invoice.amount,
          fineAmount: invoice.fineAmount,
          readmissionFee: invoice.readmissionFee,
          totalAmount: invoice.totalAmount,
          dueDate: invoice.dueDate,
          paymentStatus: invoice.paymentStatus,
          invoiceStatus: invoice.invoiceStatus,
          generatedAt: invoice.generatedAt,
          isPastDue: new Date() > new Date(invoice.dueDate) && invoice.paymentStatus === 'pending',
          canDownload: invoice.paymentStatus !== 'paid',
          isFineInvoice: invoice.isFineInvoice || false,
          isReadmissionInvoice: invoice.isReadmissionInvoice || false,
          semesterType: invoice.semester < student.currentSemester ? 'past' : 
                       invoice.semester === student.currentSemester ? 'current' : 'future'
        })),
        summary: {
          totalInvoices: activeInvoices.length,
          installmentInvoices: installmentInvoices.length,
          fineInvoices: fineInvoices.length,
          readmissionInvoices: readmissionInvoices.length,
          pendingInvoices: activeInvoices.filter(inv => inv.paymentStatus === 'pending').length,
          paidInvoices: activeInvoices.filter(inv => inv.paymentStatus === 'paid').length,
          totalAmountDue: activeInvoices
            .filter(inv => inv.paymentStatus === 'pending')
            .reduce((sum, inv) => sum + inv.totalAmount, 0),
          pastDueAmount: activeInvoices
            .filter(inv => inv.paymentStatus === 'pending' && new Date() > new Date(inv.dueDate))
            .reduce((sum, inv) => sum + inv.totalAmount, 0)
        }
      }
    });
  } catch (error) {
    console.error(' Error fetching student invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student invoices: ' + error.message
    });
  }
};

exports.downloadInvoice = async (req, res) => {
  try {
    const { studentId, invoiceNumber } = req.params;
    
    console.log('🔍 Download request received:', { 
      studentId, 
      invoiceNumber,
      timestamp: new Date().toISOString()
    });
    
    if (!studentId || studentId === 'undefined' || studentId === 'null' || studentId.trim() === '') {
      console.error(' Invalid student ID received:', studentId);
      return res.status(400).json({
        success: false,
        message: 'Valid Student ID is required'
      });
    }

    if (!invoiceNumber || invoiceNumber === 'undefined' || invoiceNumber === 'null' || invoiceNumber.trim() === '') {
      console.error(' Invalid invoice number received:', invoiceNumber);
      return res.status(400).json({
        success: false,
        message: 'Valid invoice number is required'
      });
    }

    const cleanStudentId = studentId.trim();
    const cleanInvoiceNumber = invoiceNumber.trim();
    
    console.log(' Searching for student:', cleanStudentId);
    
    const studentFee = await StudentFee.findOne({ studentId: cleanStudentId });
    if (!studentFee) {
      console.error(' Student fee record not found:', cleanStudentId);
      return res.status(404).json({
        success: false,
        message: `Student fee record not found for ID: ${cleanStudentId}`
      });
    }

    console.log(' Student fee record found, searching for invoice:', cleanInvoiceNumber);
    
    const invoice = studentFee.invoices.find(inv => 
      inv.invoiceNumber === cleanInvoiceNumber && 
      inv.isActive === true
    );

    if (!invoice) {
      console.error(' Invoice not found:', cleanInvoiceNumber);
      console.log('Available invoices:', studentFee.invoices.map(inv => inv.invoiceNumber));
      return res.status(404).json({
        success: false,
        message: `Invoice ${cleanInvoiceNumber} not found for student ${cleanStudentId}`
      });
    }

    console.log(' Invoice found, fetching student details...');

    const student = await Student.findOne({ studentId: cleanStudentId });
    if (!student) {
      console.error(' Student details not found:', cleanStudentId);
      return res.status(404).json({
        success: false,
        message: `Student details not found: ${cleanStudentId}`
      });
    }

    console.log(' Student details found, generating PDF...');

    // Update invoice status
    invoice.invoiceStatus = 'downloaded';
    invoice.downloadedAt = new Date();
    await studentFee.save();

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${cleanInvoiceNumber}.pdf`);
    res.setHeader('Cache-Control', 'no-cache');
    
    doc.pipe(res);

    const addText = (text, x, y, options = {}) => {
      doc.fontSize(options.size || 10)
         .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(text, x, y, options);
    };

    addText('Superior University', 50, 50, { size: 20, bold: true });
    addText('FEE PAYMENT INVOICE', 50, 75, { size: 16, bold: true });
    
    addText('Superior University Lahore', 50, 110);
    addText('Lahore, Pakistan', 50, 125);
    addText('Phone: +92 312343212', 50, 140);
    addText('Email: accounts@superioruniversity.com', 50, 155);

    addText(`Invoice #: ${cleanInvoiceNumber}`, 350, 110, { bold: true });
    addText(`Issue Date: ${invoice.generatedAt.toLocaleDateString()}`, 350, 125);
    addText(`Due Date: ${invoice.dueDate.toLocaleDateString()}`, 350, 140);
    
    const isOverdue = new Date() > new Date(invoice.dueDate) && invoice.paymentStatus === 'pending';
    addText(`Status: ${invoice.paymentStatus.toUpperCase()}${isOverdue ? ' - OVERDUE' : ''}`, 350, 155, { 
      color: isOverdue ? 'red' : (invoice.paymentStatus === 'paid' ? 'green' : 'black')
    });

    let invoiceType = 'INSTALLMENT';
    if (invoice.isFineInvoice) invoiceType = 'FINE';
    if (invoice.isReadmissionInvoice) invoiceType = 'READMISSION';
    
    addText(`Invoice Type: ${invoiceType}`, 350, 170, { 
      color: invoice.isFineInvoice ? 'orange' : invoice.isReadmissionInvoice ? 'red' : 'blue'
    });

    doc.moveTo(50, 195).lineTo(550, 195).stroke();
    addText('STUDENT INFORMATION', 50, 205, { size: 14, bold: true });
    
    addText(`Student ID: ${student.studentId}`, 50, 235);
    addText(`Name: ${student.firstName} ${student.lastName}`, 50, 250);
    addText(`Current Semester: ${student.currentSemester}`, 50, 265);
    addText(`Invoice Semester: ${invoice.semester}`, 50, 280);
    addText(`Email: ${student.universityEmail}`, 50, 295);
    
    addText(`Degree: ${student.degreeLevel}`, 250, 235);
    addText(`Department: ${student.department}`, 250, 250);
    addText(`Batch: ${student.batch}`, 250, 265);
    addText(`Scholarship: ${student.scholarshipPercentage || 0}%`, 250, 280);

    
    doc.moveTo(50, 320).lineTo(550, 320).stroke();
    addText('INVOICE DETAILS', 50, 330, { size: 14, bold: true });
    
    addText('Description', 50, 360, { bold: true });
    addText('Amount (Rs.)', 450, 360, { bold: true, align: 'right' });

    doc.moveTo(50, 375).lineTo(550, 375).stroke();

    let yPosition = 390;
    
    addText(invoice.description, 50, yPosition);
    
    if (invoice.amount > 0) {
      addText('Installment Amount:', 300, yPosition);
      addText(invoice.amount.toLocaleString(), 450, yPosition, { align: 'right' });
    }
    
    if (invoice.fineAmount > 0) {
      yPosition += 20;
      addText('Late Fine:', 300, yPosition);
      addText(invoice.fineAmount.toLocaleString(), 450, yPosition, { align: 'right' });
    }
    
    if (invoice.readmissionFee > 0) {
      yPosition += 20;
      addText('Readmission Fee:', 300, yPosition);
      addText(invoice.readmissionFee.toLocaleString(), 450, yPosition, { align: 'right' });
    }

    yPosition += 30;
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
    
    addText('TOTAL AMOUNT', 280, yPosition + 15, { bold: true });
    addText(`Rs. ${invoice.totalAmount.toLocaleString()}`, 450, yPosition + 15, { bold: true, align: 'right' });

    addText(`Payment Status: ${invoice.paymentStatus.toUpperCase()}`, 50, yPosition + 45);
    addText(`Due Date: ${invoice.dueDate.toLocaleDateString()}`, 50, yPosition + 60);
    
    if (isOverdue) {
      addText('STATUS: OVERDUE - PLEASE PAY IMMEDIATELY', 50, yPosition + 80, { color: 'red', bold: true });
    }

    
    addText('SCAN TO PAY', 400, yPosition + 120, { size: 12, bold: true, align: 'center', width: 100 });
    
    try {
      const qrCodeData = {
        studentId: cleanStudentId,
        invoiceNumber: cleanInvoiceNumber,
        amount: invoice.totalAmount,
        dueDate: invoice.dueDate.toISOString(),
        semester: invoice.semester,
        description: invoice.description
      };
      const qrCodeImage = await QRCode.toDataURL(JSON.stringify(qrCodeData));
      doc.image(qrCodeImage, 400, yPosition + 140, { width: 80, height: 80 });
    } catch (qrError) {
      console.error('QR Code generation error:', qrError);
      addText('QR Code unavailable', 400, yPosition + 160, { align: 'center', width: 100 });
    }

    
    addText('PAYMENT INSTRUCTIONS', 50, yPosition + 120, { size: 12, bold: true });
    addText('1. Scan QR code or visit payment portal', 50, yPosition + 140);
    addText('2. Use Invoice Number as reference', 50, yPosition + 155);
    addText('3. Keep transaction ID for records', 50, yPosition + 170);
    addText('4. Contact accounts for assistance', 50, yPosition + 185);
    addText(`5. Due Date: ${invoice.dueDate.toLocaleDateString()}`, 50, yPosition + 200);

    if (invoice.semester < student.currentSemester) {
      addText('NOTE: This is a past semester invoice. Late payment may affect your academic standing.', 50, yPosition + 230, { color: 'orange', size: 10 });
    }

    if (invoice.isFineInvoice) {
      addText('NOTE: This is a fine invoice. Payment is required to clear your dues.', 50, yPosition + 250, { color: 'orange', size: 10 });
    }

    if (invoice.isReadmissionInvoice) {
      addText('NOTE: This is a readmission fee invoice. Payment is required for course continuation.', 50, yPosition + 270, { color: 'red', size: 10 });
    }

    doc.moveTo(50, 700).lineTo(550, 700).stroke();
    addText('Thank you for your prompt payment!', 50, 710, { align: 'center', width: 500 });
    addText('For queries contact: accounts@superioruniversity.com | Phone: +92 312343212', 50, 725, { align: 'center', width: 500, size: 8 });

    doc.end();

    console.log('✅ PDF generated successfully for invoice:', cleanInvoiceNumber);

  } catch (error) {
    console.error('💥Error downloading invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download invoice: ' + error.message
    });
  }
};


exports.markInvoiceAsPaid = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { studentId, invoiceNumber } = req.body;
    
    if (!studentId || !invoiceNumber) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Student ID and invoice number are required'
      });
    }

    const studentFee = await StudentFee.findOne({ studentId }).session(session);
    if (!studentFee) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Student fee record not found'
      });
    }

    const invoice = studentFee.invoices.find(inv => inv.invoiceNumber === invoiceNumber);
    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    invoice.paymentStatus = 'paid';
    invoice.invoiceStatus = 'paid';
    invoice.paidAt = new Date();

    for (const semesterFee of studentFee.semesterFees) {
      for (const installment of semesterFee.installments) {
        if (installment.invoiceNumber === invoiceNumber) {
          installment.status = 'paid';
          installment.paidDate = new Date();
          installment.amountPaid = installment.amount;
          
          if (invoice.isFineInvoice) {
            installment.finePaid = true;
          }
          
          if (invoice.isReadmissionInvoice) {
            installment.readmissionFeePaid = true;
          }
          break;
        }
      }
    }

    await studentFee.save({ session });
    await session.commitTransaction();

    res.json({
      success: true,
      message: `Invoice ${invoiceNumber} marked as paid`,
      data: {
        invoiceNumber,
        paymentStatus: 'paid',
        paidAt: new Date(),
        semester: invoice.semester,
        isFineInvoice: invoice.isFineInvoice,
        isReadmissionInvoice: invoice.isReadmissionInvoice
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error marking invoice as paid:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark invoice as paid: ' + error.message
    });
  } finally {
    session.endSession();
  }
};

exports.autoGenerateFineInvoices = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { degreeLevel, department, batch } = req.body;
    
    let query = {};
    if (degreeLevel && department && batch) {
      query = {
        degreeLevel,
        department: { $regex: new RegExp(`^${department}$`, 'i') },
        batch
      };
    }

    const studentFees = await StudentFee.find(query).session(session);
    
    const results = {
      total: studentFees.length,
      generated: 0,
      errors: 0,
      totalInvoices: 0,
      details: []
    };

    for (const studentFee of studentFees) {
      try {
        const student = await Student.findOne({ studentId: studentFee.studentId }).session(session);
        if (!student) continue;

        studentFee.autoDetectFinesAndReadmission();
        
        const fineInvoices = studentFee.generateFineAndReadmissionInvoices(student.currentSemester);
        
        if (fineInvoices.length > 0) {
          await studentFee.save({ session });
          results.generated++;
          results.totalInvoices += fineInvoices.length;
          
          results.details.push({
            studentId: studentFee.studentId,
            status: 'success',
            message: `Generated ${fineInvoices.length} fine/readmission invoices`,
            invoices: fineInvoices.map(inv => inv.invoiceNumber)
          });
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          studentId: studentFee.studentId,
          status: 'error',
          message: error.message
        });
      }
    }

    await session.commitTransaction();

    res.json({
      success: true,
      message: `Auto-generated ${results.totalInvoices} fine/readmission invoices for ${results.generated} students`,
      data: results
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error auto-generating fine invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to auto-generate fine invoices: ' + error.message
    });
  } finally {
    session.endSession();
  }
};

exports.cleanupDuplicates = async (req, res) => {
  try {
    const { studentId } = req.body;
    let cleanedCount = 0;
    
    if (studentId) {
      cleanedCount = await cleanupDuplicateInvoices(studentId);
      res.json({
        success: true,
        message: `Cleaned up duplicates for student ${studentId}`,
        duplicatesRemoved: cleanedCount
      });
    } else {
      const studentFees = await StudentFee.find({});
      for (const studentFee of studentFees) {
        const removed = await cleanupDuplicateInvoices(studentFee.studentId);
        cleanedCount += removed;
      }
      res.json({
        success: true,
        message: `Cleaned up duplicates for all students`,
        totalDuplicatesRemoved: cleanedCount
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Cleanup failed: ' + error.message
    });
  }
};

exports.cleanupDuplicateFines = async (req, res) => {
  try {
    const { studentId } = req.body;
    let cleanedCount = 0;
    
    if (studentId) {
      cleanedCount = await cleanupDuplicateFines(studentId);
      res.json({
        success: true,
        message: `Cleaned up duplicate fines for student ${studentId}`,
        duplicatesRemoved: cleanedCount
      });
    } else {
      const studentFees = await StudentFee.find({});
      for (const studentFee of studentFees) {
        const removed = await cleanupDuplicateFines(studentFee.studentId);
        cleanedCount += removed;
      }
      res.json({
        success: true,
        message: `Cleaned up duplicate fines for all students`,
        totalDuplicatesRemoved: cleanedCount
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Cleanup failed: ' + error.message
    });
  }
};
exports.generateAllStudentsInvoices = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { degreeLevel, department, batch, semesterType = 'past_current', includeFines = true, preventDuplicates = true, excludeFutureSemesters = true } = req.body;
    
    if (!degreeLevel || !department || !batch) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Degree level, department, and batch are required'
      });
    }

    console.log(`Starting invoice generation for all students in batch: ${batch}, department: ${department}, degree: ${degreeLevel}`);

    const students = await Student.find({
      degreeLevel,
      department: { $regex: new RegExp(`^${department}$`, 'i') },
      batch,
      isActive: true
    }).session(session);

    if (!students.length) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'No students found for this batch'
      });
    }

    console.log(` Found ${students.length} students for invoice generation`);

    const results = {
      total: students.length,
      generated: 0,
      errors: 0,
      totalInvoices: 0,
      details: []
    };

    for (const student of students) {
      try {
        console.log(` Processing student: ${student.studentId}`);
        
        let studentFee = await StudentFee.findOne({ studentId: student.studentId }).session(session);
        
        if (!studentFee) {
          console.log(` No fee record found for student: ${student.studentId}`);
          results.details.push({
            studentId: student.studentId,
            status: 'error',
            message: 'No fee record found. Please generate fee records first.'
          });
          results.errors++;
          continue;
        }

        let totalStudentInvoices = 0;
        const studentResults = {
          installmentInvoices: 0,
          fineInvoices: 0,
          readmissionInvoices: 0
        };

        const finesApplied = studentFee.autoDetectFinesAndReadmission();
        if (finesApplied) {
          console.log(` Auto-applied fines for ${student.studentId}`);
        }

        const effectiveSemesterType = excludeFutureSemesters ? 'past_current' : semesterType;
        console.log(` Generating invoices for ${student.studentId}, semester type: ${effectiveSemesterType}, current semester: ${student.currentSemester}`);
        
        const installmentInvoices = studentFee.generateInstallmentInvoices(
          effectiveSemesterType, 
          student.currentSemester
        );
        
        studentResults.installmentInvoices = installmentInvoices.length;
        totalStudentInvoices += installmentInvoices.length;

        if (includeFines) {
          console.log(` Generating fine/readmission invoices for ${student.studentId}`);
          const additionalInvoices = studentFee.generateFineAndReadmissionInvoices(student.currentSemester);
          studentResults.fineInvoices = additionalInvoices.filter(inv => inv.isFineInvoice).length;
          studentResults.readmissionInvoices = additionalInvoices.filter(inv => inv.isReadmissionInvoice).length;
          totalStudentInvoices += additionalInvoices.length;
        }

        if (preventDuplicates) {
          console.log(` Running duplicate prevention for ${student.studentId}`);
          await cleanupDuplicateInvoices(studentFee.studentId);
          await cleanupDuplicateFines(studentFee.studentId);
        }

        await studentFee.save({ session });
        
        results.generated++;
        results.totalInvoices += totalStudentInvoices;
        results.details.push({
          studentId: studentFee.studentId,
          status: 'success',
          message: `Generated ${totalStudentInvoices} invoices`,
          breakdown: studentResults,
          currentSemester: student.currentSemester
        });

        console.log(` Successfully generated ${totalStudentInvoices} invoices for ${student.studentId}`);

      } catch (error) {
        console.error(` Error processing student ${student.studentId}:`, error);
        results.errors++;
        results.details.push({
          studentId: student.studentId,
          status: 'error',
          message: error.message
        });
      }
    }

    await session.commitTransaction();

    console.log(` Invoice generation completed: ${results.totalInvoices} invoices for ${results.generated} students`);

    res.json({
      success: true,
      message: `Generated ${results.totalInvoices} invoices for ${results.generated} students`,
      data: results
    });

  } catch (error) {
    await session.abortTransaction();
    console.error(' Error generating all student invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoices: ' + error.message
    });
  } finally {
    session.endSession();
  }
};
