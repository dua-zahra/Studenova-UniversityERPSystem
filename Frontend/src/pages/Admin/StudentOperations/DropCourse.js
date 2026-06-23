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
  DeleteOutlined
} from '@ant-design/icons';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const { Title, Text } = Typography;
const { Step } = Steps;
const { Option } = Select;
const { TextArea } = Input;

const DropCourse = () => {
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

  const [studentAcademicData, setStudentAcademicData] = useState(null);
  const [currentCourses, setCurrentCourses] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);

  const [dropData, setDropData] = useState({
    courseCode: '',
    semesterNumber: '',
    reason: ''
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

      console.log('Students response:', response.data);

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
      console.log('Academic data response:', response.data);
      
      if (response.data.success) {
        const academicData = response.data.data;
        setStudentAcademicData(academicData);
        
        const currentSemester = academicData.currentSemester;
        let courses = [];
        
        if (academicData.courses && Array.isArray(academicData.courses)) {
          courses = academicData.courses.filter(course => 
            course.semester === currentSemester && 
            (course.status === 'registered' || course.status === 'in-progress')
          );
        } else if (academicData.academicProgress?.semesters) {
          const currentSemesterData = academicData.academicProgress.semesters.find(
            sem => sem.semesterNumber === currentSemester
          );
          courses = currentSemesterData?.courses?.filter(course => 
            course.status === 'registered' || course.status === 'in-progress'
          ) || [];
        } else if (academicData.enrolledCourses && Array.isArray(academicData.enrolledCourses)) {
          courses = academicData.enrolledCourses.filter(course => 
            course.semester === currentSemester && 
            (course.status === 'registered' || course.status === 'in-progress')
          );
        }
        
        console.log('Current courses:', courses);
        setCurrentCourses(courses);
        
        if (courses.length > 0) {
          setCurrentStep(1);
        } else {
          toast.warning('No courses found for current semester');
        }
      } else {
      }
    } catch (error) {
      console.error('Error fetching academic data:', error);
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
    setCurrentCourses([]);
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
    setCurrentCourses([]);
    if (value && selectedDegree) {
      fetchBatches(selectedDegree, value);
    }
  };

  const handleBatchChange = (value) => {
    setSelectedBatch(value);
    setSelectedStudent(null);
    setStudentAcademicData(null);
    setCurrentCourses([]);
    toast.info(`Selected batch: ${value}`);
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setStudentAcademicData(null);
    setCurrentCourses([]);
    setDropData({ courseCode: '', semesterNumber: '', reason: '' });
    setCurrentStep(0);
  };

  const validateDropOperation = () => {
    if (!dropData.courseCode) {
      toast.error('Please select a course to drop');
      return false;
    }

    if (!dropData.reason.trim()) {
      toast.error('Please provide a reason for dropping the course');
      return false;
    }

    return true;
  };

  const executeDropCourse = async () => {
    if (!validateDropOperation()) return;

    setLoading(true);
    try {
      const payload = {
        ...dropData,
        semesterNumber: studentAcademicData.currentSemester
      };

      console.log('Drop course payload:', payload);

      const response = await axiosInstance.post(
        `${API_URL}/api/students/${selectedStudent._id}/drop-course`,
        payload
      );

      console.log('Drop course response:', response.data);

      if (response.data.success) {
        toast.success('Course dropped successfully');
        setCurrentStep(2);
        await fetchStudentAcademicData();
      } else {
        toast.error(response.data.message || 'Failed to drop course');
      }
    } catch (error) {
      console.error('Error dropping course:', error);
      toast.error(error.response?.data?.message || 'Failed to drop course');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    executeDropCourse();
  };

  const handleReset = () => {
    setSelectedStudent(null);
    setCurrentStep(0);
    setStudentAcademicData(null);
    setCurrentCourses([]);
    setDropData({ courseCode: '', semesterNumber: '', reason: '' });
    toast.info('Operation reset. You can perform another drop operation.');
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

  const renderDropForm = () => {
    return (
      <Card title="Drop Course" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="Select Course to Drop" required>
            <Select
              value={dropData.courseCode}
              onChange={(value) => {
                const course = currentCourses.find(c => c.courseCode === value);
                setDropData({
                  ...dropData,
                  courseCode: value,
                  semesterNumber: studentAcademicData.currentSemester
                });
              }}
              placeholder="Choose course from current semester"
              loading={loading}
            >
              {currentCourses.map(course => (
                <Option key={course.courseCode} value={course.courseCode}>
                  {course.courseCode} - {course.courseName} ({course.credits || course.creditsEarned || 0} credits)
                </Option>
              ))}
            </Select>
          </Form.Item>

          {currentCourses.length === 0 && (
            <Alert
              message="No courses available"
              description="There are no registered or in-progress courses in the current semester that can be dropped."
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item label="Reason for Dropping" required>
            <TextArea
              rows={3}
              value={dropData.reason}
              onChange={(e) => setDropData({ ...dropData, reason: e.target.value })}
              placeholder="Explain why you want to drop this course..."
              disabled={currentCourses.length === 0}
            />
          </Form.Item>

          {dropData.courseCode && (
            <Alert
              message="Note"
              description={`Dropping this course will reduce your semester credits. Please ensure this is the correct course.`}
              type="info"
              showIcon
            />
          )}
        </Form>
      </Card>
    );
  };

  const renderConfirmation = () => (
    <Card title="Operation Completed" style={{ marginBottom: 16 }}>
      <Alert
        message="Drop Course Successful"
        description="The course has been dropped successfully from the student's current semester."
        type="success"
        showIcon
      />
      
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Button type="primary" onClick={handleReset}>
          Drop Another Course
        </Button>
      </div>
    </Card>
  );

  const steps = [
    {
      title: 'Select Student',
      content: (
        <Card title="Select a Student" style={{ marginBottom: 16 }}>
          <Text>Please select a student from the list above to proceed with dropping a course.</Text>
        </Card>
      ),
    },
    {
      title: 'Drop Course',
      content: (
        <>
          {renderStudentInfo()}
          {renderDropForm()}
        </>
      ),
    },
    {
      title: 'Completion',
      content: renderConfirmation(),
    },
  ];

  return (
    <div className="drop container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="drop-title">
            Drop Course 
          </h2>
         
        </div>
      </div>

      {/* Student Selection Section */}
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

      {selectedStudent && (
        <Card title="Drop Course Operation" style={{ marginBottom: 24 }}>
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
                className="btn btn-primary"
                loading={loading}
                disabled={currentCourses.length === 0}
                icon={<SaveOutlined />}
              >
                Drop Course
              </Button>
            </div>
          )}
        </Card>
      )}

      <ToastContainer position="top-right" autoClose={5000} />
    </div>
  );
};

export default DropCourse;