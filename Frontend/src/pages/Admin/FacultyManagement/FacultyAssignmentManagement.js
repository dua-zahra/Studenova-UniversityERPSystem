import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../../../config';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faTrash, faSync, faSearch, faCheckCircle, faClock, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { 
  Select, Table, Button, Modal, message, Card, Row, Col, 
  Tag, Tabs, Divider, Spin, Space, Typography, Tooltip, Empty, Input
} from 'antd';
import { 
  PlusOutlined, SyncOutlined, ExclamationCircleOutlined,
  InfoCircleOutlined, DeleteOutlined, CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import moment from 'moment';
const { Option } = Select;
const { TabPane } = Tabs;
const { confirm } = Modal;
const { Text, Title } = Typography;
const { Search } = Input;
import "../../../assets/style.css";

const FacultyManagement = () => {
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedDegree, setSelectedDegree] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchDetails, setBatchDetails] = useState(null);
  const [allSemesterCourses, setAllSemesterCourses] = useState({});
  const [facultyList, setFacultyList] = useState([]);
  const [allFaculty, setAllFaculty] = useState([]);
  const [isAssignmentModalVisible, setIsAssignmentModalVisible] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [canAdvanceSemester, setCanAdvanceSemester] = useState(false);
  const [activeTab, setActiveTab] = useState('1');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState({
    degree: false,
    department: false,
    batch: false,
    details: false,
    courses: false,
    faculty: false,
    allFaculty: false
  });

  const filteredFacultyList = facultyList.filter(faculty => {
    const searchLower = searchTerm.toLowerCase();
    return (
      faculty.firstName?.toLowerCase().includes(searchLower) ||
      faculty.lastName?.toLowerCase().includes(searchLower) ||
      faculty.employeeId?.toLowerCase().includes(searchLower) ||
      faculty.designation?.toLowerCase().includes(searchLower) ||
      `${faculty.firstName} ${faculty.lastName}`.toLowerCase().includes(searchLower)
    );
  });

  useEffect(() => {
    const fetchAllFacultyData = async () => {
      try {
        setLoading(prev => ({ ...prev, allFaculty: true }));
        
        let facultyData = [];
        try {
          const response = await axios.get(`${API_URL}/api/faculty`);
          
          if (response.data.data && Array.isArray(response.data.data)) {
            facultyData = response.data.data;
          } else if (Array.isArray(response.data)) {
            facultyData = response.data;
          } else if (response.data.faculty && Array.isArray(response.data.faculty)) {
            facultyData = response.data.faculty;
          }
        } catch (error) {
          console.log('General faculty endpoint failed, trying teacher assignment endpoint');
          
          const fallbackResponse = await axios.get(`${API_URL}/api/teacher-assignment/faculty`);
          
          if (fallbackResponse.data.data && Array.isArray(fallbackResponse.data.data)) {
            facultyData = fallbackResponse.data.data;
          } else if (Array.isArray(fallbackResponse.data)) {
            facultyData = fallbackResponse.data;
          }
        }

        const processedFaculty = facultyData.map(faculty => {
          const assignedCourses = faculty.assignedCourses || [];
          
          const activeAssignments = assignedCourses.filter(course => 
            course.isActive && course.teachingStatus === 'in-progress'
          );
          
          const completedAssignments = assignedCourses.filter(course => 
            course.teachingStatus === 'completed'
          );

          const removedAssignments = assignedCourses.filter(course => 
            course.teachingStatus === 'removed'
          );

          const calculatedWorkload = activeAssignments.reduce((total, course) => {
            return total + (course.creditHrs || 0);
          }, 0);

          return {
            _id: faculty._id,
            firstName: faculty.firstName || '',
            lastName: faculty.lastName || '',
            employeeId: faculty.employeeId || '',
            designation: faculty.designation || '',
            department: faculty.department || '',
            isActive: faculty.isActive !== false,
            currentWorkload: faculty.currentWorkload || calculatedWorkload,
            assignedCourses: assignedCourses,
            activeAssignments: activeAssignments,
            completedAssignments: completedAssignments,
            removedAssignments: removedAssignments, 
            name: `${faculty.firstName || ''} ${faculty.lastName || ''}`.trim()
          };
        }).filter(faculty => faculty.name);

        setAllFaculty(processedFaculty);
        
      } catch (error) {
        console.error('Error fetching all faculty data:', error);
        message.error('Failed to fetch faculty data');
        setAllFaculty([]);
      } finally {
        setLoading(prev => ({ ...prev, allFaculty: false }));
      }
    };

    fetchAllFacultyData();
  }, []);

  useEffect(() => {
    const fetchDegreeLevels = async () => {
      try {
        setLoading(prev => ({ ...prev, degree: true }));
        const response = await axios.get(`${API_URL}/api/degree-levels`);
        setDegreeLevels(response.data);
      } catch (error) {
        message.error('Failed to load degree levels');
      } finally {
        setLoading(prev => ({ ...prev, degree: false }));
      }
    };
    fetchDegreeLevels();
  }, []);

  useEffect(() => {
    if (!selectedDegree) {
      setDepartments([]);
      setSelectedDepartment(null);
      return;
    }

    const fetchDepartments = async () => {
      try {
        setLoading(prev => ({ ...prev, department: true }));
        const response = await axios.get(`${API_URL}/api/departments/by-degree`, {
          params: { degreeLevel: selectedDegree }
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
        message.error('Failed to load departments');
      } finally {
        setLoading(prev => ({ ...prev, department: false }));
      }
    };
    fetchDepartments();
  }, [selectedDegree]);

  useEffect(() => {
    if (!selectedDepartment) {
      setBatches([]);
      setSelectedBatch(null);
      return;
    }

    const fetchBatches = async () => {
      try {
        setLoading(prev => ({ ...prev, batch: true }));
        const response = await axios.get(`${API_URL}/api/teacher-assignment/batches/active`, {
          params: { 
            degreeLevel: selectedDegree,
            department: selectedDepartment 
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
      } finally {
        setLoading(prev => ({ ...prev, batch: false }));
      }
    };
    fetchBatches();
  }, [selectedDepartment, selectedDegree]);

  useEffect(() => {
    if (!selectedBatch) {
      setBatchDetails(null);
      setAllSemesterCourses({});
      return;
    }

    const fetchBatchData = async () => {
      try {
        setLoading(prev => ({ ...prev, details: true, courses: true }));
        
        const [detailsResponse, advancementResponse] = await Promise.all([
          axios.get(`${API_URL}/api/teacher-assignment/batches/${selectedBatch}`),
          axios.get(`${API_URL}/api/teacher-assignment/batches/${selectedBatch}/check-advancement`)
        ]);

        const batchData = detailsResponse.data;
        
        const actualBatchData = batchData.data || batchData;
        
        setCanAdvanceSemester(advancementResponse.data?.canAdvance || false);
        
        const academicCalendar = actualBatchData.academicCalendar || [];
        const currentSemester = actualBatchData.currentSemester || 1;
        
        const currentSemesterData = academicCalendar.find(
          sem => sem.semester === currentSemester
        );
        const nextSemesterData = academicCalendar.find(
          sem => sem.semester === currentSemester + 1
        );
        
        setBatchDetails({
          ...actualBatchData,
          batchName: actualBatchData.batchName || 'Unknown Batch',
          currentSemester: currentSemester,
          currentSemesterStart: currentSemesterData?.startDate,
          currentSemesterEnd: currentSemesterData?.endDate,
          currentSemesterName: currentSemesterData?.name || `Semester ${currentSemester}`,
          nextSemesterStart: nextSemesterData?.startDate,
          sectionNames: actualBatchData.sections?.map(s => s.name) || [],
          totalSections: actualBatchData.sections?.length || 0,
          totalSemesters: actualBatchData.totalSemesters || 8
        });
        
        await fetchAllSemestersCourses(actualBatchData.totalSemesters || 8);
      } catch (error) {
        console.error('Error fetching batch details:', error);
        message.error('Failed to fetch batch details');
      } finally {
        setLoading(prev => ({ ...prev, details: false, courses: false }));
      }
    };
    fetchBatchData();
  }, [selectedBatch]);

  const fetchAllSemestersCourses = async (totalSemesters) => {
    const semestersData = {};
    
    if (!selectedBatch || !totalSemesters) {
      setAllSemesterCourses({});
      return;
    }

    for (let sem = 1; sem <= totalSemesters; sem++) {
      try {
        const response = await axios.get(
          `${API_URL}/api/teacher-assignment/batches/${selectedBatch}/semesters/${sem}/courses`
        );
        
        const coursesData = response.data.data || response.data || [];
        
        semestersData[sem] = coursesData.map(course => ({
          ...course,
          sections: course.sections || [],
          currentSemester: batchDetails?.currentSemester || 1
        }));
      } catch (error) {
        console.error(`Failed to fetch courses for semester ${sem}`, error);
        
        if (error.response?.data?.message === "Courses not defined for this semester") {
          semestersData[sem] = [];
        } else {
          message.error(`Failed to load courses for semester ${sem}`);
          semestersData[sem] = [];
        }
      }
    }
    
    setAllSemesterCourses(semestersData);
  };

  const refreshBatchData = async () => {
    try {
      if (!selectedBatch) return;

      setLoading(prev => ({ ...prev, details: true, courses: true, faculty: true }));
      
      const [detailsResponse, advancementResponse] = await Promise.all([
        axios.get(`${API_URL}/api/teacher-assignment/batches/${selectedBatch}`),
        axios.get(`${API_URL}/api/teacher-assignment/batches/${selectedBatch}/check-advancement`)
      ]);

      const batchData = detailsResponse.data;
      
      const actualBatchData = batchData.data || batchData;
      
      setCanAdvanceSemester(advancementResponse.data?.canAdvance || false);
      
      const academicCalendar = actualBatchData.academicCalendar || [];
      const currentSemester = actualBatchData.currentSemester || 1;
      
      const currentSemesterData = academicCalendar.find(
        sem => sem.semester === currentSemester
      );
      const nextSemesterData = academicCalendar.find(
        sem => sem.semester === currentSemester + 1
      );
      
      setBatchDetails(prev => ({
        ...prev,
        ...actualBatchData,
        currentSemesterStart: currentSemesterData?.startDate,
        currentSemesterEnd: currentSemesterData?.endDate,
        currentSemesterName: currentSemesterData?.name || `Semester ${currentSemester}`,
        nextSemesterStart: nextSemesterData?.startDate,
        sectionNames: actualBatchData.sections?.map(s => s.name) || [],
        totalSections: actualBatchData.sections?.length || 0
      }));
      
      await fetchAllSemestersCourses(actualBatchData.totalSemesters || 8);
      
    } catch (error) {
      console.error('Error refreshing batch data:', error);
      message.error('Failed to refresh data after assignment');
    } finally {
      setLoading(prev => ({ ...prev, details: false, courses: false, faculty: false }));
    }
  };

  const STRICT_isAssignmentValid = (sectionData, semester) => {
    if (!sectionData?.facultyId) return false;
    
    const isPastSemester = semester < batchDetails?.currentSemester;
    if (isPastSemester && sectionData.teachingStatus === 'completed') {
      return true; 
    }
    
    const isExplicitlyRemoved = 
      sectionData.teachingStatus === 'removed' || 
      sectionData.status === 'inactive' ||
      (sectionData.facultyName && sectionData.facultyName.includes('[INACTIVE]'));
    
    if (isExplicitlyRemoved) return false;
    
    const assignedFaculty = allFaculty.find(f => f._id === sectionData.facultyId);
    if (!assignedFaculty || !assignedFaculty.isActive) return false;
    
    const facultyHasActiveAssignment = assignedFaculty.assignedCourses?.some(course =>
      course.batchId === selectedBatch &&
      course.semester === batchDetails?.currentSemester &&
      course.courseCode === sectionData.courseCode &&
      course.sectionName === sectionData.sectionName &&
      course.isActive &&
      course.teachingStatus === 'in-progress'
    );
    
    return facultyHasActiveAssignment;
  };

  const handleAssignmentClick = async (course, sectionName, currentFacultyId) => {
    try {
      setCurrentAssignment({ 
        ...course, 
        sectionName, 
        currentFacultyId 
      });
      setIsAssignmentModalVisible(true);
      setSearchTerm(''); 
      
      setLoading(prev => ({ ...prev, faculty: true }));
      
      const facultyData = allFaculty.map(faculty => ({
        ...faculty,
        name: `${faculty.firstName} ${faculty.lastName}`,
        currentWorkload: faculty.currentWorkload || 0,
        assignedCourses: faculty.assignedCourses || [],
        activeAssignments: faculty.activeAssignments || [],
        completedAssignments: faculty.completedAssignments || [],
        removedAssignments: faculty.removedAssignments || []
      }));
      
      setFacultyList(facultyData);
    } catch (error) {
      message.error('Failed to load faculty data');
    } finally {
      setLoading(prev => ({ ...prev, faculty: false }));
    }
  };

  const handleFacultySelect = async (facultyId) => {
    try {
      if (!selectedBatch || !currentAssignment || !batchDetails?.currentSemester) {
        throw new Error('Missing required assignment data');
      }

      const url = `${API_URL}/api/teacher-assignment/batches/${selectedBatch}/semesters/${batchDetails.currentSemester}/courses/${currentAssignment.courseCode}/sections/${encodeURIComponent(currentAssignment.sectionName)}`;

      const response = await axios.put(
        url,
        { 
          facultyId,
          allowFutureSemester: true 
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success === false) {
        throw new Error(response.data.message || 'Assignment failed');
      }

      message.success('Teacher assigned successfully');
      setIsAssignmentModalVisible(false);
      
      await refreshBatchData();
    } catch (error) {
      console.error('Full assignment error:', error);
      
      let errorMessage = 'Failed to assign teacher';
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = 'Server endpoint not found. Please check the API URL.';
        } else {
          errorMessage = error.response.data?.message || error.message;
        }
      } else if (error.request) {
        errorMessage = 'No response from server. Is the backend running?';
      } else {
        errorMessage = error.message;
      }
      
      message.error(errorMessage);
    }
  };

  const handleRemoveAssignment = async (courseCode, sectionName) => {
    confirm({
      title: 'Remove Assignment?',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to remove this teacher assignment?',
      onOk: async () => {
        try {
          if (!selectedBatch || !batchDetails?.currentSemester) {
            throw new Error('Missing required data');
          }

          const response = await axios.delete(
            `${API_URL}/api/teacher-assignment/batches/${selectedBatch}/semesters/${batchDetails.currentSemester}/courses/${courseCode}/sections/${encodeURIComponent(sectionName)}`
          );

          if (response.data.success) {
            message.success('Assignment removed successfully');
            await refreshBatchData();
          } else {
            throw new Error(response.data.message || 'Failed to remove assignment');
          }
        } catch (error) {
          console.error('Error removing assignment:', error);
          message.error(error.message || 'Failed to remove assignment');
        }
      }
    });
  };

  const advanceSemester = async () => {
    confirm({
      title: 'Advance Semester?',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to advance this batch to the next semester? This action cannot be undone.',
      onOk: async () => {
        try {
          await axios.post(`${API_URL}/api/teacher-assignment/batches/${selectedBatch}/advance-semester`);
          message.success('Semester advanced successfully');
          await refreshBatchData();
        } catch (error) {
          message.error('Failed to advance semester');
        }
      }
    });
  };

  const generateColumns = (semester) => {
    const baseColumns = [
      {
        title: 'Course Information',
        dataIndex: 'courseName',
        key: 'courseName',
        fixed: 'left',
        width: 250,
        render: (text, record) => (
          <div>
            <div style={{ display: 'flex', fontSize: '15px', alignItems: 'center' }}>
              <strong>{record.courseName}</strong>
              <Tooltip title={`Course Type: ${record.type || 'Core'}`}>
                <InfoCircleOutlined style={{ marginLeft: 8, color: '#1890ff' }} />
              </Tooltip>
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              <div>Code: {record.courseCode}</div>
              <div>Credits: {record.creditHrs}</div>
              <div><strong>Current Semester: {batchDetails?.currentSemester || 'N/A'}</strong></div>
            </div>
          </div>
        )
      }
    ];

    if (!batchDetails?.sectionNames || batchDetails.sectionNames.length === 0) {
      return [
        ...baseColumns,
        {
          title: 'No Sections',
          dataIndex: 'noSections',
          key: 'noSections',
          render: () => (
            <Tag className='no-section'>No sections available for this batch</Tag>
          )
        }
      ];
    }

    const sectionColumns = batchDetails.sectionNames.map(sectionName => ({
      title: `${sectionName}`,
      dataIndex: 'sections',
      key: sectionName,
      align: 'center',
      width: 200,
      render: (sections, record) => {
        const sectionData = sections?.find(s => s.sectionName === sectionName);
        const isCurrentSemester = semester === batchDetails.currentSemester;
        const isPastSemester = semester < batchDetails.currentSemester;
        const isFutureSemester = semester > batchDetails.currentSemester;
        
        const isAssignmentValid = STRICT_isAssignmentValid({...sectionData, courseCode: record.courseCode, sectionName}, semester);
        
        if (isPastSemester) {
          return sectionData?.facultyName ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              <Tag color={isAssignmentValid ? "blue" : "red"}>
                {sectionData.facultyName}
                {!isAssignmentValid && " (Removed)"}
              </Tag>
              <Tag color={sectionData?.teachingStatus === 'completed' ? 'green' : 'orange'}>
                {sectionData?.teachingStatus === 'completed' ? 'Completed' : 'Past Semester'}
              </Tag>
            </div>
          ) : (
            <Tag color="red">Not Assigned</Tag>
          );
        }
        
        if (isFutureSemester) {
          return (
            <Button disabled>
              Assign Teacher
            </Button>
          );
        }
        
        if (sectionData?.facultyId) {
          if (!isAssignmentValid) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                <Tag color="red" style={{ textDecoration: 'line-through' }}>
                  Assignment Removed
                </Tag>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => handleAssignmentClick(record, sectionName)}
                  className="reassign-button"
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                >
                  Reassign
                </Button>
              </div>
            );
          }
          
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Tag className="assigned-tag">
                  {sectionData.facultyName}
                </Tag>
              </div>
              <div className="action-buttons">
                <Button 
                  type="link" 
                  size="small"
                  icon={<FontAwesomeIcon icon={faPen} />}
                  onClick={() => handleAssignmentClick(record, sectionName, sectionData.facultyId)}
                  disabled={sectionData?.teachingStatus === 'completed'}
                >
                </Button>
                <Button 
                  type="link" 
                  size="small"
                  danger
                  icon={<FontAwesomeIcon icon={faTrash} />}
                  onClick={() => handleRemoveAssignment(record.courseCode, sectionName)}
                  disabled={sectionData?.teachingStatus === 'completed'}
                >
                </Button>
              </div>
            </div>
          );
        }
        
        return (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => handleAssignmentClick(record, sectionName)}
            className="assign-button"
            style={{ padding: '15px 12px', fontSize: '12px', width: '50%' }}
          >
            Assign
          </Button>
        );
      }
    }));
    
    return [...baseColumns, ...sectionColumns];
  };

  const renderAssignmentModal = () => (
    <Modal
      title={
        <div>
          <Title level={4} style={{ marginBottom: 10 }}>Assign Teacher to Section</Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Text strong>{currentAssignment?.courseCode}: {currentAssignment?.courseName}</Text>
            <div style={{ display: 'flex', gap: 16 }}>
              <Text>Credits: {currentAssignment?.creditHrs}</Text>
              <Text>Type: {currentAssignment?.type || 'Core'}</Text>
            </div>
            <Text strong>Section: {currentAssignment?.sectionName}</Text>
            <Text>Current Semester: {batchDetails?.currentSemester}</Text>
          </div>
        </div>
      }
      visible={isAssignmentModalVisible}
      onCancel={() => setIsAssignmentModalVisible(false)}
      footer={null}
      width={900}
    >
      {loading.faculty ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="large" />
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Input
              placeholder="Search for faculty member"
              prefix={<FontAwesomeIcon icon={faSearch} style={{ color: '#d9d9d9' }} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              style={{ width: '70%' }}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <Text type="secondary">
              Showing {filteredFacultyList.length} of {facultyList.length} faculty members
            </Text>
          </div>

          <Table
            columns={[
              {
                title: 'Faculty Information',
                dataIndex: 'name',
                key: 'name',
                width: 250,
                render: (_, record) => (
                  <div>
                    <div style={{ fontWeight: 'bold' }}>
                      {record.firstName} {record.lastName}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#666' }}>
                      {record.designation}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#666' }}>
                      ID: {record.employeeId}
                    </div>
                    <div style={{ fontSize: '0.8em', color: record.isActive ? '#52c41a' : '#ff4d4f' }}>
                      Status: {record.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                )
              },
              {
                title: 'Workload Status',
                dataIndex: 'currentWorkload',
                key: 'currentWorkload',
                width: 150,
                render: (workload, record) => {
                  const newWorkload = workload + (currentAssignment?.creditHrs || 0);
                  const isOverloaded = newWorkload > 24;
                  const isInactive = !record.isActive;
                  
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div>
                        <Text strong>Current:</Text> {workload} Cr.
                      </div>
                      <div>
                        <Text strong>After Assign: </Text> 
                        <span style={{ 
                          color: isInactive ? '#ff4d4f' : isOverloaded ? '#ff4d4f' : '#52c41a' 
                        }}>
                          {newWorkload}/24 Cr.
                        </span>
                      </div>
                      {isInactive && (
                        <Text type="danger" style={{ fontSize: '0.8em' }}>
                          Faculty is inactive!
                        </Text>
                      )}
                      {isOverloaded && !isInactive && (
                        <Text type="danger" style={{ fontSize: '0.8em' }}>
                          Would exceed maximum workload!
                        </Text>
                      )}
                    </div>
                  );
                }
              },
              {
                title: 'Current Assignments',
                dataIndex: 'assignedCourses',
                key: 'assignedCourses',
                render: (courses) => (
                  <div>
                    {!courses || courses.length === 0 ? (
                      <div className="current-assignments-empty">No current assignments</div>
                    ) : (
                      <div className="current-assignments-wrapper">
                        {courses.slice(0, 3).map(course => (
                          <Tooltip
                            key={`${course.courseCode}-${course.sectionName}`}
                            title={`${course.courseName} (${course.creditHrs} Cr.) - ${course.teachingStatus === 'completed' ? 'Completed' : course.teachingStatus === 'removed' ? 'Removed' : 'In Progress'}`}
                          >
                            <span className="assignment-tag">
                              {course.courseCode} ({course.sectionName})
                              {course.teachingStatus === 'completed' && ' ✓'}
                              {course.teachingStatus === 'removed' && ' ✗'}
                            </span>
                          </Tooltip>
                        ))}
                        {courses.length > 3 && (
                          <Tooltip
                            title={
                              <div>
                                {courses.slice(3).map(course => (
                                  <div key={`${course.courseCode}-${course.sectionName}`}>
                                    {course.courseCode} ({course.sectionName}) - {course.courseName}
                                    <Tag 
                                      color={course.teachingStatus === 'completed' ? 'green' : 
                                             course.teachingStatus === 'removed' ? 'red' : 'blue'} 
                                      style={{ marginLeft: 4 }}
                                    >
                                      {course.teachingStatus === 'completed' ? 'Completed' : 
                                       course.teachingStatus === 'removed' ? 'Removed' : 'In Progress'}
                                    </Tag>
                                  </div>
                                ))}
                              </div>
                            }
                          >
                            <span className="assignment-tag-more">
                              +{courses.length - 3} more
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </div>
                )
              },
              {
                title: 'Action',
                key: 'action',
                width: 100,
                render: (_, record) => {
                  const wouldOverload = (record.currentWorkload + currentAssignment?.creditHrs) > 24;
                  const isInactive = !record.isActive;
                  
                  return (
                    <Button 
                      type="primary" 
                      onClick={() => handleFacultySelect(record._id)}
                      disabled={wouldOverload || isInactive}
                      className='assignteach-btn'
                    >
                      {isInactive ? 'Inactive' : wouldOverload ? 'Overloaded' : 'Assign'}
                    </Button>
                  );
                }
              }
            ]}
            dataSource={filteredFacultyList}
            rowKey="_id"
            pagination={{
              pageSize: 5,
              showSizeChanger: false,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} faculty members`
            }}
            scroll={{ y: 400 }}
            locale={{
              emptyText: (
                <Empty
                  description={
                    searchTerm ? 
                    `No faculty found matching "${searchTerm}"` : 
                    "No faculty available for assignment"
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            }}
          />
        </div>
      )}
    </Modal>
  );

  const generateEmptySemesterStructure = () => {
    const emptySemesters = {};
    const totalSemesters = 8; 
    
    for (let sem = 1; sem <= totalSemesters; sem++) {
      emptySemesters[sem] = [];
    }
    
    return emptySemesters;
  };

  return (
    <div className="Faculty-Management container mt-5">
      <h2 className="Faculty-Management-title">Faculty Course Assignments</h2>
     
      <div className="form-row responsive-form">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Degree Level</label>
          <select
            className="form-control"
            value={selectedDegree}
            onChange={(e) => setSelectedDegree(e.target.value)}
            disabled={loading.degree}
          >
            <option value="">Select Degree Level</option>
            {degreeLevels.map(level => (
              <option key={level._id || level} value={level.name || level}>
                {level.name || level}
              </option>
            ))}
          </select>
        </div>
  
        <div className="form-group" style={{ flex: 1 }}>
          <label>Department</label>
          <select
            className="form-control"
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            disabled={!selectedDegree || loading.department}
          >
            <option value="">{loading.department ? 'Loading departments...' : 'Select Department'}</option>
            {departments.map(dept => (
              <option key={dept._id} value={dept.departmentName || dept.name}>
                {dept.departmentName || dept.name} {dept.departmentCode ? `(${dept.departmentCode})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ flex: 1 }}>
          <label>Batch</label>
          <select
            className="form-control"
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            disabled={!selectedDepartment || loading.batch}
          >
            <option value="">{loading.batch ? 'Loading batches...' : 'Select Batch'}</option>
            {Array.isArray(batches) && batches.map(batch => (
              <option key={batch._id} value={batch._id}>
                {batch.batchName} 
              </option>
            ))}
          </select>
          {!loading.batch && batches.length === 0 && selectedDepartment && (
            <div style={{ fontSize: '12px', color: '#ff4d4f', marginTop: '5px' }}>
              No active batches found for this department
            </div>
          )}
        </div>
      </div>

      {loading.details && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="large" />
          <div>Loading batch details...</div>
        </div>
      )}

     
      <div className="batch-details-container">
        {batchDetails ? (
          <>
            <div className="batch-info">
              <h2 className="batch-info-title">{batchDetails.batchName}</h2>
            </div>
            
            <div className="batch-details-content">
              <div className="row mb-3">
                <div className="col-md-4 col-6 detail-item">
                  <span className="detail-label">Degree Level:</span> {selectedDegree}
                </div>
                <div className="col-md-4 col-6 detail-item">
                  <span className="detail-label">Department:</span> {selectedDepartment}
                </div>
                <div className="col-md-4 col-6 detail-item">
                  <span className="detail-label">Current Semester:</span> {batchDetails?.currentSemester}
                </div>
              </div>
              
              <div className="row mb-3">
                <div className="col-md-4 col-6 detail-item">
                  <span className="detail-label">Total Sections:</span> {batchDetails.totalSections}
                </div>
                <div className="col-md-4 col-6 detail-item">
                  <span className="detail-label">Current Dates:</span> 
                  {batchDetails.currentSemesterStart ? (
                    <span className="date-range">
                      {moment(batchDetails.currentSemesterStart).format('MMMM D, YYYY')} 
                      {' to '}
                      {moment(batchDetails.currentSemesterEnd).format('MMMM D, YYYY')}
                    </span>
                  ) : 'N/A'}
                </div>
                <div className="col-md-4 col-6 detail-item">
                  {batchDetails.nextSemesterStart && (
                    <div>
                      <span className="detail-label">Next Semester:</span> 
                      <span className="date-range">
                        {moment(batchDetails.nextSemesterStart).format('MMMM D, YYYY')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <hr className="divider" />
              
              {batchDetails.sectionNames && batchDetails.sectionNames.length > 0 ? (
                <div className="section-names">
                  <span className="detail-label">Section Names:</span> 
                  {batchDetails.sectionNames.map(sectionName => (
                    <span key={sectionName} className="section-tag">
                      {sectionName}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="no-section-txt" style={{ color: "#957bab" }}>No sections defined for this batch</div>
              )}
            </div>
          </>
        ) : (
          <div className="batch-details-content">
            <div className="batch-info">
              <h2 className="batch-info-title">No Batch Selected</h2>
            </div>
           
          </div>
        )}
      </div>

      <hr className="divider" />

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        type="card"
        className="custom-tabs"
        tabBarStyle={{ marginBottom: 0 }}
      >
        {Array.from({ length: batchDetails?.totalSemesters || 8 }, (_, i) => i + 1).map(semester => (
          <TabPane 
            tab={`Semester ${semester}`} 
            key={semester.toString()}
            disabled={loading.courses && !batchDetails}
          >
            {loading.courses ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
                <div>Loading courses for semester {semester}...</div>
              </div>
            ) : (
              <Table
                columns={generateColumns(semester)}
                dataSource={batchDetails ? (allSemesterCourses[semester] || []) : []}
                bordered
                scroll={{ x: true }}
                pagination={false}
                loading={false}
                title={() => (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text>Semester {semester} Course Assignments</Text>
                    {batchDetails && semester === batchDetails.currentSemester && (
                      <span className="current-semester-label">
                        <FontAwesomeIcon icon={faSync} spin style={{ marginRight: 6 }} />
                        Currently Active Semester
                      </span>
                    )}
                  </div>
                )}
                rowKey="courseCode"
                locale={{
                  emptyText: (
                    <Empty
                      description={batchDetails ? "No courses found for this semester" : "Please select a batch to view courses"}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  )
                }}
              />
            )}
          </TabPane>
        ))}
      </Tabs>

      <div className="faculty-work">
        <h2 className="faculty-work-title">Faculty Workload Overview</h2>
        <div className="scrollable-table">
          <Table
            className="faculty-workload-table"
            columns={[
              {
                title: 'Faculty Member',
                dataIndex: 'name',
                key: 'name',
                width: 500,
                render: (_, record) => (
                  <div className="faculty-member-cell">
                    <div className="faculty-member-name">
                      {record.firstName} {record.lastName}
                      {!record.isActive && (
                        <Tag color="red" style={{ marginLeft: 8, fontSize: '10px' }}>
                          Inactive
                        </Tag>
                      )}
                    </div>
                    <div className="faculty-member-details">
                      {record.designation} • {record.employeeId}
                      {record.department && ` • ${record.department}`}
                    </div>
                  </div>
                )
              },
              {
                title: 'Workload',
                dataIndex: 'currentWorkload',
                key: 'currentWorkload',
                width: 200,
                render: (workload, record) => (
                  <Tag 
                    className={`workload-tag ${
                      !record.isActive ? 'workload-tag-inactive' :
                      workload >= 20 ? 'workload-tag-red' : 
                      workload >= 15 ? 'workload-tag-orange' : 'workload-tag-green'
                    }`}
                  >
                    {workload}/24 Credit hours
                    {!record.isActive && ' (Inactive)'}
                  </Tag>
                )
              },
              {
                title: 'Teaching Status',
                key: 'teachingStatus',
                width: 150,
                render: (_, record) => {
                  const activeCount = record.activeAssignments?.length || 0;
                  const completedCount = record.completedAssignments?.length || 0;
                  const removedCount = record.removedAssignments?.length || 0; 
                  
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FontAwesomeIcon icon={faClock} style={{ color: record.isActive ? '#957bab' : '#ccc' }} />
                        <Text style={{ color: record.isActive ? 'inherit' : '#ccc' }}>
                          Courses Active: {activeCount}
                        </Text>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FontAwesomeIcon icon={faCheckCircle} style={{ color: record.isActive ? '#52c41a' : '#ccc' }} />
                        <Text style={{ color: record.isActive ? 'inherit' : '#ccc' }}>
                          Courses Completed: {completedCount}
                        </Text>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FontAwesomeIcon icon={faTimesCircle} style={{ color: record.isActive ? '#ff4d4f' : '#ccc' }} />
                        <Text style={{ color: record.isActive ? '#ff4d4f' : '#ccc' }}>
                          Courses Removed: {removedCount}
                        </Text>
                      </div>
                    </div>
                  );
                }
              },
              {
                title: 'Current Assignments',
                dataIndex: 'assignedCourses',
                key: 'assignedCourses',
                render: (courses, record) => (
                  <div className="assignments-container">
                    {!courses || courses.length === 0 ? (
                      <div className="no-assignments-text">
                        {record.isActive ? 'No current assignments' : 'No assignments (Inactive)'}
                      </div>
                    ) : (
                      courses.map(course => (
                        <Tooltip
                          key={`${course.courseCode}-${course.sectionName}`}
                          title={
                            <div className="tooltip-content">
                              <div className="tooltip-course-name">{course.courseName}</div>
                              <div className="tooltip-detail">Semester: {course.semester}</div>
                              <div className="tooltip-detail">Section: {course.sectionName}</div>
                              <div className="tooltip-detail">Credits: {course.creditHrs}</div>
                              <div className="tooltip-detail">
                                Status: 
                                <Tag 
                                  color={course.teachingStatus === 'completed' ? 'green' : 
                                         course.teachingStatus === 'removed' ? 'red' :
                                         !record.isActive ? 'red' : '#957bab'} 
                                  style={{ marginLeft: 4 }}
                                >
                                  {course.teachingStatus === 'removed' ? 'Removed' :
                                   !record.isActive ? 'Inactive Faculty' : 
                                   course.teachingStatus === 'completed' ? 'Completed' : 'In Progress'}
                                </Tag>
                              </div>
                            </div>
                          }
                        >
                          <Tag 
                            className="course-tag"
                            color={course.teachingStatus === 'completed' ? 'green' : 
                                   course.teachingStatus === 'removed' ? 'red' :
                                   !record.isActive ? 'red' : '#957bab'}
                          >
                            {course.courseCode} ({course.sectionName}) 
                            {course.teachingStatus === 'completed' ? ' ✓' : 
                             course.teachingStatus === 'removed' ? ' ✗' :
                             !record.isActive ? ' ✗' : ' ⟳'}
                          </Tag>
                        </Tooltip>
                      ))
                    )}
                  </div>
                )
              }
            ]}
            dataSource={allFaculty}
            rowKey="_id"
            loading={{
              spinning: loading.allFaculty,
              indicator: <div className="loading-spinner"><Spin /></div>
            }}
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  description="No faculty data available"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            }}
          />
        </div>
      </div>

      {renderAssignmentModal()}
      
    </div>
  );
};

export default FacultyManagement;