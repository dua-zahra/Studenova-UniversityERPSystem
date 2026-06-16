import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  Card, Table, Button, Spin, Typography, Row, Col, 
  Divider, Statistic, Tag, Space, Modal, Input, Select,
  Popconfirm, Badge, Descriptions, Tooltip, Dropdown, Menu
} from 'antd';
import "../../../assets/style.css";
import { 
  FileTextOutlined, DownloadOutlined, QrcodeOutlined,
  EyeOutlined, CheckCircleOutlined, SyncOutlined,
  UserOutlined, ExclamationCircleOutlined,
  ReloadOutlined, DollarOutlined, CalculatorOutlined,
  InfoCircleOutlined, PercentageOutlined, SearchOutlined,
  FilterOutlined, ClearOutlined, PlusOutlined, MoreOutlined,
  TeamOutlined, CalendarOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const InvoiceManagement = () => {
  const [degreeLevel, setDegreeLevel] = useState('');
  const [department, setDepartment] = useState('');
  const [batch, setBatch] = useState('');
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingInvoices, setGeneratingInvoices] = useState(false);
  const [studentFeesData, setStudentFeesData] = useState([]);
  const [selectedStudentInvoices, setSelectedStudentInvoices] = useState([]);
  const [selectedStudentInfo, setSelectedStudentInfo] = useState(null);
  const [invoicesModalVisible, setInvoicesModalVisible] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [batchTotals, setBatchTotals] = useState({
    totalRequiredAmount: 0,
    totalPaidBatch: 0,
    totalDueAmount: 0,
    totalFineDue: 0,
    totalInvoices: 0,
    studentsWithRecords: 0,
    totalStudents: 0,
    collectionRate: 0,
    totalScholarshipDiscount: 0,
    totalOriginalDegreeFee: 0
  });

  const downloadInvoice = (studentId, invoiceNumber) => {
  if (!studentId || studentId === 'undefined' || studentId === 'null' || studentId.trim() === '') {
    console.error('❌ Invalid student ID:', studentId);
    toast.error('Invalid student ID.');
    return;
  }

  if (!invoiceNumber || invoiceNumber === 'undefined' || invoiceNumber === 'null' || invoiceNumber.trim() === '') {
    console.error('❌ Invalid invoice number:', invoiceNumber);
    toast.error('Invalid invoice number.');
    return;
  }

  const cleanStudentId = studentId.trim();
  const cleanInvoiceNumber = invoiceNumber.trim();

  console.log('📤 Downloading invoice for:', cleanStudentId, cleanInvoiceNumber);

  // CORRECT URL - No extra /invoiceNumber at the end
  const downloadUrl = `http://localhost:65000/api/fees/invoices/download/${cleanStudentId}/${cleanInvoiceNumber}`;
  
  console.log('🔗 Final URL:', downloadUrl);
  
  window.open(downloadUrl, '_blank');
};

  const viewStudentInvoices = async (studentId) => {
    if (!studentId || studentId === 'undefined' || studentId === 'null' || studentId.trim() === '') {
      toast.error('Invalid student ID provided');
      return;
    }

    const cleanStudentId = studentId.trim();
    
    console.log('Viewing invoices for student:', cleanStudentId);

    try {
      setLoading(true);
      
      const response = await axios.get(
        `http://localhost:65000/api/fees/invoices/student/${encodeURIComponent(cleanStudentId)}`, 
        {
          params: { 
            includeFines: true,
            semesterType: 'all'
          },
          timeout: 15000
        }
      );
      
      if (response.data.success) {
        console.log('Invoices loaded successfully:', response.data.data.invoices.length);
        
        const invoicesWithStudentId = response.data.data.invoices.map(invoice => ({
          ...invoice,
          studentId: cleanStudentId
        }));
        
        setSelectedStudentInvoices(invoicesWithStudentId);
        setSelectedStudentInfo(response.data.data.studentInfo);
        setInvoicesModalVisible(true);
        
        toast.success(`Loaded ${invoicesWithStudentId.length} invoices`);
        
      } else {
        console.error('API returned error:', response.data.message);
        toast.error('Failed to fetch student invoices: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error fetching student invoices:', error);
      
      let errorMessage = 'Failed to fetch student invoices';
      if (error.response) {
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'No response from server. Please check if the server is running.';
      } else {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const invoiceColumns = [
    {
      title: 'Invoice Number',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      width: 180,
      render: (number, record) => (
        <div>
          <Text strong style={{ fontFamily: 'monospace' }}>{number}</Text>
          <div style={{ marginTop: 4 }}>
            {record.isFineInvoice && (
              <Tag color="orange" size="small">FINE</Tag>
            )}
            {record.isReadmissionInvoice && (
              <Tag color="red" size="small">READMISSION</Tag>
            )}
            {!record.isFineInvoice && !record.isReadmissionInvoice && (
              <Tag color="blue" size="small">INSTALLMENT</Tag>
            )}
          </div>
        </div>
      )
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      render: (desc) => <Text>{desc}</Text>
    },
    {
      title: 'Semester',
      dataIndex: 'semester',
      key: 'semester',
      align: 'center',
      width: 120,
      render: (semester, record) => {
        const isFuture = selectedStudentInfo && semester > selectedStudentInfo.currentSemester;
        const isPast = selectedStudentInfo && semester < selectedStudentInfo.currentSemester;
        
        let color = 'blue';
        let text = `Sem ${semester}`;
        
        if (isFuture) {
          color = 'orange';
          text += ' (Future)';
        } else if (isPast) {
          color = 'purple';
          text += ' (Past)';
        }
        
        if (record.isFineInvoice) {
          color = 'orange';
        } else if (record.isReadmissionInvoice) {
          color = 'red';
        }
        
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: 'Installment',
      dataIndex: 'installmentNumber',
      key: 'installmentNumber',
      align: 'center',
      width: 100,
      render: (number) => number > 0 ? <Tag>#{number}</Tag> : <Tag color="default">N/A</Tag>
    },
    {
      title: 'Amount (Rs.)',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      width: 180,
      render: (amount, record) => (
        <div style={{ textAlign: 'right' }}>
          {record.amount > 0 && (
            <div><Text type="secondary">Installment: {record.amount?.toLocaleString()}</Text></div>
          )}
          {record.fineAmount > 0 && (
            <div><Text type="warning">Fine: {record.fineAmount?.toLocaleString()}</Text></div>
          )}
          {record.readmissionFee > 0 && (
            <div><Text type="danger">Readmission: {record.readmissionFee?.toLocaleString()}</Text></div>
          )}
          <div><Text strong style={{ fontSize: '14px' }}>Total: {amount?.toLocaleString()}</Text></div>
        </div>
      )
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    },
    {
      title: 'Status',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      align: 'center',
      width: 120,
      render: (status, record) => {
        const statusConfig = {
          'pending': { color: 'orange', text: 'Pending', icon: <SyncOutlined spin /> },
          'paid': { color: 'green', text: 'Paid', icon: <CheckCircleOutlined /> },
          'overdue': { color: 'red', text: 'Overdue', icon: <ExclamationCircleOutlined /> }
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        const isOverdue = record.isPastDue && status === 'pending';
        
        return (
          <div style={{ textAlign: 'center' }}>
            <Tag 
              color={isOverdue ? 'red' : config.color} 
              icon={config.icon}
              style={{ marginBottom: 4 }}
            >
              {isOverdue ? 'OVERDUE' : config.text}
            </Tag>
            {isOverdue && (
              <div style={{ fontSize: '10px', color: '#ff4d4f' }}>
                Past Due
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: 'Download',
      key: 'download',
      align: 'center',
      width: 100,
      render: (_, record) => {
        const studentId = record.studentId || selectedStudentInfo?.studentId;
        
        console.log(' Download button render:', {
          recordStudentId: record.studentId,
          selectedStudentId: selectedStudentInfo?.studentId,
          finalStudentId: studentId,
          invoiceNumber: record.invoiceNumber
        });
        
        if (!studentId) {
          console.error(' No student ID available for download');
          return (
            <Tooltip title="Student information not available">
              <Button 
                type="default" 
                size="small" 
                icon={<DownloadOutlined />}
                disabled
              >
                PDF
              </Button>
            </Tooltip>
          );
        }

        if (!record.invoiceNumber) {
          console.error(' No invoice number available');
          return (
            <Tooltip title="Invoice number not available">
              <Button 
                type="default" 
                size="small" 
                icon={<DownloadOutlined />}
                disabled
              >
                PDF
              </Button>
            </Tooltip>
          );
        }

        const canDownload = record.paymentStatus !== 'paid';
        
        return canDownload ? (
          <Tooltip title="Download PDF Invoice">
            <Button 
              type="primary" 
              size="small" 
              icon={<DownloadOutlined />}
              onClick={() => downloadInvoice(studentId, record.invoiceNumber)}
              className="btn submit-btn"
              style={{ minWidth: '80px' }}
            >
              PDF
            </Button>
          </Tooltip>
        ) : (
          <Tooltip title="Invoice already paid">
            <Tag color="green" icon={<CheckCircleOutlined />}>
              Paid
            </Tag>
          </Tooltip>
        );
      }
    }
  ];

  // Debug Helper
  useEffect(() => {
    if (invoicesModalVisible && selectedStudentInfo) {
      console.log('🔍 MODAL DEBUG INFO:');
      console.log('Selected Student Info:', selectedStudentInfo);
      console.log('Selected Student Invoices Count:', selectedStudentInvoices.length);
      console.log('Sample Invoice:', selectedStudentInvoices[0]);
      console.log('Student ID in invoices:', selectedStudentInvoices.map(inv => ({
        invoice: inv.invoiceNumber,
        hasStudentId: !!inv.studentId,
        studentId: inv.studentId
      })));
    }
  }, [invoicesModalVisible, selectedStudentInfo, selectedStudentInvoices]);

  // ALL YOUR EXISTING FRONTEND CODE REMAINS EXACTLY THE SAME FROM HERE...
  const calculateBatchTotals = (students) => {
    const totals = {
      totalRequiredAmount: 0, 
      totalPaidBatch: 0,
      totalDueAmount: 0,
      totalFineDue: 0,
      totalInvoices: 0,
      studentsWithRecords: 0,
      totalStudents: students.length,
      collectionRate: 0,
      totalScholarshipDiscount: 0,
      totalOriginalDegreeFee: 0
    };

    students.forEach(student => {
      const feeRecord = student.feeRecord || {};
      
      totals.totalRequiredAmount += feeRecord.totalPayableAmount || 0;
      totals.totalPaidBatch += feeRecord.totalAmountPaid || 0;
      totals.totalDueAmount += feeRecord.totalAmountDue || 0;
      totals.totalFineDue += feeRecord.totalFineDue || 0;
      totals.totalInvoices += feeRecord.totalInvoices || 0;
      totals.totalScholarshipDiscount += feeRecord.totalScholarshipDiscount || 0;
      totals.totalOriginalDegreeFee += feeRecord.totalDegreeFee || 0; 
      
      if (feeRecord.hasFeeRecord) {
        totals.studentsWithRecords++;
      }
    });

    if (totals.totalRequiredAmount > 0) {
      totals.collectionRate = Math.round((totals.totalPaidBatch / totals.totalRequiredAmount) * 100);
    }

    return totals;
  };

  const processStudentData = (students) => {
    return students.map(student => {
      const feeRecord = student.feeRecord || {};
      const scholarshipPercentage = student.scholarshipPercentage || 0;
      const totalDegreeFee = feeRecord.totalDegreeFee || 0;
      const totalAmountPaid = feeRecord.totalAmountPaid || 0;
      const totalAmountDue = feeRecord.totalAmountDue || 0;
      
      const currentSemester = student.currentSemester || 1;
      let currentSemesterTotal = 0;
      let currentPayableAmount = 0;
      let totalPayableAmount = 0;
      let totalScholarshipDiscount = 0;

      if (feeRecord.semesterFees && Array.isArray(feeRecord.semesterFees)) {
        const currentSemesterFee = feeRecord.semesterFees.find(
          sf => sf.semester === currentSemester
        );
        
        if (currentSemesterFee) {
          currentSemesterTotal = currentSemesterFee.originalTotalFee || 0;
          currentPayableAmount = currentSemesterFee.currentPayableAmount || currentSemesterFee.totalFee || 0;
        }

        totalPayableAmount = feeRecord.semesterFees.reduce((sum, sf) => 
          sum + (sf.totalFee || 0), 0
        );

        totalScholarshipDiscount = feeRecord.semesterFees.reduce((sum, sf) => 
          sum + (sf.scholarshipDiscount || 0), 0
        );
      }

      return {
        ...student,
        feeRecord: {
          ...feeRecord,
          totalDegreeFee, 
          totalAmountPaid,
          totalAmountDue,
          totalPayableAmount: totalPayableAmount || (totalDegreeFee - totalScholarshipDiscount), 
          totalScholarshipDiscount,
          currentSemesterTotal,
          currentPayableAmount: currentPayableAmount || 0,
          totalPaid: feeRecord.totalPaid || 0,
          totalDue: feeRecord.totalDue || 0,
          totalFineAmount: feeRecord.totalFineAmount || 0,
          totalFineDue: feeRecord.totalFineDue || 0,
          totalReadmissionFee: feeRecord.totalReadmissionFee || 0,
          totalReadmissionFeeDue: feeRecord.totalReadmissionFeeDue || 0,
          totalInvoices: feeRecord.totalInvoices || 0,
          pendingInvoices: feeRecord.pendingInvoices || 0,
          semesterFees: feeRecord.semesterFees || [],
          hasFeeRecord: feeRecord.hasFeeRecord || false,
          scholarshipPercentage: scholarshipPercentage
        }
      };
    });
  };

  useEffect(() => {
    fetchDegreeLevels();
  }, []);

  useEffect(() => {
    if (degreeLevel) {
      fetchDepartments();
      setDepartment('');
      setBatch('');
      setBatches([]);
    }
  }, [degreeLevel]);

  useEffect(() => {
    if (degreeLevel && department) {
      fetchBatches();
    }
  }, [degreeLevel, department]);

  const fetchDegreeLevels = async () => {
    try {
      const response = await axios.get('http://localhost:65000/api/degree-levels');
      setDegreeLevels(response.data);
    } catch (error) {
      toast.error('Failed to load degree levels');
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await axios.get('http://localhost:65000/api/departments/by-degree', {
        params: { degreeLevel }
      });
      setDepartments(response.data.departments || []);
    } catch (error) {
      toast.error('Failed to load departments');
    }
  };

  const fetchBatches = async () => {
    try {
      const response = await axios.get('http://localhost:65000/api/batches');
      
      if (response.data.success) {
        const filteredBatches = response.data.data.filter(batchItem => 
          batchItem.departmentName && 
          batchItem.departmentName.toLowerCase() === department.toLowerCase() &&
          batchItem.degreeLevel &&
          batchItem.degreeLevel.toLowerCase() === degreeLevel.toLowerCase() &&
          batchItem.isActive === true
        );
        setBatches(filteredBatches);
      } else {
        setBatches([]);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast.error('Failed to load batches');
      setBatches([]);
    }
  };

  const fetchStudentFees = async () => {
    if (!degreeLevel || !department || !batch) {
      toast.error('Please select degree level, department, and batch');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get('http://localhost:65000/api/fees/students-for-batch', {
        params: { degreeLevel, department: department.trim(), batch }
      });

      if (response.data.success) {
        const students = response.data.data.students;
        
        const processedStudents = processStudentData(students);
        setStudentFeesData(processedStudents);
        
        const calculatedBatchTotals = calculateBatchTotals(processedStudents);
        setBatchTotals(calculatedBatchTotals);
        
        toast.success(`Loaded ${students.length} students with fee calculations`);
      } else {
        toast.error('Failed to fetch student fees');
      }
    } catch (error) {
      console.error('Error fetching student fees:', error);
      toast.error('Failed to fetch student fees');
    } finally {
      setLoading(false);
    }
  };

  const generateAllInvoices = async () => {
    if (!degreeLevel || !department || !batch) {
      toast.error('Please select degree level, department, and batch');
      return;
    }

    const studentsWithoutFeeRecords = studentFeesData.filter(student => !student.feeRecord?.hasFeeRecord);
    
    if (studentsWithoutFeeRecords.length > 0) {
      toast.warning(`${studentsWithoutFeeRecords.length} students don't have fee records. Generating fee records first...`);
      
      try {
        await generateStudentFeeRecords();
        await fetchStudentFees();
      } catch (error) {
        toast.error('Failed to generate fee records');
        return;
      }
    }

    setGeneratingInvoices(true);
    try {
      console.log(`Generating past+current invoices for batch ${batch} with auto fines detection`);
      
      const response = await axios.post('http://localhost:65000/api/fees/invoices/generate-all-students', {
        degreeLevel,
        department: department.trim(),
        batch,
        semesterType: 'past_current',
        includeFines: true,
        preventDuplicates: true,
        excludeFutureSemesters: true
      }, {
        timeout: 120000
      });

      if (response.data.success) {
        const result = response.data.data;
        
        const totalFines = result.details.reduce((sum, detail) => 
          sum + (detail.breakdown?.fineInvoices || 0), 0);
        const totalReadmission = result.details.reduce((sum, detail) => 
          sum + (detail.breakdown?.readmissionInvoices || 0), 0);

        toast.success(`Generated ${result.totalInvoices} invoices for ${result.generated} students`);
        
        Modal.success({
          title: `Invoice Generation Complete`,
          width: 900,
          content: (
            <div>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={6}>
                  <Statistic title="Total Students" value={result.total} />
                </Col>
                <Col span={6}>
                  <Statistic title="Successful" value={result.generated} valueStyle={{ color: '#52c41a' }} />
                </Col>
                <Col span={6}>
                  <Statistic title="Errors" value={result.errors} valueStyle={{ color: '#cf1322' }} />
                </Col>
                <Col span={6}>
                  <Statistic title="Total Invoices" value={result.totalInvoices} />
                </Col>
              </Row>
              
              <Divider />
              
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small">
                    <Statistic 
                      title="Installment Invoices" 
                      value={result.totalInvoices - totalFines - totalReadmission}
                      prefix={<FileTextOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic 
                      title="Fine Invoices" 
                      value={totalFines}
                      valueStyle={{ color: '#faad14' }}
                      prefix={<ExclamationCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic 
                      title="Readmission Invoices" 
                      value={totalReadmission}
                      valueStyle={{ color: '#ff4d4f' }}
                      prefix={<SyncOutlined />}
                    />
                  </Card>
                </Col>
              </Row>
              
              {result.details && result.details.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text strong>Generation Details:</Text>
                  <div style={{ maxHeight: 200, overflow: 'auto', marginTop: 8, border: '1px solid #d9d9d9', padding: 8 }}>
                    {result.details.map((detail, index) => (
                      <div key={index} style={{ 
                        padding: '4px 8px', 
                        marginBottom: 4,
                        backgroundColor: detail.status === 'error' ? '#fff2f0' : 
                                      detail.status === 'success' ? '#f6ffed' : '#f0f5ff',
                        borderRadius: 4
                      }}>
                        <Text type={detail.status === 'error' ? 'danger' : 'success'}>
                          {detail.studentId}: {detail.message} 
                          {detail.breakdown && ` (Installment: ${detail.breakdown.installmentInvoices}, Fines: ${detail.breakdown.fineInvoices}, Readmission: ${detail.breakdown.readmissionInvoices})`}
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ),
        });
        
        fetchStudentFees();
      }
    } catch (error) {
      console.error(' Error generating batch invoices:', error);
      let errorMessage = 'Failed to generate invoices';
      
      if (error.response) {
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'No response from server. Please check if the server is running.';
      } else {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setGeneratingInvoices(false);
    }
  };

  const generateStudentFeeRecords = async () => {
    if (!degreeLevel || !department || !batch) {
      toast.error('Please select degree level, department, and batch');
      return;
    }

    try {
      const response = await axios.post('http://localhost:65000/api/fees/generate-student-records', {
        degreeLevel,
        department: department.trim(),
        batch
      });

      if (response.data.success) {
        toast.success(`Generated fee records for ${response.data.generated} students`);
        return true;
      } else {
        toast.error('Failed to generate fee records');
        return false;
      }
    } catch (error) {
      console.error('Error generating fee records:', error);
      toast.error('Failed to generate fee records');
      return false;
    }
  };

  const generateInvoicesForStudent = async (studentId) => {
    setGeneratingInvoices(true);
    try {
      console.log(`Generating past+current invoices for student ${studentId}`);
      
      const response = await axios.post('http://localhost:65000/api/fees/invoices/generate-student', {
        studentId,
        semesterType: 'past_current',
        includeFines: true,
        preventDuplicates: true
      }, {
        timeout: 30000
      });

      if (response.data.success) {
        const result = response.data.data;
        toast.success(`Generated ${result.totalInvoices} invoices for ${studentId}`);
        fetchStudentFees();
      }
    } catch (error) {
      console.error(`Error generating invoices for ${studentId}:`, error);
      toast.error(error.response?.data?.message || 'Failed to generate invoices');
    } finally {
      setGeneratingInvoices(false);
    }
  };

  const runCleanup = async () => {
    setCleanupLoading(true);
    try {
      const response = await axios.post('http://localhost:65000/api/fees/invoices/cleanup-duplicates', {
        studentId: null 
      });

      if (response.data.success) {
        toast.success(`Cleaned up ${response.data.duplicatesRemoved} duplicate invoices`);
        fetchStudentFees();
      }
    } catch (error) {
      console.error('Error running cleanup:', error);
      toast.error('Failed to run cleanup');
    } finally {
      setCleanupLoading(false);
    }
  };

  const EnhancedBatchTotals = () => (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={6} md={4}>
        <Card size="small" style={{ textAlign: 'center', background: '#f0f8ff' }}>
          <div style={{ padding: '12px' }}>
            <DollarOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: '8px' }} />
            <div>
              <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Original Amount</Text>
              <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                Rs. {batchTotals.totalOriginalDegreeFee?.toLocaleString()}
              </Text>
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={6} md={4}>
        <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
          <div style={{ padding: '12px' }}>
            <CalculatorOutlined style={{ fontSize: '24px', color: '#fa8c16', marginBottom: '8px' }} />
            <div>
              <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Required Amount</Text>
              <Text strong style={{ fontSize: '18px', color: '#fa8c16' }}>
                Rs. {batchTotals.totalRequiredAmount?.toLocaleString()}
              </Text>
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={6} md={3}>
        <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
          <div style={{ padding: '12px' }}>
            <DollarOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: '8px' }} />
            <div>
              <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Total Paid</Text>
              <Text strong style={{ fontSize: '18px', color: '#52c41a' }}>
                Rs. {batchTotals.totalPaidBatch?.toLocaleString()}
              </Text>
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={6} md={3}>
        <Card size="small" style={{ textAlign: 'center', background: '#fff2f0' }}>
          <div style={{ padding: '12px' }}>
            <ExclamationCircleOutlined style={{ fontSize: '24px', color: '#ff4d4f', marginBottom: '8px' }} />
            <div>
              <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Total Due</Text>
              <Text strong style={{ fontSize: '18px', color: '#ff4d4f' }}>
                Rs. {batchTotals.totalDueAmount?.toLocaleString()}
              </Text>
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={6} md={3}>
        <Card size="small" style={{ textAlign: 'center', background: '#f0f5ff' }}>
          <div style={{ padding: '12px' }}>
            <PercentageOutlined style={{ fontSize: '24px', color: '#722ed1', marginBottom: '8px' }} />
            <div>
              <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Collection Rate</Text>
              <Text strong style={{ fontSize: '18px', color: '#722ed1' }}>
                {batchTotals.collectionRate}%
              </Text>
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={6} md={3}>
        <Card size="small" style={{ textAlign: 'center', background: '#f9f0ff' }}>
          <div style={{ padding: '12px' }}>
            <TeamOutlined style={{ fontSize: '24px', color: '#eb2f96', marginBottom: '8px' }} />
            <div>
              <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Students</Text>
              <Text strong style={{ fontSize: '18px', color: '#eb2f96' }}>
                {batchTotals.studentsWithRecords}/{batchTotals.totalStudents}
              </Text>
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={6} md={4}>
        <Card size="small" style={{ textAlign: 'center', background: '#fcffe6' }}>
          <div style={{ padding: '12px' }}>
            <FileTextOutlined style={{ fontSize: '24px', color: '#a0d911', marginBottom: '8px' }} />
            <div>
              <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Total Invoices</Text>
              <Text strong style={{ fontSize: '18px', color: '#a0d911' }}>
                {batchTotals.totalInvoices}
              </Text>
            </div>
          </div>
        </Card>
      </Col>
    </Row>
  );

  const studentFeeColumns = [
    {
      title: 'Student ID',
      dataIndex: 'studentId',
      key: 'studentId',
      width: 120,
      render: (id) => <Text strong>{id}</Text>
    },
    {
      title: 'Name',
      key: 'name',
      width: 150,
      render: (_, record) => (
        <Text>{record.firstName} {record.lastName}</Text>
      )
    },
    {
      title: 'Current Semester',
      dataIndex: 'currentSemester',
      key: 'currentSemester',
      align: 'center',
      width: 120,
      render: (semester) => <Tag color="#957bab">Sem {semester}</Tag>
    },
    {
      title: 'Scholarship',
      dataIndex: 'scholarshipPercentage',
      key: 'scholarshipPercentage',
      align: 'center',
      width: 100,
      render: (percentage) => (
        percentage > 0 ? (
          <Tag color="green">{percentage}%</Tag>
        ) : (
          <Tag color="default">0%</Tag>
        )
      )
    },
    {
      title: (
        <span>
          Total Degree Amount (Rs.)
          <Tooltip title="Total degree amount without scholarship">
            <InfoCircleOutlined style={{ marginLeft: 5, color: '#1890ff' }} />
          </Tooltip>
        </span>
      ),
      key: 'totalDegreeAmount',
      align: 'right',
      width: 180,
      render: (_, record) => (
        <div>
          <Text strong>Rs. {(record.feeRecord?.totalDegreeFee || 0)?.toLocaleString()}</Text>
          {record.feeRecord?.scholarshipPercentage > 0 && (
            <div style={{ fontSize: '12px', color: '#52c41a' }}>
              -{record.feeRecord.scholarshipPercentage}% scholarship
            </div>
          )}
        </div>
      )
    },
    {
      title: (
        <span>
          Fees with Scholarship (Rs.)
          <Tooltip title="Total payable amount after scholarship discount">
            <InfoCircleOutlined style={{ marginLeft: 5, color: '#52c41a' }} />
          </Tooltip>
        </span>
      ),
      key: 'totalPayableAmount',
      align: 'right',
      width: 200,
      render: (_, record) => (
        <div>
          <Text type="secondary">
            Rs. {(record.feeRecord?.totalPayableAmount || 0)?.toLocaleString()}
          </Text>
          {record.feeRecord?.totalScholarshipDiscount > 0 && (
            <div style={{ fontSize: '12px', color: '#52c41a' }}>
              Saved: Rs. {(record.feeRecord.totalScholarshipDiscount || 0)?.toLocaleString()}
            </div>
          )}
        </div>
      )
    },
    {
      title: (
        <span>
          Total Paid (Rs.)
          <Tooltip title="Total amount paid by student">
            <InfoCircleOutlined style={{ marginLeft: 5, color: '#52c41a' }} />
          </Tooltip>
        </span>
      ),
      key: 'totalPaid',
      align: 'right',
      width: 140,
      render: (_, record) => (
        <Text type="success">Rs. {(record.feeRecord?.totalAmountPaid || 0)?.toLocaleString()}</Text>
      )
    },
    {
      title: (
        <span>
          Total Due (Rs.)
          <Tooltip title="Total amount due by student">
            <InfoCircleOutlined style={{ marginLeft: 5, color: '#cf1322' }} />
          </Tooltip>
        </span>
      ),
      key: 'totalDue',
      align: 'right',
      width: 140,
      render: (_, record) => (
        <Text type="danger">Rs. {(record.feeRecord?.totalAmountDue || 0)?.toLocaleString()}</Text>
      )
    },
    {
      title: (
        <span>
          Current Semester Total (Rs.)
          <Tooltip title="Original total fee for current semester">
            <InfoCircleOutlined style={{ marginLeft: 5, color: '#1890ff' }} />
          </Tooltip>
        </span>
      ),
      key: 'currentSemesterTotal',
      align: 'right',
      width: 200,
      render: (_, record) => (
        <Text>Rs. {(record.feeRecord?.currentSemesterTotal || 0)?.toLocaleString()}</Text>
      )
    },
    {
      title: (
        <span>
          Current Semester Payable (Rs.)
          <Tooltip title="Current semester payable amount after scholarship">
            <InfoCircleOutlined style={{ marginLeft: 5, color: '#52c41a' }} />
          </Tooltip>
        </span>
      ),
      key: 'currentSemesterPayable',
      align: 'right',
      width: 220,
      render: (_, record) => (
        <Text strong>Rs. {(record.feeRecord?.currentPayableAmount || 0)?.toLocaleString()}</Text>
      )
    },
    {
      title: 'Fee Record',
      key: 'feeRecord',
      align: 'center',
      width: 150,
      render: (_, record) => (
        record.feeRecord?.hasFeeRecord ? (
          <div>
            <Tag color="green">Generated</Tag>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              <Text type="success">Paid: Rs. {(record.feeRecord.totalAmountPaid || 0)?.toLocaleString()}</Text>
              <br />
              <Text type="danger">Due: Rs. {(record.feeRecord.totalAmountDue || 0)?.toLocaleString()}</Text>
              {record.feeRecord.totalFineDue > 0 && (
                <div>
                  <Text type="warning">Fines: Rs. {(record.feeRecord.totalFineDue || 0)?.toLocaleString()}</Text>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Tag color="orange">Not Generated</Tag>
        )
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => viewStudentInvoices(record.studentId)}
            disabled={!record.feeRecord?.hasFeeRecord}
            size="small"
            style={{ padding: '4px 8px' }}
          >
            View
          </Button>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item 
                  key="generate-invoices"
                  icon={<QrcodeOutlined />}
                  onClick={() => generateInvoicesForStudent(record.studentId)}
                  disabled={!record.feeRecord?.hasFeeRecord}
                >
                  Generate Invoices
                </Menu.Item>
              </Menu>
            }
            trigger={['click']}
          >
            <Button 
              type="text" 
              icon={<MoreOutlined />}
              size="small"
              style={{ padding: '4px 8px' }}
            />
          </Dropdown>
        </Space>
      ),
    },
  ];

  const mobileStudentColumns = [
    {
      title: 'Student Details',
      key: 'mobileView',
      render: (_, record) => (
        <Card 
          size="small" 
          style={{ marginBottom: 8, background: '#fafafa' }}
          bodyStyle={{ padding: '12px' }}
        >
          <div style={{ marginBottom: 8 }}>
            <Text strong style={{ color: '#262626', fontSize: '16px' }}>
              {record.studentId}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: '14px' }}>
              {record.firstName} {record.lastName}
            </Text>
          </div>
          
          <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
            <Col span={12}>
              <Text strong>Semester:</Text>
              <br />
              <Tag color="#957bab" style={{ marginTop: 4 }}>Sem {record.currentSemester}</Tag>
            </Col>
            <Col span={12}>
              <Text strong>Scholarship:</Text>
              <br />
              <Tag color={record.scholarshipPercentage > 0 ? "green" : "default"} style={{ marginTop: 4 }}>
                {record.scholarshipPercentage}%
              </Tag>
            </Col>
          </Row>
          
          <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
            <Col span={12}>
              <Text strong>Total Degree Amount:</Text>
              <br />
              <Text strong style={{ color: '#1890ff', fontSize: '14px' }}>
                Rs. {(record.feeRecord?.totalDegreeFee || 0)?.toLocaleString()}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>With Scholarship:</Text>
              <br />
              <Text style={{ fontSize: '14px' }}>
                Rs. {(record.feeRecord?.totalPayableAmount || 0)?.toLocaleString()}
              </Text>
            </Col>
          </Row>

          <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
            <Col span={12}>
              <Text strong>Total Paid:</Text>
              <br />
              <Text strong style={{ color: '#52c41a', fontSize: '14px' }}>
                Rs. {(record.feeRecord?.totalAmountPaid || 0)?.toLocaleString()}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Total Due:</Text>
              <br />
              <Text strong style={{ color: '#ff4d4f', fontSize: '14px' }}>
                Rs. {(record.feeRecord?.totalAmountDue || 0)?.toLocaleString()}
              </Text>
            </Col>
          </Row>

          <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Text strong>Current Sem Total:</Text>
              <br />
              <Text style={{ fontSize: '14px' }}>
                Rs. {(record.feeRecord?.currentSemesterTotal || 0)?.toLocaleString()}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Current Sem Payable:</Text>
              <br />
              <Text strong style={{ color: '#52c41a', fontSize: '14px' }}>
                Rs. {(record.feeRecord?.currentPayableAmount || 0)?.toLocaleString()}
              </Text>
            </Col>
          </Row>

          <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
            <Col span={24}>
              <Text strong>Fee Record:</Text>
              <br />
              {record.feeRecord?.hasFeeRecord ? (
                <div>
                  <Tag color="green">Generated </Tag>
                </div>
              ) : (
                <Tag color="orange">Not Generated</Tag>
              )}
            </Col>
          </Row>
          
          <Space>
            <Button 
              type="primary" 
              size="small"
              icon={<EyeOutlined />}
              onClick={() => viewStudentInvoices(record.studentId)}
              disabled={!record.feeRecord?.hasFeeRecord}
              className="btn submit-btn"
            >
              View Invoices
            </Button>
            <Dropdown
              overlay={
                <Menu>
                  <Menu.Item 
                    key="generate-invoices"
                    icon={<QrcodeOutlined />}
                    onClick={() => generateInvoicesForStudent(record.studentId)}
                    disabled={!record.feeRecord?.hasFeeRecord}
                  >
                    Generate Invoices
                  </Menu.Item>
                </Menu>
              }
            >
              <Button 
                size="small"
                icon={<MoreOutlined />}
              />
            </Dropdown>
          </Space>
        </Card>
      ),
    },
  ];

  return (
    <div className="container mt-4" style={{ minHeight: '100vh' }}>
      <ToastContainer 
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      
      <div className="d-flex justify-content-between align-items-center mb-5">
        <div>
          <h2 className="create-event-title mt-5" style={{ margin: 0, color: '#262626' }}>
            Fee Invoice Management
          </h2>
        </div>
      
      </div>

      <Card 
        className="mb-4"
        style={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        title={
          <Space>
            <FilterOutlined />
            <Text strong style={{ color: '#262626' }}>Select Batch & Department</Text>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Degree Level</label>
              <Select
                placeholder="Select Degree Level"
                value={degreeLevel}
                onChange={(value) => setDegreeLevel(value)}
                style={{ width: '100%' }}
                size="large"
              >
                {degreeLevels.map(level => (
                  <Option key={level} value={level}>{level}</Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Department</label>
              <Select
                placeholder="Select Department"
                value={department}
                onChange={(value) => setDepartment(value)}
                style={{ width: '100%' }}
                disabled={!degreeLevel}
                size="large"
              >
                {departments.map(dept => (
                  <Option key={dept._id} value={dept.departmentName}>
                    {dept.departmentName}
                  </Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Batch</label>
              <Select
                placeholder="Select Batch"
                value={batch}
                onChange={(value) => setBatch(value)}
                style={{ width: '100%' }}
                disabled={!department}
                size="large"
              >
                {batches.map(batchItem => (
                  <Option key={batchItem._id} value={batchItem.batchName}>
                    {batchItem.batchName} 
                    {batchItem.enrollmentYear && ` (${batchItem.enrollmentYear})`}
                  </Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">&nbsp;</label>
              <Button 
                type="primary" 
                onClick={fetchStudentFees}
                loading={loading}
                style={{ width: '100%' }}
                size="large"
                className="btn submit-btn"
              >
                 Fees Records
              </Button>
            </div>
          </Col>
        </Row>
      </Card>

      <EnhancedBatchTotals />

      <Card 
        className="create-event-card"
        style={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        title={
          <Text strong style={{ color: '#262626', fontSize: '18px' }}>
            Student Fee Records ({studentFeesData.length})
          </Text>
        }
      >
        <div className="d-none d-md-block">
          <Table
            columns={studentFeeColumns}
            dataSource={studentFeesData.map(student => ({ ...student, key: student.studentId }))}
            rowKey="studentId"
            loading={loading}
            scroll={{ x: 2400 }}
            size="middle"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} students`
            }}
          />
        </div>

        <div className="d-block d-md-none">
          <Table
            columns={mobileStudentColumns}
            dataSource={studentFeesData.map(student => ({ ...student, key: student.studentId }))}
            rowKey="studentId"
            loading={loading}
            pagination={{
              pageSize: 5,
              simple: true
            }}
            showHeader={false}
          />
        </div>
      </Card>

      <Modal
        title={
          <Text strong style={{ fontSize: '18px', color: '#262626' }}>
            Student Invoices: {selectedStudentInfo?.studentId}
          </Text>
        }
        open={invoicesModalVisible}
        onCancel={() => setInvoicesModalVisible(false)}
        footer={[
          <Button 
            key="close" 
            onClick={() => setInvoicesModalVisible(false)}
            className="btn cancel-btn"
          >
            Close
          </Button>
        ]}
        width={1600}
        style={{ top: 20 }}
      >
        {selectedStudentInfo && (
          <Card 
            size="small" 
            style={{ marginBottom: 16, background: '#fafafa' }}
            bodyStyle={{ padding: '16px' }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Text strong>Student:</Text>
                <br />
                <Text style={{ color: '#262626' }}>{selectedStudentInfo.firstName} {selectedStudentInfo.lastName}</Text>
              </Col>
              <Col xs={24} md={8}>
                <Text strong>Current Semester:</Text>
                <br />
                <Text style={{ color: '#262626' }}>
                  Semester {selectedStudentInfo.currentSemester}
                </Text>
              </Col>
              <Col xs={24} md={8}>
                <Text strong>Scholarship:</Text>
                <br />
                <Text style={{ color: '#262626' }}>{selectedStudentInfo.scholarshipPercentage}%</Text>
              </Col>
            </Row>
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} md={8}>
                <Text strong>Degree:</Text>
                <br />
                <Text style={{ color: '#262626' }}>
                  {selectedStudentInfo.degreeLevel}
                </Text>
              </Col>
              <Col xs={24} md={8}>
                <Text strong>Department:</Text>
                <br />
                <Text style={{ color: '#262626' }}>{selectedStudentInfo.department}</Text>
              </Col>
              <Col xs={24} md={8}>
                <Text strong>Batch:</Text>
                <br />
                <Text style={{ color: '#262626' }}>
                  {selectedStudentInfo.batch}
                </Text>
              </Col>
            </Row>
          </Card>
        )}

        {selectedStudentInvoices && (
          <div style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} sm={6}>
                <Card size="small">
                  <Statistic 
                    title="Total Invoices" 
                    value={selectedStudentInvoices.length} 
                    prefix={<FileTextOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={6}>
                <Card size="small">
                  <Statistic 
                    title="Pending" 
                    value={selectedStudentInvoices.filter(inv => inv.paymentStatus === 'pending').length}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={6}>
                <Card size="small">
                  <Statistic 
                    title="Fine Invoices" 
                    value={selectedStudentInvoices.filter(inv => inv.isFineInvoice).length}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={6}>
                <Card size="small">
                  <Statistic 
                    title="Total Due" 
                    value={selectedStudentInvoices.filter(inv => inv.paymentStatus === 'pending').reduce((sum, inv) => sum + inv.totalAmount, 0)}
                    prefix="Rs."
                    valueStyle={{ color: '#cf1322' }}
                  />
                </Card>
              </Col>
            </Row>
          </div>
        )}

        <Table
          columns={invoiceColumns}
          dataSource={selectedStudentInvoices}
          pagination={{ pageSize: 10 }}
          rowKey="invoiceNumber"
          scroll={{ x: 1400 }}
        />
      </Modal>
    </div>
  );
};

export default InvoiceManagement;