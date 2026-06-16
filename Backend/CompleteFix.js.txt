const mongoose = require('mongoose');

async function updateInstallmentPayments() {
  try {
    const StudentFee = mongoose.model('StudentFee');
    
    // 1. BSCS-SPRING-2024 - Paid till 4th sem 1st installment
    const spring2024Update = await StudentFee.updateMany(
      { batch: "BSCS-SPRING-2024" },
      { 
        $set: { 
          "semesterFees.$[semester].installments.$[installment].status": "paid",
          "semesterFees.$[semester].installments.$[installment].amountPaid": { 
            $arrayElemAt: ["$semesterFees.$[semester].installments.$[installment].amount", 0] 
          },
          "semesterFees.$[semester].installments.$[installment].paidDate": new Date()
        }
      },
      {
        arrayFilters: [
          { "semester.semester": { $lte: 4 } },
          { "installment.installmentNumber": 1 }
        ]
      }
    );
    console.log(`✅ BSCS-SPRING-2024: Updated ${spring2024Update.modifiedCount} records`);

    // 2. BSCS-FALL-2024 - Paid till 3rd sem 1st installment
    const fall2024Update = await StudentFee.updateMany(
      { batch: "BSCS-FALL-2024" },
      { 
        $set: { 
          "semesterFees.$[semester].installments.$[installment].status": "paid",
          "semesterFees.$[semester].installments.$[installment].amountPaid": { 
            $arrayElemAt: ["$semesterFees.$[semester].installments.$[installment].amount", 0] 
          },
          "semesterFees.$[semester].installments.$[installment].paidDate": new Date()
        }
      },
      {
        arrayFilters: [
          { "semester.semester": { $lte: 3 } },
          { "installment.installmentNumber": 1 }
        ]
      }
    );
    console.log(`✅ BSCS-FALL-2024: Updated ${fall2024Update.modifiedCount} records`);

    // 3. BSCS-SPRING-2025 - Paid till 2nd sem 1st installment
    const spring2025Update = await StudentFee.updateMany(
      { batch: "BSCS-SPRING-2025" },
      { 
        $set: { 
          "semesterFees.$[semester].installments.$[installment].status": "paid",
          "semesterFees.$[semester].installments.$[installment].amountPaid": { 
            $arrayElemAt: ["$semesterFees.$[semester].installments.$[installment].amount", 0] 
          },
          "semesterFees.$[semester].installments.$[installment].paidDate": new Date()
        }
      },
      {
        arrayFilters: [
          { "semester.semester": { $lte: 2 } },
          { "installment.installmentNumber": 1 }
        ]
      }
    );
    console.log(`✅ BSCS-SPRING-2025: Updated ${spring2025Update.modifiedCount} records`);

    // 4. BSCS-FALL-2025 - Paid till 1st sem 1st installment
    const fall2025Update = await StudentFee.updateMany(
      { batch: "BSCS-FALL-2025" },
      { 
        $set: { 
          "semesterFees.$[semester].installments.$[installment].status": "paid",
          "semesterFees.$[semester].installments.$[installment].amountPaid": { 
            $arrayElemAt: ["$semesterFees.$[semester].installments.$[installment].amount", 0] 
          },
          "semesterFees.$[semester].installments.$[installment].paidDate": new Date()
        }
      },
      {
        arrayFilters: [
          { "semester.semester": 1 },
          { "installment.installmentNumber": 1 }
        ]
      }
    );
    console.log(`✅ BSCS-FALL-2025: Updated ${fall2025Update.modifiedCount} records`);

    // Update corresponding invoices
    await updateInvoicePayments();

    console.log("🎉 All installment payments updated successfully!");

  } catch (error) {
    console.error("❌ Error updating installment payments:", error);
    throw error;
  }
}

async function updateInvoicePayments() {
  try {
    const StudentFee = mongoose.model('StudentFee');
    
    // Update invoices for paid installments
    const invoiceUpdate = await StudentFee.updateMany(
      { 
        "semesterFees.installments.status": "paid" 
      },
      {
        $set: {
          "invoices.$[invoice].paymentStatus": "paid",
          "invoices.$[invoice].invoiceStatus": "paid", 
          "invoices.$[invoice].paidAt": new Date()
        }
      },
      {
        arrayFilters: [
          { 
            "invoice.semester": { $in: [1, 2, 3, 4] },
            "invoice.installmentNumber": 1
          }
        ]
      }
    );
    
    console.log(`✅ Updated ${invoiceUpdate.modifiedCount} invoice records`);
    
  } catch (error) {
    console.error("❌ Error updating invoices:", error);
    throw error;
  }
}

// Alternative approach using aggregation for more complex logic
async function updatePaymentsWithAggregation() {
  try {
    const StudentFee = mongoose.model('StudentFee');
    
    const batches = [
      { batch: "BSCS-SPRING-2024", maxSemester: 4 },
      { batch: "BSCS-FALL-2024", maxSemester: 3 },
      { batch: "BSCS-SPRING-2025", maxSemester: 2 },
      { batch: "BSCS-FALL-2025", maxSemester: 1 }
    ];

    for (const batchConfig of batches) {
      const students = await StudentFee.find({ batch: batchConfig.batch });
      
      for (const student of students) {
        let updated = false;
        
        for (const semesterFee of student.semesterFees) {
          if (semesterFee.semester <= batchConfig.maxSemester) {
            const firstInstallment = semesterFee.installments.find(
              inst => inst.installmentNumber === 1
            );
            
            if (firstInstallment && firstInstallment.status === 'pending') {
              firstInstallment.status = 'paid';
              firstInstallment.amountPaid = firstInstallment.amount;
              firstInstallment.paidDate = new Date();
              updated = true;
            }
          }
        }
        
        if (updated) {
          await student.save();
          console.log(`✅ Updated ${student.studentId} in ${batchConfig.batch}`);
        }
      }
    }
    
    console.log("🎉 All payments updated via aggregation approach!");
    
  } catch (error) {
    console.error("❌ Error in aggregation approach:", error);
    throw error;
  }
}

// Run the updates
updateInstallmentPayments()
  .then(() => console.log("✅ Payment updates completed"))
  .catch(err => console.error("❌ Payment updates failed:", err));

// Or use the aggregation approach
// updatePaymentsWithAggregation()
//   .then(() => console.log("✅ Aggregation updates completed"))
//   .catch(err => console.error("❌ Aggregation updates failed:", err));

module.exports = { updateInstallmentPayments, updatePaymentsWithAggregation };