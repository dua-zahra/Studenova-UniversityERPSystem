import API_URL from '../../config';
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";

const StudentFeeDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStudentFee();
  }, []);

  const fetchStudentFee = async () => {
    try {
      const res = await axios.get(`${API_URL}/students/getStudentFee`, {
        withCredentials: true
      });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader2 className="animate-spin" />;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">{data.studentName} - {data.studentId}</h2>
      <p>Department: {data.department} | Degree: {data.degreeLevel} | Current Semester: {data.currentSemester}</p>
      <p>Status: <strong>{data.status}</strong></p>
      <p>Total Payable: Rs{data.totalPayableAmount} | Total Paid: Rs{data.totalAmountPaid} | Total Due: Rs{data.totalAmountDue}</p>

      {data.semesterFees.map((sem) => (
        <div key={sem.semester} className="mt-6 p-4 border rounded-lg shadow">
          <h3 className="font-semibold">Semester {sem.semester} - Status: {sem.status}</h3>
          <p>Tuition Fee: Rs{sem.tuitionFee} | Course Fee: RS{sem.courseFees} | Fixed Fees: Rs{sem.fixedFees}</p>
          <p>Total Fee: Rs{sem.totalFee} | Scholarship Discount: Rs{sem.scholarshipDiscount} | Discounted Fee: Rs{sem.discountedFee}</p>
          <p>Current Payable: Rs{sem.currentPayableAmount} | Fine: Rs{sem.totalFineAmount} | Readmission Fee: Rs{sem.totalReadmissionFee}</p>

          <h4 className="mt-2 font-medium">Installments</h4>
          <table className="w-full border text-left">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1">#</th>
                <th className="px-2 py-1">Amount</th>
                <th className="px-2 py-1">Paid</th>
                <th className="px-2 py-1">Due Date</th>
                <th className="px-2 py-1">Paid Date</th>
                <th className="px-2 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {sem.installments.map((inst) => (
                <tr key={inst.installmentNumber} className="border-t">
                  <td className="px-2 py-1">{inst.installmentNumber}</td>
                  <td className="px-2 py-1">Rs{inst.amount}</td>
                  <td className="px-2 py-1">Rs{inst.amountPaid}</td>
                  <td className="px-2 py-1">{inst.dueDate ? new Date(inst.dueDate).toLocaleDateString() : "-"}</td>
                  <td className="px-2 py-1">{inst.paidDate ? new Date(inst.paidDate).toLocaleDateString() : "-"}</td>
                  <td className="px-2 py-1">{inst.status}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="mt-2 font-medium">Invoices</h4>
          <table className="w-full border text-left">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1">Invoice #</th>
                <th className="px-2 py-1">Installment</th>
                <th className="px-2 py-1">Amount</th>
                <th className="px-2 py-1">Due Date</th>
                <th className="px-2 py-1">Payment Status</th>
              </tr>
            </thead>
            <tbody>
              {sem.invoices.map((inv) => (
                <tr key={inv.invoiceNumber} className="border-t">
                  <td className="px-2 py-1">{inv.invoiceNumber}</td>
                  <td className="px-2 py-1">{inv.installmentNumber}</td>
                  <td className="px-2 py-1">Rs{inv.amount}</td>
                  <td className="px-2 py-1">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "-"}</td>
                  <td className="px-2 py-1">{inv.paymentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default StudentFeeDashboard;
