import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../../../config';

import { 
  Form, Input, Button, DatePicker, InputNumber, 
  Row, Col, Typography, Tag, Alert,
  message, Checkbox, Table, Spin
} from 'antd';
import { 
  SaveOutlined, UserOutlined, SearchOutlined
} from '@ant-design/icons';
import "../../../assets/style.css";

const { Title, Text } = Typography;

const CreateStudentExpense = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchText, setSearchText] = useState('');
  
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  
  const [selectedDegree, setSelectedDegree] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');

  const [expenseConfigurations, setExpenseConfigurations] = useState({});
  const [expenseDetails, setExpenseDetails] = useState({});

  const expenseTypes = [
    { value: 'bus', label: 'Transport Details', hasDuration: true },
    { value: 'hostel', label: 'Hostel Details', hasDuration: true },
    { value: 'sports', label: 'Sports Details', hasDuration: true },
    { value: 'society', label: 'Society Participation', hasDuration: false },
    { value: 'fine', label: 'Fine Details', hasDuration: false },
    { value: 'library', label: 'Library Management', hasDuration: true }
  ];

  useEffect(() => {
    const initialConfig = {};
    expenseTypes.forEach(expense => {
      initialConfig[expense.value] = {
        enabled: false,
        durationInMonths: expense.hasDuration ? 1 : null,
        startDate: null,
        paymentDueDate: null
      };
    });
    setExpenseConfigurations(initialConfig);
  }, []);

  useEffect(() => {
    fetchDegreeLevels();
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      fetchStudentsByBatch();
    }
  }, [selectedBatch]);

  useEffect(() => {
    if (searchText) {
      const filtered = students.filter(student => 
        student.studentId.toLowerCase().includes(searchText.toLowerCase()) ||
        student.firstName.toLowerCase().includes(searchText.toLowerCase()) ||
        student.lastName.toLowerCase().includes(searchText.toLowerCase()) ||
        student.universityEmail.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredStudents(filtered);
    } else {
      setFilteredStudents(students);
    }
  }, [searchText, students]);

  const fetchDegreeLevels = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/degree-levels`);
      setDegreeLevels(response.data);
    } catch (error) {
      console.error('Error fetching degree levels:', error);
      message.error('Failed to load degree levels');
    }
  };

  const fetchDepartments = async (degreeLevel) => {
    try {
      const response = await axios.get(`${API_URL}/api/departments/by-degree`, {
        params: { degreeLevel }
      });
      
      let departmentsData = [];
      if (Array.isArray(response.data)) {
        departmentsData = response.data;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        departmentsData = response.data.data;
      } else if (response.data.departments && Array.isArray(response.data.departments)) {
        departmentsData = response.data.departments;
      }
      
      setDepartments(departmentsData);
    } catch (error) {
      console.error('Error fetching departments:', error);
      message.error('Failed to load departments');
    }
  };

  const fetchBatches = async (degreeLevel, department) => {
    try {
      const response = await axios.get(`${API_URL}/api/teacher-assignment/batches/active`, {
        params: { 
          degreeLevel: degreeLevel,
          department: department 
        }
      });
      
      let batchesData = [];
      if (Array.isArray(response.data)) {
        batchesData = response.data;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        batchesData = response.data.data;
      } else if (response.data.batches && Array.isArray(response.data.batches)) {
        batchesData = response.data.batches;
      }
      
      setBatches(batchesData);
    } catch (error) {
      console.error('Error fetching batches:', error);
      message.error('Failed to load batches');
      setBatches([]);
    }
  };

  const fetchStudentsByBatch = async () => {
    if (!selectedDegree || !selectedDepartment || !selectedBatch) {
      return;
    }

    setFetchingStudents(true);
    try {
      const response = await axios.get(`${API_URL}/api/university-expenses/students-by-batch`, {
        params: {
          degreeLevel: selectedDegree,
          department: selectedDepartment,
          batch: selectedBatch
        }
      });

      if (response.data.success) {
        setStudents(response.data.data.students || []);
        setFilteredStudents(response.data.data.students || []);
        if (response.data.data.students.length === 0) {
          message.info('No students found in this batch');
        }
      } else {
        message.error('Failed to load students');
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      message.error('Failed to load students: ' + (error.response?.data?.message || error.message));
      setStudents([]);
      setFilteredStudents([]);
    } finally {
      setFetchingStudents(false);
    }
  };

  const handleDegreeChange = (e) => {
    const value = e.target.value;
    setSelectedDegree(value);
    setSelectedDepartment('');
    setSelectedBatch('');
    setDepartments([]);
    setBatches([]);
    setStudents([]);
    setFilteredStudents([]);
    setSelectedStudent(null);
    if (value) {
      fetchDepartments(value);
    }
  };

  const handleDepartmentChange = (e) => {
    const value = e.target.value;
    setSelectedDepartment(value);
    setSelectedBatch('');
    setBatches([]);
    setStudents([]);
    setFilteredStudents([]);
    setSelectedStudent(null);
    if (value && selectedDegree) {
      fetchBatches(selectedDegree, value);
    }
  };

  const handleBatchChange = (e) => {
    const value = e.target.value;
    setSelectedBatch(value);
    setSelectedStudent(null);
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
  };

  const handleExpenseConfigurationChange = (expenseType, field, value) => {
    setExpenseConfigurations(prev => ({
      ...prev,
      [expenseType]: {
        ...prev[expenseType],
        [field]: value
      }
    }));
  };

  const handleExpenseDetailChange = (expenseType, field, value) => {
    setExpenseDetails(prev => ({
      ...prev,
      [expenseType]: {
        ...prev[expenseType],
        [field]: value
      }
    }));
  };

  const calculateEndDate = (startDate, durationInMonths) => {
    if (!startDate || !durationInMonths) return null;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + parseInt(durationInMonths));
    return endDate;
  };

  const calculateTotalAmount = () => {
    let total = 0;
    
    Object.entries(expenseConfigurations).forEach(([expenseType, config]) => {
      if (!config || !config.enabled) return;
      
      const duration = config.durationInMonths || 1;
      const details = expenseDetails[expenseType] || {};
      
      switch(expenseType) {
        case 'bus':
          total += (details.monthlyFee || 0) * duration;
          break;
        case 'hostel':
          total += ((details.monthlyRent || 0) + (details.monthlyMessCharges || 0)) * duration;
          break;
        case 'sports':
          total += (details.monthlyFee || 0) * duration;
          break;
        case 'society':
          total += details.fee || 0;
          break;
        case 'fine':
          total += details.amount || 0;
          break;
        case 'library':
          total += (details.monthlyFee || 0) * duration;
          break;
      }
    });
    
    return total;
  };

  const validateExpenseConfigurations = () => {
    const enabledExpenses = Object.entries(expenseConfigurations)
      .filter(([_, config]) => config && config.enabled);

    if (enabledExpenses.length === 0) {
      message.error('Please enable and configure at least one expense type');
      return false;
    }

    for (const [expenseType, config] of enabledExpenses) {
      const expenseInfo = expenseTypes.find(e => e.value === expenseType);
      
      if (expenseInfo.hasDuration) {
        if (!config.durationInMonths || !config.startDate || !config.paymentDueDate) {
          message.error(`Please complete all fields for ${expenseInfo.label}`);
          return false;
        }
      } else {
        if (!config.paymentDueDate) {
          message.error(`Please select payment due date for ${expenseInfo.label}`);
          return false;
        }
      }
    }

    return true;
  };

  const validateTextInput = (value) => {
    if (!value) return true;
    return /^[a-zA-Z0-9\s\-_.,!?()&]*$/.test(value);
  };

  const validateNumberInput = (value) => {
    if (!value && value !== 0) return true;
    return /^\d*\.?\d*$/.test(value) && value >= 0;
  };

  const showSuccessToast = () => {
    message.success({
      content: 'Student expense created successfully!',
      duration: 3,
      style: {
        marginTop: '50vh',
      },
    });
  };

  const onFinish = async (values) => {
    if (!selectedStudent) {
      message.error('Please select a student first');
      return;
    }

    if (!validateExpenseConfigurations()) {
      return;
    }

    setLoading(true);
    try {
      const enabledExpenses = Object.entries(expenseConfigurations)
        .filter(([_, config]) => config && config.enabled)
        .map(([expenseType, config]) => {
          const expenseInfo = expenseTypes.find(e => e.value === expenseType);
          const baseConfig = {
            expenseTitle: expenseType,
            paymentDueDate: config.paymentDueDate,
            status: 'active'
          };

          if (expenseInfo.hasDuration) {
            return {
              ...baseConfig,
              durationInMonths: config.durationInMonths,
              startDate: config.startDate,
              endDate: calculateEndDate(config.startDate, config.durationInMonths)
            };
          } else {
            return {
              ...baseConfig,
              durationInMonths: 1,
              startDate: config.paymentDueDate,
              endDate: config.paymentDueDate
            };
          }
        });

      const payload = {
        degreeLevel: selectedDegree,
        department: selectedDepartment,
        batch: selectedBatch,
        studentId: selectedStudent.studentId,
        expenseConfigurations: enabledExpenses,
      };

      Object.entries(expenseConfigurations).forEach(([expenseType, config]) => {
        if (config && config.enabled) {
          const details = expenseDetails[expenseType] || {};
          switch(expenseType) {
            case 'bus':
              if (details.routeName || details.busStop || details.monthlyFee) {
                payload.transportDetails = {
                  routeName: details.routeName || '',
                  busStop: details.busStop || '',
                  monthlyFee: details.monthlyFee || 0
                };
              }
              break;
            case 'hostel':
              if (details.hostelName || details.roomNumber || details.roomType || details.monthlyRent || details.monthlyMessCharges) {
                payload.hostelDetails = {
                  hostelName: details.hostelName || '',
                  roomNumber: details.roomNumber || '',
                  roomType: details.roomType || 'single',
                  monthlyRent: details.monthlyRent || 0,
                  monthlyMessCharges: details.monthlyMessCharges || 0
                };
              }
              break;
            case 'sports':
              if (details.activityName || details.monthlyFee) {
                payload.sportsDetails = {
                  activityName: details.activityName || '',
                  monthlyFee: details.monthlyFee || 0
                };
              }
              break;
            case 'society':
              if (details.eventName || details.eventType || details.participationType || details.fee) {
                payload.culturalDetails = {
                  eventName: details.eventName || '',
                  eventType: details.eventType || '',
                  participationType: details.participationType || 'individual',
                  fee: details.fee || 0
                };
              }
              break;
            case 'fine':
              if (details.reason || details.fineType || details.amount) {
                payload.fineDetails = {
                  reason: details.reason || '',
                  fineType: details.fineType || 'other',
                  amount: details.amount || 0
                };
              }
              break;
            case 'library':
              if (details.membershipType || details.monthlyFee || details.maxBooks) {
                payload.libraryDetails = {
                  membershipType: details.membershipType || 'basic',
                  monthlyFee: details.monthlyFee || 0,
                  maxBooks: details.maxBooks || 5
                };
              }
              break;
          }
        }
      });

      console.log(' Sending payload:', payload);

      const response = await axios.post(`${API_URL}/api/university-expenses/student-expense`, payload);
      
      if (response.data.success) {
        showSuccessToast();
        form.resetFields();
        
        const resetConfig = {};
        expenseTypes.forEach(expense => {
          resetConfig[expense.value] = {
            enabled: false,
            durationInMonths: expense.hasDuration ? 1 : null,
            startDate: null,
            paymentDueDate: null
          };
        });
        setExpenseConfigurations(resetConfig);
        setExpenseDetails({});
        setSelectedStudent(null);
      }
    } catch (error) {
      console.error('Error creating expense:', error);
      message.error(error.response?.data?.message || 'Failed to create expense');
    } finally {
      setLoading(false);
    }
  };

  const isExpenseEnabled = (expenseType) => 
    expenseConfigurations[expenseType]?.enabled || false;

  const studentColumns = [
    {
      title: 'Student ID',
      dataIndex: 'studentId',
      key: 'studentId',
      sorter: (a, b) => a.studentId.localeCompare(b.studentId),
    },
    {
      title: 'Name',
      key: 'name',
      render: (_, record) => `${record.firstName} ${record.lastName}`,
      sorter: (a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
    },
    {
      title: 'Semester',
      dataIndex: 'currentSemester',
      key: 'currentSemester',
      render: (semester) => <Tag color="#937fa3">Sem {semester}</Tag>,
    },
    {
      title: 'Section',
      dataIndex: 'section',
      key: 'section',
      render: (section) => <Tag color="#937fa3">{section}</Tag>,
    },
    {
  title: 'Action',
  key: 'action',
  render: (_, record) => (
    <Button 
      size="small"
      onClick={() => handleStudentSelect(record)}
      icon={<UserOutlined />}
      style={{
        backgroundColor: selectedStudent?.studentId === record.studentId ? '#937fa3' : 'transparent',
        borderColor: selectedStudent?.studentId === record.studentId ? '#937fa3' : '#d9d9d9',
        color: selectedStudent?.studentId === record.studentId ? 'white' : 'rgba(0, 0, 0, 0.88)',
        boxShadow: 'none'
      }}
      onMouseEnter={(e) => {
        e.target.style.backgroundColor = selectedStudent?.studentId === record.studentId ? '#937fa3' : '#f5f5f5';
        e.target.style.borderColor = selectedStudent?.studentId === record.studentId ? '#937fa3' : '#d9d9d9';
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = selectedStudent?.studentId === record.studentId ? '#937fa3' : 'transparent';
        e.target.style.borderColor = selectedStudent?.studentId === record.studentId ? '#937fa3' : '#d9d9d9';
      }}
    >
      {selectedStudent?.studentId === record.studentId ? 'Selected' : 'Select'}
    </Button>
  )
}
  ];

  const renderExpenseCheckbox = (expenseType, expenseLabel, hasDuration) => (
    <div style={{ marginBottom: 16 }}>
      <Checkbox
  checked={isExpenseEnabled(expenseType)}
  onChange={(e) => handleExpenseConfigurationChange(expenseType, 'enabled', e.target.checked)}
  sx={{
    '&.Mui-checked': {
      color: '#937fa3',
    },
    '&:hover': {
      backgroundColor: 'transparent',
    }
  }}
>
  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
    {expenseLabel}
  </span>
</Checkbox>
      
      {isExpenseEnabled(expenseType) && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 6 }}>
          <Row gutter={16} align="middle" >
            {hasDuration && (
              <>
                <Col span={4}>
                  <Text strong >Duration (Months):</Text>
                  <InputNumber
                    size="small"
                    placeholder="Months"
                    min={1}
                    max={12}
                    value={expenseConfigurations[expenseType]?.durationInMonths}
                    onChange={(value) => handleExpenseConfigurationChange(expenseType, 'durationInMonths', value)}
                    style={{ width: '100%', marginTop: 4 ,height:'30px'}}
                  />
                </Col>
                <Col span={5}>
                  <Text strong>Start Date:</Text>
                  <DatePicker
                    size="small"
                    value={expenseConfigurations[expenseType]?.startDate}
                    onChange={(date) => handleExpenseConfigurationChange(expenseType, 'startDate', date)}
                    style={{ width: '100%', marginTop: 4 ,height:'30px'}}
                    format="MMM DD, YYYY"
                  />
                </Col>
              </>
            )}
            <Col span={hasDuration ? 5 : 10}>
              <Text strong>Due Date:</Text>
              <DatePicker
                size="small"
                value={expenseConfigurations[expenseType]?.paymentDueDate}
                onChange={(date) => handleExpenseConfigurationChange(expenseType, 'paymentDueDate', date)}
                style={{ width: '100%', marginTop: 4 ,height:'30px'}}
                format="MMM DD, YYYY"
              />
            </Col>
            <Col span={hasDuration ? 10 : 14}>
              <Text strong>Amount:</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color="green" style={{ fontSize: '14px' }}>
                  Rs. {calculateExpenseAmount(expenseType)?.toLocaleString()}
                </Tag>
                {!hasDuration && (
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: '12px' }}>
                    (One-time charge)
                  </Text>
                )}
              </div>
            </Col>
          </Row>
        </div>
      )}
    </div>
  );

  const calculateExpenseAmount = (expenseType) => {
    const config = expenseConfigurations[expenseType];
    const details = expenseDetails[expenseType] || {};
    
    if (!config || !config.enabled) return 0;

    const expenseInfo = expenseTypes.find(e => e.value === expenseType);
    const duration = expenseInfo.hasDuration ? (config.durationInMonths || 1) : 1;
    
    switch(expenseType) {
      case 'bus':
        return (details.monthlyFee || 0) * duration;
      case 'hostel':
        return ((details.monthlyRent || 0) + (details.monthlyMessCharges || 0)) * duration;
      case 'sports':
        return (details.monthlyFee || 0) * duration;
      case 'society':
        return details.fee || 0;
      case 'fine':
        return details.amount || 0;
      case 'library':
        return (details.monthlyFee || 0) * duration;
      default:
        return 0;
    }
  };

  const renderExpenseDetails = (expenseType, expenseLabel) => (
    <div style={{ 
      marginBottom: 24,
      padding: 16,
      border: '1px solid #d9d9d9',
      borderRadius: 6,
      opacity: isExpenseEnabled(expenseType) ? 1 : 0.5,
      pointerEvents: isExpenseEnabled(expenseType) ? 'auto' : 'none'
    }}>
      <Title level={5} style={{ marginBottom: 16, color: '#000' }}>
        {expenseLabel}
      </Title>

      {expenseType === 'bus' && (
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Route Name">
              <Input 
                placeholder="Enter route name" 
                value={expenseDetails.bus?.routeName || ''}
                onChange={(e) => {
                  if (validateTextInput(e.target.value)) {
                    handleExpenseDetailChange('bus', 'routeName', e.target.value);
                  }
                }}
                maxLength={50}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Bus Stop">
              <Input 
                placeholder="Enter bus stop" 
                value={expenseDetails.bus?.busStop || ''}
                onChange={(e) => {
                  if (validateTextInput(e.target.value)) {
                    handleExpenseDetailChange('bus', 'busStop', e.target.value);
                  }
                }}
                maxLength={50}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Monthly Fee (Rs.)" required={isExpenseEnabled('bus')}>
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Monthly fee"
                min={0}
                step={100}
                value={expenseDetails.bus?.monthlyFee}
                onChange={(value) => {
                  if (validateNumberInput(value)) {
                    handleExpenseDetailChange('bus', 'monthlyFee', value);
                  }
                }}
              />
            </Form.Item>
          </Col>
        </Row>
      )}

      {expenseType === 'hostel' && (
        <>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Hostel Name">
                <Input 
                  placeholder="Enter hostel name" 
                  value={expenseDetails.hostel?.hostelName || ''}
                  onChange={(e) => {
                    if (validateTextInput(e.target.value)) {
                      handleExpenseDetailChange('hostel', 'hostelName', e.target.value);
                    }
                  }}
                  maxLength={50}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Room Number">
                <Input 
                  placeholder="Enter room number" 
                  value={expenseDetails.hostel?.roomNumber || ''}
                  onChange={(e) => {
                    if (validateTextInput(e.target.value)) {
                      handleExpenseDetailChange('hostel', 'roomNumber', e.target.value);
                    }
                  }}
                  maxLength={20}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Room Type">
                <select 
                  style={{ width: '100%', height: '32px' }}
                  value={expenseDetails.hostel?.roomType || ''}
                  onChange={(e) => handleExpenseDetailChange('hostel', 'roomType', e.target.value)}
                >
                  <option value="">Select room type</option>
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                  <option value="triple">Triple</option>
                  <option value="dormitory">Dormitory</option>
                </select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Monthly Rent (Rs.)" required={isExpenseEnabled('hostel')}>
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="Monthly rent"
                  min={0}
                  step={100}
                  value={expenseDetails.hostel?.monthlyRent}
                  onChange={(value) => {
                    if (validateNumberInput(value)) {
                      handleExpenseDetailChange('hostel', 'monthlyRent', value);
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Monthly Mess Charges (Rs.)" required={isExpenseEnabled('hostel')}>
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="Mess charges"
                  min={0}
                  step={100}
                  value={expenseDetails.hostel?.monthlyMessCharges}
                  onChange={(value) => {
                    if (validateNumberInput(value)) {
                      handleExpenseDetailChange('hostel', 'monthlyMessCharges', value);
                    }
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
        </>
      )}

      {expenseType === 'sports' && (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Activity Name">
              <Input 
                placeholder="Enter activity name" 
                value={expenseDetails.sports?.activityName || ''}
                onChange={(e) => {
                  if (validateTextInput(e.target.value)) {
                    handleExpenseDetailChange('sports', 'activityName', e.target.value);
                  }
                }}
                maxLength={50}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Monthly Fee (Rs.)" required={isExpenseEnabled('sports')}>
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Monthly fee"
                min={0}
                step={100}
                value={expenseDetails.sports?.monthlyFee}
                onChange={(value) => {
                  if (validateNumberInput(value)) {
                    handleExpenseDetailChange('sports', 'monthlyFee', value);
                  }
                }}
              />
            </Form.Item>
          </Col>
        </Row>
      )}

      {expenseType === 'society' && (
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Society/Event Name">
              <Input 
                placeholder="Enter society or event name" 
                value={expenseDetails.society?.eventName || ''}
                onChange={(e) => {
                  if (validateTextInput(e.target.value)) {
                    handleExpenseDetailChange('society', 'eventName', e.target.value);
                  }
                }}
                maxLength={50}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Event Type">
              <Input 
                placeholder="Enter event type" 
                value={expenseDetails.society?.eventType || ''}
                onChange={(e) => {
                  if (validateTextInput(e.target.value)) {
                    handleExpenseDetailChange('society', 'eventType', e.target.value);
                  }
                }}
                maxLength={50}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Participation Fee (Rs.)" required={isExpenseEnabled('society')}>
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Participation fee"
                min={0}
                step={100}
                value={expenseDetails.society?.fee}
                onChange={(value) => {
                  if (validateNumberInput(value)) {
                    handleExpenseDetailChange('society', 'fee', value);
                  }
                }}
              />
            </Form.Item>
          </Col>
        </Row>
      )}

      {expenseType === 'fine' && (
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Fine Reason">
              <Input 
                placeholder="Enter reason for fine" 
                value={expenseDetails.fine?.reason || ''}
                onChange={(e) => {
                  if (validateTextInput(e.target.value)) {
                    handleExpenseDetailChange('fine', 'reason', e.target.value);
                  }
                }}
                maxLength={100}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Fine Type">
              <select 
                style={{ width: '100%' }}
                value={expenseDetails.fine?.fineType || ''}
                onChange={(e) => handleExpenseDetailChange('fine', 'fineType', e.target.value)}
              >
                <option value="">Select fine type</option>
                <option value="late_fee">Attendance Fine</option>
                <option value="damage">Damage</option>
                <option value="disciplinary">Disciplinary</option>
              </select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Fine Amount (Rs.)" required={isExpenseEnabled('fine')}>
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Fine amount"
                min={0}
                step={100}
                value={expenseDetails.fine?.amount}
                onChange={(value) => {
                  if (validateNumberInput(value)) {
                    handleExpenseDetailChange('fine', 'amount', value);
                  }
                }}
              />
            </Form.Item>
          </Col>
        </Row>
      )}

      {expenseType === 'library' && (
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Membership Type">
              <select 
                style={{ width: '100%', height: '32px' }}
                value={expenseDetails.library?.membershipType || ''}
                onChange={(e) => handleExpenseDetailChange('library', 'membershipType', e.target.value)}
              >
                <option value="">Select membership type</option>
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
                <option value="research">Research</option>
              </select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Monthly Fee (Rs.)" required={isExpenseEnabled('library')}>
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Monthly fee"
                min={0}
                step={100}
                value={expenseDetails.library?.monthlyFee}
                onChange={(value) => {
                  if (validateNumberInput(value)) {
                    handleExpenseDetailChange('library', 'monthlyFee', value);
                  }
                }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Max Books Allowed">
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Max books"
                min={1}
                value={expenseDetails.library?.maxBooks}
                onChange={(value) => {
                  if (validateNumberInput(value)) {
                    handleExpenseDetailChange('library', 'maxBooks', value);
                  }
                }}
              />
            </Form.Item>
          </Col>
        </Row>
      )}
    </div>
  );

  const enabledExpensesCount = Object.values(expenseConfigurations).filter(config => config?.enabled).length;

  return (
    <div className="container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="create-expense-title" >
            Student Expenses Management
          </h2>
        </div>
      </div>
      
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <div >
         
          <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Degree Level</label>
              <select
                className="form-control"
                value={selectedDegree}
                onChange={handleDegreeChange}
                style={{ width: '100%', height: '40px' }}
              >
                <option value="">Select Degree Level</option>
                {degreeLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Department</label>
              <select
                className="form-control"
                value={selectedDepartment}
                onChange={handleDepartmentChange}
                disabled={!selectedDegree}
                style={{ width: '100%', height: '40px' }}
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept._id || dept.departmentName} value={dept.departmentName}>
                    {dept.departmentName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Batch</label>
              <select
                className="form-control"
                value={selectedBatch}
                onChange={handleBatchChange}
                disabled={!selectedDepartment}
                style={{ width: '100%', height: '40px' }}
              >
                <option value="">Select Batch</option>
                {batches.map(batch => (
                  <option key={batch._id} value={batch.batchName}>
                    {batch.batchName}
                    
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedBatch && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <Input
                  placeholder="Search students by ID, name, or email"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: 500, height: '40px' }}
                  allowClear
                  prefix={<SearchOutlined />}
                />
              </div>
              
              {fetchingStudents ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <Spin size="large" />
                  <div style={{ marginTop: 8 }}>Loading students...</div>
                </div>
              ) : filteredStudents.length > 0 ? (
                <Table
                  columns={studentColumns}
                  dataSource={filteredStudents}
                  pagination={{ pageSize: 5 }}
                  size="middle"
                  rowKey="studentId"
                  scroll={{ x: 800 }}
                  style={{ marginTop: '16px' }}
                />
              ) : (
                <Alert
                  message="No students found in this batch"
                  type="info"
                  showIcon
                  style={{ marginTop: '16px' }}
                />
              )}
            </div>
          )}
      
        </div>

        <div style={{ marginBottom: '32px', padding: '24px', border: '1px solid #d9d9d9', borderRadius: '6px' }}>
          <Title level={4} style={{ color: '#262626', marginBottom: '16px' }}>
            Expense Selection
          </Title>
          
          <Text type="secondary" style={{ display: 'block', marginBottom: '20px' }}>
            Tick the expenses you want to add for the student.
          </Text>
          
          {expenseTypes.map(expense => (
            <div key={expense.value}>
              {renderExpenseCheckbox(expense.value, expense.label, expense.hasDuration)}
            </div>
          ))}

          {enabledExpensesCount > 0 && (
            <Alert
              message={`${enabledExpensesCount} expense type(s) selected`}
              type="info"
              style={{ marginTop: '16px' , fontSize: '16px' ,backgroundColor: '#957bab', color:'white',border:'none'}}
            />
          )}
        </div>

        <div >
          <Title level={4} style={{  marginBottom: '16px' }}>
            Expense Details
          </Title>
          
          {expenseTypes.map(expense => (
            <div key={expense.value}>
              {renderExpenseDetails(expense.value, expense.label)}
            </div>
          ))}
        </div>

        {selectedStudent && enabledExpensesCount > 0 && (
          <div style={{ marginBottom: '24px', padding: '24px', border: '1px solid #d9d9d9', borderRadius: '6px' }}>
            <Title level={4} style={{ color: '#262626', marginBottom: '20px' }}>
              Student Expense Summary
            </Title>
            
            <Row gutter={16}>
              <Col span={12}>
                <Alert
                  message={
                    <div>
                      <Title level={5} style={{ color: '#3f8600', margin: 0 }}>
                        Total Amount: Rs. {calculateTotalAmount()?.toLocaleString()}
                      </Title>
                      <Text>for {selectedStudent.firstName} {selectedStudent.lastName}</Text>
                    </div>
                  }
                  type="success"
                  showIcon
                />
              </Col>
            </Row>
          </div>
        )}
         <div style={{ marginBottom: '40px', paddingTop: '20px', clear: 'both' }}>
          <Button 
            type="primary" 
            htmlType="submit" 
            icon={<SaveOutlined />}
            loading={loading}
            size="large"
            className='expense-btn'
            style={{ float: 'right', marginBottom: '20px' }}
          >
            Create Expense
          </Button>
        </div>
        
      

      </Form>
    </div>
  );
};

export default CreateStudentExpense;