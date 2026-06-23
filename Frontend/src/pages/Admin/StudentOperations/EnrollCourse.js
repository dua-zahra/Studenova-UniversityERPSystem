import React, { useState, useEffect } from 'react';
import axios from 'axios';
import "../../../assets/style.css";
import API_URL from '../../../config';

import { 
  Form, Input, Button, Select, 
  Row, Col, Typography, Tag, Alert, Card,
  Table, Spin, Descriptions, Steps, Tabs, Modal
} from 'antd';
import { 
  SaveOutlined, UserOutlined, SearchOutlined,
  ReloadOutlined, PlusOutlined, BookOutlined,
  InfoCircleOutlined, ExclamationCircleOutlined,
  ClockCircleOutlined, TeamOutlined
} from '@ant-design/icons';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const { Title, Text } = Typography;
const { Step } = Steps;
const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const CourseEnrollment = () => {
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

  const [activeTab, setActiveTab] = useState('repeat');
  const [studentAcademicData, setStudentAcademicData] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  const [repeatableCourses, setRepeatableCourses] = useState([]);
  const [selectedRepeatCourse, setSelectedRepeatCourse] = useState(null);
  const [repeatData, setRepeatData] = useState({
    courseCode: '',
    originalSemester: '',
    reason: 'Academic'
  });

  const [availableFreshCourses, setAvailableFreshCourses] = useState([]);
  const [selectedFreshCourse, setSelectedFreshCourse] = useState(null);
  const [freshData, setFreshData] = useState({
    courseCode: '',
    originalSemester: '',
    reason: 'Makeup course'
  });

  const [teachingBatches, setTeachingBatches] = useState({});

  const [creditLimits, setCreditLimits] = useState({});

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
      fetchCreditLimits();
    }
  }, [selectedStudent]);

  useEffect(() => {
    if (selectedStudent && studentAcademicData) {
      if (activeTab === 'repeat') {
        fetchRepeatableCourses();
      } else {
        fetchAvailableFreshCourses();
      }
    }
  }, [selectedStudent, studentAcademicData, activeTab]);

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
      const response = await axios.get(`${API_URL}/degree-levels`);
      setDegreeLevels(response.data);
    } catch (error) {
      console.error('Error fetching degree levels:', error);
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
      setBatches([]);
    }
  };

  const fetchStudentsByBatch = async () => {
    if (!selectedDegree || !selectedDepartment || !selectedBatch) {
      return;
    }

    setFetchingStudents(true);
    try {
      const response = await axios.get(`${API_URL}/students/by-batch`, {
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
      const response = await axios.get(`${API_URL}/students/${selectedStudent._id}/academic-status`);
      
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

  const fetchCreditLimits = async () => {
    if (!selectedStudent) return;

    try {
      const response = await axios.get(`${API_URL}/students/${selectedStudent._id}/credit-limits`);
      
      if (response.data.success) {
        setCreditLimits(response.data.data.creditLimits);
      }
    } catch (error) {
      console.error('Error fetching credit limits:', error);
    }
  };

  const fetchRepeatableCourses = async () => {
    if (!selectedStudent) return;

    try {
      const response = await axios.get(`${API_URL}/students/${selectedStudent._id}/repeatable-courses`);
      
      if (response.data.success) {
        setRepeatableCourses(response.data.data);
      } else {
        setRepeatableCourses([]);
      }
    } catch (error) {
      console.error('Error fetching repeatable courses:', error);
      setRepeatableCourses([]);
    }
  };

  const fetchAvailableFreshCourses = async () => {
    if (!selectedStudent) return;

    try {
      const response = await axios.get(`${API_URL}/students/${selectedStudent._id}/available-fresh-courses`);
      
      if (response.data.success) {
        const pastCourses = response.data.data.filter(course => 
          course.originalSemester < selectedStudent.currentSemester
        );
        setAvailableFreshCourses(pastCourses);
        
        await fetchTeachingBatches(pastCourses);
        
        if (pastCourses.length === 0) {
          toast.info('No past semester courses available for fresh enrollment');
        }
      } else {
        setAvailableFreshCourses([]);
      }
    } catch (error) {
      console.error('Error fetching available fresh courses:', error);
      setAvailableFreshCourses([]);
    }
  };

  const fetchTeachingBatches = async (courses) => {
    if (!courses.length || !selectedStudent) return;

    const batchInfo = {};
    
    try {
      for (const course of courses) {
        try {
          const response = await axios.get(`${API_URL}/batches/active-for-course`, {
            params: {
              courseCode: course.courseCode,
              targetSemester: course.originalSemester,
              department: selectedStudent.department,
              degreeLevel: selectedStudent.degreeLevel
            }
          });

          if (response.data.success && response.data.data) {
            batchInfo[course.courseCode] = response.data.data;
          }
        } catch (error) {
          console.error(`Error fetching batch for course ${course.courseCode}:`, error);
          batchInfo[course.courseCode] = null;
        }
      }
      
      setTeachingBatches(batchInfo);
    } catch (error) {
      console.error('Error fetching teaching batches:', error);
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
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setStudentAcademicData(null);
    setCurrentStep(0);
    setSelectedRepeatCourse(null);
    setSelectedFreshCourse(null);
    setTeachingBatches({});
    toast.success(`Selected student: ${student.firstName} ${student.lastName}`);
  };

  const handleRepeatCourseSelect = (course) => {
    setSelectedRepeatCourse(course);
    setRepeatData({
      courseCode: course.courseCode,
      originalSemester: course.originalSemester,
      reason: 'Academic'
    });
    setCurrentStep(1);
    toast.info(`Selected course: ${course.courseCode} - ${course.courseName}`);
  };

  const handleFreshCourseSelect = (course) => {
    setSelectedFreshCourse(course);
    setFreshData({
      courseCode: course.courseCode,
      originalSemester: course.originalSemester,
      reason: 'Makeup course'
    });
    setCurrentStep(1);
    
    const teachingBatch = teachingBatches[course.courseCode];
    if (teachingBatch) {
      toast.info(`Selected: ${course.courseCode}. Will enroll with ${teachingBatch.batchName} batch`);
    } else {
      toast.info(`Selected course: ${course.courseCode} - ${course.courseName}`);
    }
  };

  const validateRepeatEnrollment = () => {
    if (!selectedRepeatCourse) {
      toast.error('Please select a course to repeat');
      return false;
    }

    const creditInfo = creditLimits[selectedRepeatCourse.originalSemester];
    if (creditInfo && !creditInfo.canAdd) {
      toast.error(`Credit limit exceeded for semester ${selectedRepeatCourse.originalSemester}`);
      return false;
    }

    return true;
  };

  const validateFreshEnrollment = () => {
    if (!selectedFreshCourse) {
      toast.error('Please select a course to enroll');
      return false;
    }

    const creditInfo = creditLimits[selectedFreshCourse.originalSemester];
    if (creditInfo && !creditInfo.canAdd) {
      toast.error(`Credit limit exceeded for semester ${selectedFreshCourse.originalSemester}`);
      return false;
    }

    const teachingBatch = teachingBatches[selectedFreshCourse.courseCode];
    if (!teachingBatch) {
      toast.error(`No active batch found that is currently teaching ${selectedFreshCourse.courseCode}`);
      return false;
    }

    return true;
  };

  const executeRepeatCourse = async () => {
    if (!validateRepeatEnrollment()) return;

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/students/${selectedStudent._id}/repeat-course`,
        repeatData
      );

      if (response.data.success) {
        const result = response.data.data;
        toast.success(
          `Course repeated successfully! ${result.courseCode} will be taken with ${result.batch}`,
          { autoClose: 6000 }
        );
        setCurrentStep(2);
        await fetchStudentAcademicData();
        await fetchRepeatableCourses();
        await fetchCreditLimits();
      }
    } catch (error) {
      console.error('Error repeating course:', error);
      toast.error(error.response?.data?.message || 'Failed to repeat course');
    } finally {
      setLoading(false);
    }
  };

  const executeFreshCourse = async () => {
    if (!validateFreshEnrollment()) return;

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/students/${selectedStudent._id}/enroll-fresh-course`,
        freshData
      );

      if (response.data.success) {
        const result = response.data.data;
        toast.success(
          `Course enrolled successfully! Student will study ${result.courseCode} with ${result.targetBatch} batch while continuing other courses with ${result.originalBatch} batch`,
          { autoClose: 8000 }
        );
        setCurrentStep(2);
        await fetchStudentAcademicData();
        await fetchAvailableFreshCourses();
        await fetchCreditLimits();
      }
    } catch (error) {
      console.error('Error enrolling fresh course:', error);
      toast.error(error.response?.data?.message || 'Failed to enroll course');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (activeTab === 'repeat') {
      executeRepeatCourse();
    } else {
      executeFreshCourse();
    }
  };

  const handleReset = () => {
    setSelectedRepeatCourse(null);
    setSelectedFreshCourse(null);
    setCurrentStep(0);
    setRepeatData({ courseCode: '', originalSemester: '', reason: 'Academic' });
    setFreshData({ courseCode: '', originalSemester: '', reason: 'Makeup course' });
    toast.info('Operation reset. You can perform another operation.');
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
    setCurrentStep(0);
    setSelectedRepeatCourse(null);
    setSelectedFreshCourse(null);
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

  const repeatCourseColumns = [
    {
      title: 'Course Code',
      dataIndex: 'courseCode',
      key: 'courseCode',
      render: (code) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Course Name',
      dataIndex: 'courseName',
      key: 'courseName',
    },
    {
      title: 'Original Semester',
      dataIndex: 'originalSemester',
      key: 'originalSemester',
      render: (sem) => `Semester ${sem}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'failed' ? 'red' : status === 'dropped' ? 'orange' : 'yellow'}>
          {status?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Grade',
      dataIndex: 'grade',
      key: 'grade',
      render: (grade) => grade || 'N/A',
    },
    {
      title: 'Credits',
      dataIndex: 'credits',
      key: 'credits',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="primary"
          size="small"
          onClick={() => handleRepeatCourseSelect(record)}
          icon={<ReloadOutlined />}
          disabled={!creditLimits[record.originalSemester]?.canAdd}
        >
          Repeat
        </Button>
      ),
    },
  ];

  const freshCourseColumns = [
    {
      title: 'Course Code',
      dataIndex: 'courseCode',
      key: 'courseCode',
      render: (code) => <Tag color="green">{code}</Tag>,
    },
    {
      title: 'Course Name',
      dataIndex: 'courseName',
      key: 'courseName',
    },
    {
      title: 'Semester',
      dataIndex: 'originalSemester',
      key: 'originalSemester',
      render: (sem) => (
        <div>
          <div>Semester {sem}</div>
          <div>
            <small>
              <ClockCircleOutlined /> Past Semester
            </small>
          </div>
        </div>
      ),
    },
    {
      title: 'Credits',
      dataIndex: 'creditHrs',
      key: 'creditHrs',
    },
    {
      title: 'Teaching Batch',
      key: 'teachingBatch',
      render: (_, record) => {
        const teachingBatch = teachingBatches[record.courseCode];
        return teachingBatch ? (
          <Tag color="purple" icon={<TeamOutlined />}>
            {teachingBatch.batchName}
          </Tag>
        ) : (
          <Tag color="default">Finding batch...</Tag>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => {
        const teachingBatch = teachingBatches[record.courseCode];
        const canEnroll = creditLimits[record.originalSemester]?.canAdd && teachingBatch;
        
        return (
          <Button 
            type="primary"
            size="small"
            onClick={() => handleFreshCourseSelect(record)}
            icon={<PlusOutlined />}
            disabled={!canEnroll}
            title={!teachingBatch ? 'No active batch teaching this course' : ''}
          >
            Enroll
          </Button>
        );
      },
    },
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

        {/* Credit Limits Summary */}
        <Alert
          message="Credit Limits for Past Semesters"
          description={
            <div>
              {Object.entries(creditLimits)
                .filter(([semester]) => semester < selectedStudent.currentSemester)
                .map(([semester, info]) => (
                  <div key={semester}>
                    Semester {semester}: {info.current}/{info.limit} credits
                    {info.available > 0 ? ` (${info.available} available)` : ' (Full)'}
                  </div>
                ))
              }
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: 8 }}
        />
      </Card>
    );
  };

  const renderCourseSelection = () => (
    <Card title={`Select Course to ${activeTab === 'repeat' ? 'Repeat' : 'Enroll'}`} style={{ marginBottom: 16 }}>
      {activeTab === 'repeat' ? (
        repeatableCourses.length > 0 ? (
          <Table
            columns={repeatCourseColumns}
            dataSource={repeatableCourses}
            pagination={{ pageSize: 5 }}
            size="middle"
            rowKey="courseCode"
          />
        ) : (
          <Alert
            message="No repeatable courses found"
            description="This student doesn't have any failed, dropped, or low-grade courses that can be repeated."
            type="info"
            showIcon
          />
        )
      ) : (
        availableFreshCourses.length > 0 ? (
          <>
            <Alert
              message="Past Semester Courses Available"
              description="These are courses from previous semesters that the student hasn't studied yet. They will be enrolled with active batches currently teaching these courses."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Table
              columns={freshCourseColumns}
              dataSource={availableFreshCourses}
              pagination={{ pageSize: 5 }}
              size="middle"
              rowKey="courseCode"
            />
          </>
        ) : (
          <Alert
            message="No available fresh courses found"
            description="This student has already enrolled in all past semester courses from their program curriculum."
            type="info"
            showIcon
          />
        )
      )}
    </Card>
  );

  const renderRepeatForm = () => (
    <Card title="Repeat Course Configuration" style={{ marginBottom: 16 }}>
      {selectedRepeatCourse && (
        <>
          <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Course Code">{selectedRepeatCourse.courseCode}</Descriptions.Item>
            <Descriptions.Item label="Course Name">{selectedRepeatCourse.courseName}</Descriptions.Item>
            <Descriptions.Item label="Original Semester">Semester {selectedRepeatCourse.originalSemester}</Descriptions.Item>
            <Descriptions.Item label="Credits">{selectedRepeatCourse.credits}</Descriptions.Item>
            <Descriptions.Item label="Previous Status">
              <Tag color={selectedRepeatCourse.status === 'failed' ? 'red' : 'orange'}>
                {selectedRepeatCourse.status?.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Previous Grade">{selectedRepeatCourse.grade || 'N/A'}</Descriptions.Item>
          </Descriptions>

          <Form layout="vertical">
            <Form.Item label="Reason for Repeating" required>
              <Select
                value={repeatData.reason}
                onChange={(value) => setRepeatData({ ...repeatData, reason: value })}
              >
                <Option value="Academic">Academic (Failed/Low Grade)</Option>
                <Option value="Improvement">Grade Improvement</Option>
                <Option value="Attendance">Attendance Issues</Option>
                <Option value="Other">Other</Option>
              </Select>
            </Form.Item>

            {creditLimits[selectedRepeatCourse.originalSemester] && (
              <Alert
                message={`Credit Limit for Semester ${selectedRepeatCourse.originalSemester}: ${creditLimits[selectedRepeatCourse.originalSemester].current}/${creditLimits[selectedRepeatCourse.originalSemester].limit} (${creditLimits[selectedRepeatCourse.originalSemester].available} available)`}
                type={creditLimits[selectedRepeatCourse.originalSemester].canAdd ? 'success' : 'error'}
                showIcon
              />
            )}
          </Form>
        </>
      )}
    </Card>
  );

  const renderFreshForm = () => (
    <Card title="Fresh Course Enrollment" style={{ marginBottom: 16 }}>
      {selectedFreshCourse && (
        <>
          <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Course Code">{selectedFreshCourse.courseCode}</Descriptions.Item>
            <Descriptions.Item label="Course Name">{selectedFreshCourse.courseName}</Descriptions.Item>
            <Descriptions.Item label="Course Semester">Semester {selectedFreshCourse.originalSemester}</Descriptions.Item>
            <Descriptions.Item label="Credits">{selectedFreshCourse.creditHrs}</Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag>{selectedFreshCourse.type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Teaching Batch">
              {teachingBatches[selectedFreshCourse.courseCode] ? (
                <Tag color="purple" icon={<TeamOutlined />}>
                  {teachingBatches[selectedFreshCourse.courseCode].batchName}
                </Tag>
              ) : (
                <Tag color="default">Finding batch...</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Enrollment Type">
              <Tag color="orange" icon={<InfoCircleOutlined />}>
                Cross-Batch Enrollment
              </Tag>
            </Descriptions.Item>
          </Descriptions>

          <Alert
            message="Cross-Batch Enrollment"
            description={`Student will study this course with the teaching batch while continuing other courses with their original batch (${selectedBatch}).`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form layout="vertical">
            <Form.Item label="Enrollment Reason" required>
              <Select
                value={freshData.reason}
                onChange={(value) => setFreshData({ ...freshData, reason: value })}
              >
                <Option value="Makeup course">Makeup Course (Missed earlier)</Option>
                <Option value="Prerequisite">Prerequisite Requirement</Option>
                <Option value="Schedule conflict">Previous Schedule Conflict</Option>
                <Option value="Other">Other Reason</Option>
              </Select>
            </Form.Item>

            {creditLimits[selectedFreshCourse.originalSemester] && (
              <Alert
                message={`Credit Limit for Semester ${selectedFreshCourse.originalSemester}: ${creditLimits[selectedFreshCourse.originalSemester].current}/${creditLimits[selectedFreshCourse.originalSemester].limit} (${creditLimits[selectedFreshCourse.originalSemester].available} available)`}
                type={creditLimits[selectedFreshCourse.originalSemester].canAdd ? 'success' : 'error'}
                showIcon
              />
            )}
          </Form>
        </>
      )}
    </Card>
  );

  const renderOperationForm = () => {
    if (activeTab === 'repeat') {
      return renderRepeatForm();
    } else {
      return renderFreshForm();
    }
  };

  const renderConfirmation = () => (
    <Card title="Enrollment Successful" style={{ marginBottom: 16 }}>
      <Alert
        message="Enrollment Completed"
        description={
          activeTab === 'repeat' 
            ? `Course ${selectedRepeatCourse?.courseCode} has been scheduled for repetition. The student will be enrolled in an active batch teaching this course.`
            : `Course ${selectedFreshCourse?.courseCode} has been enrolled successfully. The student will study this course with the teaching batch while continuing other courses with their original batch.`
        }
        type="success"
        showIcon
      />
      
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Button type="primary" onClick={handleReset}>
          Perform Another Enrollment
        </Button>
      </div>
    </Card>
  );

  const steps = [
    {
      title: 'Select Course',
      content: renderCourseSelection(),
    },
    {
      title: 'Configure Enrollment',
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
    <div className="course-enrollment container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="course-enrollment-title">
            <BookOutlined /> Course Enrollment Management
          </h2>
          <Text type="secondary">Repeat failed courses or enroll in missed past semester courses</Text>
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

      {/* Course Enrollment Tabs and Steps */}
      {selectedStudent && (
        <Card title="Course Enrollment" style={{ marginBottom: 24 }}>
          <Tabs activeKey={activeTab} onChange={handleTabChange}>
            <TabPane 
              tab={
                <span>
                  <ReloadOutlined />
                  Repeat Courses
                </span>
              } 
              key="repeat"
            >
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
                    onClick={() => setCurrentStep(0)}
                  >
                    Back
                  </Button>
                  <Button 
                    type="primary" 
                    onClick={handleNext}
                    loading={loading}
                    icon={<SaveOutlined />}
                    className="btn btn-primary"
                  >
                    Confirm Repeat
                  </Button>
                </div>
              )}
            </TabPane>

            <TabPane 
              tab={
                <span>
                  <PlusOutlined />
                  Fresh Enrollment
                </span>
              } 
              key="fresh"
            >
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
                    onClick={() => setCurrentStep(0)}
                  >
                    Back
                  </Button>
                  <Button 
                    type="primary" 
                    onClick={handleNext}
                    loading={loading}
                    icon={<SaveOutlined />}
                    className="btn btn-primary"
                  >
                    Confirm Enrollment
                  </Button>
                </div>
              )}
            </TabPane>
          </Tabs>
        </Card>
      )}

      <ToastContainer position="top-right" autoClose={5000} />
    </div>
  );
};

export default CourseEnrollment;