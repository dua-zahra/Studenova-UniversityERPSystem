import React, { useState, useEffect } from 'react';
import API_URL from '../../../config';

import axios from 'axios';
import { 
  Form, Input, Button, DatePicker, InputNumber, 
  Row, Col, Typography, Tag, Alert,
  message, Radio, Table, Spin, Select
} from 'antd';
import { 
  SaveOutlined, UserOutlined, SearchOutlined,
  FileTextOutlined, DollarOutlined
} from '@ant-design/icons';
import "../../../assets/style.css";

const { Title, Text } = Typography;
const { Option } = Select;

const CreateRepeatFreshCourseFee = () => {
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

  const [courseFeeData, setCourseFeeData] = useState({
    courseType: '',
    courseName: '',
    courseCode: '',
    amount: '',
    dueDate: null,
    description: ''
  });

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
      const response = await axios.get(`${API_URL}/degree-levels`);
      setDegreeLevels(response.data);
    } catch (error) {
      console.error('Error fetching degree levels:', error);
      message.error('Failed to load degree levels');
    }
  };

  const fetchDepartments = async (degreeLevel) => {
    try {
      const response = await axios.get(`${API_URL}/departments/by-degree`, {
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
      const response = await axios.get(`${API_URL}/teacher-assignment/batches/active`, {
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
      const response = await axios.get(`${API_URL}/university-expenses/students-by-batch`, {
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

  const handleCourseFeeChange = (field, value) => {
    setCourseFeeData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateInput = () => {
    if (!selectedStudent) {
      message.error('Please select a student first');
      return false;
    }

    if (!courseFeeData.courseType) {
      message.error('Please select course type');
      return false;
    }

    if (!courseFeeData.courseName) {
      message.error('Please enter course name');
      return false;
    }

    if (!courseFeeData.amount || courseFeeData.amount <= 0) {
      message.error('Please enter a valid amount');
      return false;
    }

    if (!courseFeeData.dueDate) {
      message.error('Please select due date');
      return false;
    }

    return true;
  };

  const showSuccessToast = () => {
    message.success({
      content: 'Course fee created successfully!',
      duration: 3,
      style: {
        marginTop: '50vh',
      },
    });
  };

  const onFinish = async (values) => {
    if (!validateInput()) {
      return;
    }

    setLoading(true);
    try {
      const payload = {
        studentId: selectedStudent.studentId,
        courseType: courseFeeData.courseType,
        courseName: courseFeeData.courseName,
        courseCode: courseFeeData.courseCode || '',
        amount: parseFloat(courseFeeData.amount),
        dueDate: courseFeeData.dueDate.toISOString(),
        description: courseFeeData.description || `${courseFeeData.courseType === 'repeat' ? 'Repeat' : 'Fresh'} Course Fee - ${courseFeeData.courseName}`
      };

      console.log(' Sending course fee payload:', payload);

      const response = await axios.post(`${API_URL}/repeat-fresh-course-fees`, payload);
      
      if (response.data.success) {
        showSuccessToast();
        form.resetFields();
        setCourseFeeData({
          courseType: '',
          courseName: '',
          courseCode: '',
          amount: '',
          dueDate: null,
          description: ''
        });
        setSelectedStudent(null);
      }
    } catch (error) {
      console.error('Error creating course fee:', error);
      message.error(error.response?.data?.message || 'Failed to create course fee');
    } finally {
      setLoading(false);
    }
  };

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
      title: 'Email',
      dataIndex: 'universityEmail',
      key: 'universityEmail',
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

  const renderCourseTypeSection = () => (
    <div style={{ marginBottom: '32px', padding: '24px', border: '1px solid #d9d9d9', borderRadius: '6px' }}>
      <Title level={4} style={{ color: '#262626', marginBottom: '16px' }}>
        Course Type Selection
      </Title>
      
      <Text type="secondary" style={{ display: 'block', marginBottom: '20px' }}>
        Select whether this is a repeat course or fresh course fee.
      </Text>
      
      <Radio.Group 
        value={courseFeeData.courseType}
        onChange={(e) => handleCourseFeeChange('courseType', e.target.value)}
        style={{ width: '100%' }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Radio value="repeat" style={{ fontSize: '16px', padding: '16px', border: '1px solid #d9d9d9', borderRadius: '6px', width: '100%' }}>
              <div>
                <Title level={5} style={{ margin: 0, color: '#d46b08' }}>Repeat Course</Title>
                <Text type="secondary">For courses the student needs to repeat</Text>
              </div>
            </Radio>
          </Col>
          <Col span={12}>
            <Radio value="fresh" style={{ fontSize: '16px', padding: '16px', border: '1px solid #d9d9d9', borderRadius: '6px', width: '100%' }}>
              <div>
                <Title level={5} style={{ margin: 0, color: '#389e0d' }}>Fresh Course</Title>
                <Text type="secondary">For new/additional courses</Text>
              </div>
            </Radio>
          </Col>
        </Row>
      </Radio.Group>

      {courseFeeData.courseType && (
        <Alert
          message={`${courseFeeData.courseType === 'repeat' ? 'Repeat' : 'Fresh'} Course Fee Selected`}
          type="info"
          style={{ marginTop: '16px', fontSize: '16px', backgroundColor: '#957bab', color: 'white', border: 'none' }}
        />
      )}
    </div>
  );

  const renderCourseDetailsSection = () => (
    <div style={{ marginBottom: '32px', padding: '24px', border: '1px solid #d9d9d9', borderRadius: '6px' }}>
      <Title level={4} style={{ color: '#262626', marginBottom: '16px' }}>
        Course Details
      </Title>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item 
            label="Course Name" 
            required
            rules={[{ required: true, message: 'Please enter course name' }]}
          >
            <Input 
              placeholder="Enter course name"
              value={courseFeeData.courseName}
              onChange={(e) => handleCourseFeeChange('courseName', e.target.value)}
              size="large"
              prefix={<FileTextOutlined />}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Course Code (Optional)">
            <Input 
              placeholder="Enter course code"
              value={courseFeeData.courseCode}
              onChange={(e) => handleCourseFeeChange('courseCode', e.target.value)}
              size="large"
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item 
            label="Amount (Rs.)" 
            required
            rules={[{ required: true, message: 'Please enter amount' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Enter amount"
              value={courseFeeData.amount}
              onChange={(value) => handleCourseFeeChange('amount', value)}
              min={0}
              step={100}
              size="large"
              prefix={<DollarOutlined />}
              formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/Rs.\s?|(,*)/g, '')}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item 
            label="Due Date" 
            required
            rules={[{ required: true, message: 'Please select due date' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              value={courseFeeData.dueDate}
              onChange={(date) => handleCourseFeeChange('dueDate', date)}
              size="large"
              format="MMM DD, YYYY"
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Description (Optional)">
        <Input.TextArea
          placeholder="Enter description for this course fee"
          value={courseFeeData.description}
          onChange={(e) => handleCourseFeeChange('description', e.target.value)}
          rows={3}
        />
      </Form.Item>
    </div>
  );

  return (
    <div className="enrolledcourse container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="enrolledcourse-title">
            Repeat/Fresh Course Fee 
          </h2>
          
        </div>
      </div>
      
      <Form form={form} layout="vertical" onFinish={onFinish}>
        {/* Student Selection Section */}
        <div>
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

        {/* Course Type Selection */}
        {selectedStudent && renderCourseTypeSection()}

        {/* Course Details */}
        {selectedStudent && courseFeeData.courseType && renderCourseDetailsSection()}

        {/* Summary Section */}
        {selectedStudent && courseFeeData.courseType && courseFeeData.amount && (
          <div style={{ marginBottom: '24px', padding: '24px', border: '1px solid #d9d9d9', borderRadius: '6px' }}>
            <Title level={4} style={{ color: '#262626', marginBottom: '20px' }}>
              Course Fee Summary
            </Title>
            
            <Row gutter={16}>
              <Col span={12}>
                <Alert
                  message={
                    <div>
                      <Title level={5} style={{ color: '#3f8600', margin: 0 }}>
                        Total Amount: Rs. {parseFloat(courseFeeData.amount).toLocaleString()}
                      </Title>
                      <Text>
                        {courseFeeData.courseType === 'repeat' ? 'Repeat' : 'Fresh'} Course Fee for {selectedStudent.firstName} {selectedStudent.lastName}
                      </Text>
                      <br />
                      <Text type="secondary">
                        Course: {courseFeeData.courseName}
                        {courseFeeData.courseCode && ` (${courseFeeData.courseCode})`}
                      </Text>
                      <br />
                      <Text type="secondary">
                        Due Date: {courseFeeData.dueDate ? courseFeeData.dueDate.format('MMM DD, YYYY') : 'Not set'}
                      </Text>
                    </div>
                  }
                  type="success"
                  showIcon
                />
              </Col>
            </Row>
          </div>
        )}

        {/* Submit Button */}
        <div style={{ marginBottom: '40px', paddingTop: '20px', clear: 'both' }}>
          <Button 
            type="primary" 
            htmlType="submit" 
            icon={<SaveOutlined />}
            loading={loading}
            size="large"
            className='expense-btn'
            style={{ float: 'right', marginBottom: '20px' }}
            disabled={!selectedStudent || !courseFeeData.courseType || !courseFeeData.courseName || !courseFeeData.amount || !courseFeeData.dueDate}
          >
            Create Course Fee
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default CreateRepeatFreshCourseFee;