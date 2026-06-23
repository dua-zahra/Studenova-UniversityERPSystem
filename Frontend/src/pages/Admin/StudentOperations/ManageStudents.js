import React, { useState, useEffect } from 'react';
import axiosInstance  from '../../../axiosConfig';
import "../../../assets/style.css";
import API_URL from '../../../config';

import { 
  Form, Input, Button, Select, 
  Row, Col, Typography, Tag, Alert, Card,
  Table, Spin, Descriptions, Steps
} from 'antd';
import { 
  SaveOutlined, UserOutlined, SearchOutlined,
  PauseOutlined, UnlockOutlined
} from '@ant-design/icons';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const { Title, Text } = Typography;
const { Step } = Steps;
const { Option } = Select;
const { TextArea } = Input;

const FreezeUnfreeze = () => {
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

  const [operationType, setOperationType] = useState('');
  const [studentAcademicData, setStudentAcademicData] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  const [freezeData, setFreezeData] = useState({
    semesterNumber: '',
    reason: ''
  });

  const [unfreezeData, setUnfreezeData] = useState({
    semesterNumber: '',
    newBatchId: ''
  });

  const operationTypes = [
    { value: 'freeze', label: 'Freeze Semester', icon: <PauseOutlined />, color: 'orange' },
    { value: 'unfreeze', label: 'Unfreeze Semester', icon: <UnlockOutlined />, color: 'green' }
  ];

  useEffect(() => {
    fetchDegreeLevels();
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      fetchStudentsByBatch();
    }
  }, [selectedBatch]);

  useEffect(() => {
    if (selectedStudent) {
      fetchStudentAcademicData();
    }
  }, [selectedStudent]);

  useEffect(() => {
    if (searchText) {
      const filtered = students.filter(student => 
        student.studentId?.toLowerCase().includes(searchText.toLowerCase()) ||
        student.firstName?.toLowerCase().includes(searchText.toLowerCase()) ||
        student.lastName?.toLowerCase().includes(searchText.toLowerCase()) ||
        student.universityEmail?.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredStudents(filtered);
    } else {
      setFilteredStudents(students);
    }
  }, [searchText, students]);

  const fetchDegreeLevels = async () => {
    try {
      const response = await axiosInstance.get(`${API_URL}/api/degree-levels`);
      setDegreeLevels(response.data);
    } catch (error) {
      console.error('Error fetching degree levels:', error);
    }
  };

  const fetchDepartments = async (degreeLevel) => {
    try {
      const response = await axiosInstance.get(`${API_URL}/api/departments/by-degree`, {
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
    }
  };

  const fetchBatches = async (degreeLevel, department) => {
    try {
      const response = await axiosInstance.get(`${API_URL}/api/teacher-assignment/batches/active`, {
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
      if (batchesData.length > 0) {
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      setBatches([]);
    }
  };

  const fetchStudentsByBatch = async () => {
    if (!selectedDegree || !selectedDepartment || !selectedBatch) {
      return;
    }

    setFetchingStudents(true);
    try {
      const response = await axiosInstance.get(`${API_URL}/api/students/by-batch`, {
        params: {
          degreeLevel: selectedDegree,
          department: selectedDepartment,
          batch: selectedBatch
        }
      });

      if (response.data.success) {
        const studentsData = response.data.data?.students || [];
        setStudents(studentsData);
        setFilteredStudents(studentsData);
        if (studentsData.length === 0) {
          toast.info('No students found in this batch');
        } else {
        }
      } else {
        toast.error('Failed to load students');
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Failed to load students: ' + (error.response?.data?.message || error.message));
      setStudents([]);
      setFilteredStudents([]);
    } finally {
      setFetchingStudents(false);
    }
  };

  const fetchStudentAcademicData = async () => {
    if (!selectedStudent) return;

    setLoading(true);
    try {
      const response = await axiosInstance.get(`${API_URL}/api/students/${selectedStudent._id}/academic-status`);
      
      if (response.data.success) {
        setStudentAcademicData(response.data.data);
        toast.success('Student academic data loaded successfully');
      } else {
        toast.error('Failed to load academic data');
      }
    } catch (error) {
      console.error('Error fetching academic data:', error);
      toast.error('Failed to load student academic data');
    } finally {
      setLoading(false);
    }
  };

  const handleDegreeChange = (value) => {
    setSelectedDegree(value);
    setSelectedDepartment('');
    setSelectedBatch('');
    setDepartments([]);
    setBatches([]);
    setStudents([]);
    setFilteredStudents([]);
    setSelectedStudent(null);
    setStudentAcademicData(null);
    if (value) {
      fetchDepartments(value);
    }
  };

  const handleDepartmentChange = (value) => {
    setSelectedDepartment(value);
    setSelectedBatch('');
    setBatches([]);
    setStudents([]);
    setFilteredStudents([]);
    setSelectedStudent(null);
    setStudentAcademicData(null);
    if (value && selectedDegree) {
      fetchBatches(selectedDegree, value);
    }
  };

  const handleBatchChange = (value) => {
    setSelectedBatch(value);
    setSelectedStudent(null);
    setStudentAcademicData(null);
    toast.info(`Selected batch: ${value}`);
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setStudentAcademicData(null);
    setOperationType('');
    setCurrentStep(0);
    toast.success(`Selected student: ${student.firstName} ${student.lastName}`);
  };

  const handleOperationTypeSelect = (type) => {
    setOperationType(type);
    setCurrentStep(1);
    
    // Reset operation data
    setFreezeData({ semesterNumber: '', reason: '' });
    setUnfreezeData({ semesterNumber: '', newBatchId: '' });

    const operation = operationTypes.find(op => op.value === type);
    toast.info(`Selected operation: ${operation?.label}`);
  };

  // Validation functions
  const validateFreezeOperation = () => {
    if (!freezeData.reason.trim()) {
      toast.error('Please provide a reason for freezing the semester');
      return false;
    }

    if (studentAcademicData?.status === 'inactive') {
      toast.error('Student is already inactive');
      return false;
    }

    return true;
  };

  const validateUnfreezeOperation = () => {
    if (!unfreezeData.semesterNumber) {
      toast.error('Please select a semester to unfreeze');
      return false;
    }

    if (!studentAcademicData?.frozenSemesters?.includes(parseInt(unfreezeData.semesterNumber))) {
      toast.error('Selected semester is not frozen');
      return false;
    }

    return true;
  };

  // API call functions
  const executeFreezeSemester = async () => {
    if (!validateFreezeOperation()) return;

    setLoading(true);
    try {
      const response = await axiosInstance.post(
        `${API_URL}/api/students/${selectedStudent._id}/freeze-semester`,
        {
          semesterNumber: studentAcademicData.currentSemester,
          reason: freezeData.reason
        }
      );

      if (response.data.success) {
        toast.success('Semester frozen successfully');
        setCurrentStep(2);
        await fetchStudentAcademicData();
      }
    } catch (error) {
      console.error('Error freezing semester:', error);
      toast.error(error.response?.data?.message || 'Failed to freeze semester');
    } finally {
      setLoading(false);
    }
  };

  const executeUnfreezeSemester = async () => {
    if (!validateUnfreezeOperation()) return;

    setLoading(true);
    try {
      const response = await axiosInstance.post(
        `${API_URL}/api/students/${selectedStudent._id}/unfreeze-semester`,
        unfreezeData
      );

      if (response.data.success) {
        toast.success('Semester unfrozen successfully');
        setCurrentStep(2);
        await fetchStudentAcademicData();
      }
    } catch (error) {
      console.error('Error unfreezing semester:', error);
      toast.error(error.response?.data?.message || 'Failed to unfreeze semester');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    switch (operationType) {
      case 'freeze':
        executeFreezeSemester();
        break;
      case 'unfreeze':
        executeUnfreezeSemester();
        break;
      default:
        toast.error('Please select an operation type');
    }
  };

  const handleReset = () => {
    setOperationType('');
    setSelectedStudent(null);
    setCurrentStep(0);
    setStudentAcademicData(null);
    toast.info('Operation reset. You can perform another operation.');
  };

  const studentColumns = [
    {
      title: 'Student ID',
      dataIndex: 'studentId',
      key: 'studentId',
      sorter: (a, b) => a.studentId?.localeCompare(b.studentId),
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={
          status === 'active' ? 'green' : 
          status === 'inactive' ? 'orange' : 
          status === 'graduated' ? 'blue' : 'red'
        }>
          {status?.toUpperCase()}
        </Tag>
      ),
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
            backgroundColor: selectedStudent?._id === record._id ? '#937fa3' : 'transparent',
            borderColor: selectedStudent?._id === record._id ? '#937fa3' : '#d9d9d9',
            color: selectedStudent?._id === record._id ? 'white' : 'rgba(0, 0, 0, 0.88)',
          }}
        >
          {selectedStudent?._id === record._id ? 'Selected' : 'Select'}
        </Button>
      )
    }
  ];

  const renderStudentInfo = () => {
    if (!selectedStudent || !studentAcademicData) return null;

    return (
      <Card title="Student Information" style={{ marginBottom: 16 }}>
        <Descriptions size="small" column={2}>
          <Descriptions.Item label="Student ID">{selectedStudent.studentId}</Descriptions.Item>
          <Descriptions.Item label="Name">{selectedStudent.firstName} {selectedStudent.lastName}</Descriptions.Item>
          <Descriptions.Item label="Current Semester">Semester {studentAcademicData.currentSemester}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={selectedStudent.status === 'active' ? 'green' : 'orange'}>
              {selectedStudent.status?.toUpperCase()}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Credits Earned">
            {studentAcademicData.academicProgress?.totalCreditsEarned || 0} / {studentAcademicData.academicProgress?.totalCreditsRequired || 0}
          </Descriptions.Item>
          <Descriptions.Item label="GPA">
            {studentAcademicData.academicProgress?.cumulativeGPA?.toFixed(2) || '0.00'}
          </Descriptions.Item>
        </Descriptions>

        {studentAcademicData.frozenSemesters && studentAcademicData.frozenSemesters.length > 0 && (
          <Alert
            message={`Frozen Semesters: ${studentAcademicData.frozenSemesters.join(', ')}`}
            type="warning"
            showIcon
            style={{ marginTop: 8 }}
          />
        )}
      </Card>
    );
  };

  const renderOperationSelection = () => (
    <Card title="Select Operation Type" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        {operationTypes.map(op => (
          <Col span={12} key={op.value}>
            <Card
              hoverable
              style={{
                border: operationType === op.value ? `2px solid #937fa3` : '1px solid #d9d9d9',
                textAlign: 'center'
              }}
              onClick={() => handleOperationTypeSelect(op.value)}
            >
              <div style={{ fontSize: '24px', marginBottom: 8, color: op.color }}>
                {op.icon}
              </div>
              <Text strong>{op.label}</Text>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );

  const renderFreezeForm = () => (
    <Card title="Freeze Current Semester" style={{ marginBottom: 16 }}>
      <Alert
        message="Warning"
        description="Freezing the semester will set the student status to inactive and pause all academic activities. The student will need to unfreeze to continue studies."
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <Form layout="vertical">
        <Form.Item label="Current Semester">
          <Input 
            value={`Semester ${studentAcademicData?.currentSemester}`} 
            disabled 
          />
        </Form.Item>

        <Form.Item label="Reason for Freeze" required>
          <TextArea
            rows={3}
            value={freezeData.reason}
            onChange={(e) => setFreezeData({ ...freezeData, reason: e.target.value })}
            placeholder="Explain why you want to freeze this semester..."
          />
        </Form.Item>
      </Form>
    </Card>
  );

  const renderUnfreezeForm = () => (
    <Card title="Unfreeze Semester" style={{ marginBottom: 16 }}>
      <Form layout="vertical">
        <Form.Item label="Select Frozen Semester" required>
          <Select
            value={unfreezeData.semesterNumber}
            onChange={(value) => setUnfreezeData({ ...unfreezeData, semesterNumber: value })}
            placeholder="Choose frozen semester"
          >
            {studentAcademicData?.frozenSemesters?.map(sem => (
              <Option key={sem} value={sem}>Semester {sem}</Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="Transfer to New Batch (Optional)">
          <Select
            value={unfreezeData.newBatchId}
            onChange={(value) => setUnfreezeData({ ...unfreezeData, newBatchId: value })}
            placeholder="Select target batch (optional)"
            allowClear
          >
            <Option value="current">Continue in Current Batch</Option>
          </Select>
        </Form.Item>

        <Alert
          message="Note"
          description="Unfreezing will reactivate the student and allow them to continue their studies from where they left off."
          type="info"
          showIcon
        />
      </Form>
    </Card>
  );

  const renderOperationForm = () => {
    switch (operationType) {
      case 'freeze':
        return renderFreezeForm();
      case 'unfreeze':
        return renderUnfreezeForm();
      default:
        return null;
    }
  };

  const renderConfirmation = () => (
    <Card title="Operation Completed" style={{ marginBottom: 16 }}>
      <Alert
        message="Operation Successful"
        description={`The ${operationTypes.find(op => op.value === operationType)?.label.toLowerCase()} operation has been completed successfully.`}
        type="success"
        showIcon
      />
      
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Button type="primary" onClick={handleReset}>
          Perform Another Operation
        </Button>
      </div>
    </Card>
  );

  const steps = [
    {
      title: 'Select Operation',
      content: renderOperationSelection(),
    },
    {
      title: 'Configure Operation',
      content: (
        <>
          {renderStudentInfo()}
          {renderOperationForm()}
        </>
      ),
    },
    {
      title: 'Completion',
      content: renderConfirmation(),
    },
  ];

  return (
    <div className="freeze container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="freeze-title">
            Freeze/Unfreeze Semester 
          </h2>
        
        </div>
      </div>

      <Card title="Student Selection" style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Degree Level">
              <Select
                value={selectedDegree}
                onChange={handleDegreeChange}
                placeholder="Select Degree Level"
                allowClear
              >
                {degreeLevels.map(level => (
                  <Option key={level} value={level}>{level}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={8}>
            <Form.Item label="Department">
              <Select
                value={selectedDepartment}
                onChange={handleDepartmentChange}
                disabled={!selectedDegree}
                placeholder="Select Department"
                allowClear
              >
                {departments.map(dept => (
                  <Option key={dept._id || dept.departmentName} value={dept.departmentName}>
                    {dept.departmentName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={8}>
            <Form.Item label="Batch">
              <Select
                value={selectedBatch}
                onChange={handleBatchChange}
                disabled={!selectedDepartment}
                placeholder="Select Batch"
                allowClear
              >
                {batches.map(batch => (
                  <Option key={batch._id} value={batch.batchName}>
                    {batch.batchName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {selectedBatch && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <Input
                placeholder="Search students by ID, name, or email"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 400 }}
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
                rowKey="_id"
                scroll={{ x: 800 }}
              />
            ) : (
              <Alert
                message="No students found in this batch"
                type="info"
                showIcon
              />
            )}
          </div>
        )}
      </Card>

      {/* Operation Steps */}
      {selectedStudent && (
        <Card title="Freeze/Unfreeze Operation" style={{ marginBottom: 24 }}>
          <Steps current={currentStep} style={{ marginBottom: 24 }}>
            {steps.map((step, index) => (
              <Step key={step.title} title={step.title} />
            ))}
          </Steps>

          <div>{steps[currentStep].content}</div>

          {currentStep === 1 && (
            <div className='button-container'>
              <Button  
              className="btn btn-secondary"
              onClick={() => setCurrentStep(0)}>
                Back
              </Button>
              <Button 
                type="primary" 
                onClick={handleNext}
                loading={loading}
                icon={<SaveOutlined />}
                className="btn btn-primary"
              >
                Submit
              </Button>
            </div>
          )}
        </Card>
      )}

      <ToastContainer position="top-right" autoClose={5000} />
    </div>
  );
};

export default FreezeUnfreeze;