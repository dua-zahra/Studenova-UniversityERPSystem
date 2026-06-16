import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import "../../../assets/style.css";
import { 
  Card, Table, Button, Spin, Tabs, Tag, Typography, Empty, Space, Alert 
} from 'antd';
import { 
  SaveOutlined, SyncOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, UndoOutlined, InfoCircleOutlined 
} from '@ant-design/icons';

const { TabPane } = Tabs;
const { Text, Title } = Typography;

const CourseFee = () => {
  const [degreeLevel, setDegreeLevel] = useState('');
  const [department, setDepartment] = useState('');
  const [activeSemester, setActiveSemester] = useState('1');
  const [courseFees, setCourseFees] = useState({});
  const [assignedFees, setAssignedFees] = useState({});
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [maxSemesters, setMaxSemesters] = useState(8);
  const [saveStatus, setSaveStatus] = useState({});

  useEffect(() => {
    fetchDegreeLevels();
    fetchDegreeConfig();
  }, []);

  useEffect(() => {
    if (degreeLevel) {
      fetchDepartments();
      setMaxSemesters(getMaxSemesters(degreeLevel));
    }
  }, [degreeLevel]);

  useEffect(() => {
    if (degreeLevel && department) {
      fetchCoursesForAllSemesters();
      fetchAssignedFees();
    } else {
      // Reset course fees when no department is selected
      setCourseFees({});
      setAssignedFees({});
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

  const fetchDegreeConfig = async () => {
    try {
      const response = await axios.get('http://localhost:65000/api/degree-config');
      window.degreeConfig = response.data;
    } catch (error) {
      console.error('Failed to load degree config');
    }
  };

  const getMaxSemesters = (level) => {
    const config = window.degreeConfig || {};
    return config[level]?.maxSemesters || 8;
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

  const fetchCoursesForAllSemesters = async () => {
    try {
      setLoading(true);
      setSaveStatus({});
      
      const semesters = Array.from({ length: maxSemesters }, (_, i) => i + 1);
      const allCourses = {};

      for (const semester of semesters) {
        try {
          const response = await axios.get('http://localhost:65000/api/fees/courses-for-fees', {
            params: { 
              degreeLevel, 
              department: department.trim(),
              semester 
            }
          });
          
          if (response.data.success) {
            allCourses[semester] = response.data.data.map(course => ({
              ...course,
              assignedFee: ''
            }));
          } else {
            allCourses[semester] = [];
          }
        } catch (error) {
          console.error(`Error fetching courses for semester ${semester}:`, error);
          allCourses[semester] = [];
        }
      }

      setCourseFees(allCourses);
    } catch (error) {
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedFees = async () => {
    try {
      const response = await axios.get('http://localhost:65000/api/fees/assigned-course-fees', {
        params: { degreeLevel, department: department.trim() }
      });
      
      if (response.data.success) {
        setAssignedFees(response.data.data);
        
        setCourseFees(prev => {
          const updated = { ...prev };
          Object.keys(response.data.data).forEach(semester => {
            if (updated[semester]) {
              updated[semester] = updated[semester].map(course => ({
                ...course,
                assignedFee: response.data.data[semester][course.courseCode] || ''
              }));
            }
          });
          return updated;
        });
      }
    } catch (error) {
      setAssignedFees({});
    }
  };

  const handleFeeChange = (semester, courseCode, value) => {
    setCourseFees(prev => ({
      ...prev,
      [semester]: prev[semester].map(course => 
        course.courseCode === courseCode 
          ? { ...course, assignedFee: value === '' ? '' : Number(value) }
          : course
      )
    }));
  };

  const saveSemesterFees = async (semester) => {
    if (!degreeLevel || !department) {
      toast.error('Please select degree level and department');
      return;
    }

    setIsSubmitting(true);
    setSaveStatus(prev => ({ ...prev, [semester]: 'saving' }));

    try {
      const semesterCourses = courseFees[semester] || [];
      const feesToSave = semesterCourses
        .filter(course => course.assignedFee && course.assignedFee > 0)
        .map(course => ({
          courseCode: course.courseCode,
          courseName: course.courseName,
          feeAmount: course.assignedFee,
          creditHrs: course.creditHrs,
          type: course.type
        }));

      if (feesToSave.length === 0) {
        toast.error('Please assign fees to at least one course');
        setSaveStatus(prev => ({ ...prev, [semester]: 'error' }));
        return;
      }

      const payload = {
        degreeLevel,
        department: department.trim(),
        semester,
        courseFees: feesToSave
      };

      const response = await axios.post('http://localhost:65000/api/fees/save-course-fees', payload);
      
      if (response.data.success) {
        toast.success(`Fees for semester ${semester} saved successfully!`);
        setSaveStatus(prev => ({ ...prev, [semester]: 'saved' }));
        fetchAssignedFees();
        
        setTimeout(() => {
          setSaveStatus(prev => ({ ...prev, [semester]: '' }));
        }, 3000);
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.response?.data?.message || 'Failed to save fees');
      setSaveStatus(prev => ({ ...prev, [semester]: 'error' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasAssignedFees = (semester) => {
    const semesterCourses = courseFees[semester] || [];
    return semesterCourses.some(course => course.assignedFee && course.assignedFee > 0);
  };

  const getSemesterStatus = (semester) => {
    const courses = courseFees[semester] || [];
    const assignedCount = courses.filter(course => course.assignedFee && course.assignedFee > 0).length;
    const totalCount = courses.length;
    
    if (totalCount === 0) return 'no-courses';
    if (assignedCount === 0) return 'not-assigned';
    if (assignedCount === totalCount) return 'fully-assigned';
    return 'partially-assigned';
  };

  const clearAllFees = (semester) => {
    setCourseFees(prev => {
      const updated = { ...prev };
      if (updated[semester]) {
        updated[semester] = updated[semester].map(course => ({
          ...course,
          assignedFee: ''
        }));
      }
      return updated;
    });
  };

  const generateColumns = (semester) => {
    return [
      {
        title: 'Course Information',
        dataIndex: 'courseName',
        key: 'courseName',
        fixed: 'left',
        width: 300,
        render: (text, record) => (
          <div>
            <div style={{ display: 'flex', fontSize: '15px', alignItems: 'center' }}>
              <strong>{record.courseName}</strong>
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              <div>Code: {record.courseCode}</div>
              <div>Type: {record.type}</div>
            </div>
          </div>
        )
      },
      {
        title: 'Credits',
        dataIndex: 'creditHrs',
        key: 'creditHrs',
        width: 100,
        align: 'center',
        render: (credits) => (
          <Tag color="#957bab" style={{ fontSize: '14px', padding: '4px 8px' }}>
            {credits} Cr
          </Tag>
        )
      },
      {
        title: 'Assigned Fee (Rs.)',
        dataIndex: 'assignedFee',
        key: 'assignedFee',
        width: 200,
        render: (currentFee, record) => {
          const previouslyAssigned = assignedFees[semester]?.[record.courseCode] || '';
          const hasPreviousFee = previouslyAssigned !== '';
          const displayFee = currentFee || (hasPreviousFee ? previouslyAssigned : '');
          
          return (
            <div className="input-group" style={{ width: '150px' }}>
              <span className="input-group-text">Rs. </span>
              <input
                type="number"
                className="form-control"
                value={displayFee}
                onChange={(e) => handleFeeChange(semester, record.courseCode, e.target.value)}
                min="0"
                step="100"
                placeholder="Enter fee"
                style={{ textAlign: 'right' }}
                disabled={!degreeLevel || !department}
              />
            </div>
          );
        }
      },
      {
        title: 'Status',
        key: 'status',
        width: 120,
        align: 'center',
        render: (_, record) => {
          const previouslyAssigned = assignedFees[activeSemester]?.[record.courseCode] || '';
          const hasPreviousFee = previouslyAssigned !== '';
          const hasCurrentFee = record.assignedFee && record.assignedFee > 0;
          
          if (hasPreviousFee || hasCurrentFee) {
            return (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                Assigned
              </Tag>
            );
          }
          
          return (
            <Tag color="orange" icon={<ExclamationCircleOutlined />}>
              Pending
            </Tag>
          );
        }
      }
    ];
  };

  const generateEmptyCourseData = () => {
    const emptyData = {};
    for (let i = 1; i <= maxSemesters; i++) {
      emptyData[i] = [];
    }
    return emptyData;
  };

  const emptyCourseData = generateEmptyCourseData();
  const displayCourseFees = degreeLevel && department ? courseFees : emptyCourseData;
  
  const courses = displayCourseFees[activeSemester] || [];
  const assignedCount = courses.filter(c => {
    const previouslyAssigned = assignedFees[activeSemester]?.[c.courseCode] || '';
    return (c.assignedFee && c.assignedFee > 0) || previouslyAssigned !== '';
  }).length;
  const totalCount = courses.length;
  const totalFee = courses.reduce((sum, course) => {
    const currentFee = course.assignedFee || 0;
    const previousFee = assignedFees[activeSemester]?.[course.courseCode] || 0;
    return sum + (currentFee > 0 ? currentFee : previousFee);
  }, 0);

  return (
    <div className="course-fee container mt-5">
      <h2 className="course-fee-title">Course Fee Management</h2>
      
      <div className="form-row">
        <div className="form-group">
          <label>Degree Level</label>
          <select
            className="form-select"
            value={degreeLevel}
            onChange={(e) => setDegreeLevel(e.target.value)}
            required
          >
            <option value="">Select Degree Level</option>
            {degreeLevels.map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Department</label>
          <select
            className="form-select"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
            disabled={!degreeLevel}
          >
            <option value="">Select Department</option>
            {departments.map(dept => (
              <option key={dept._id} value={dept.departmentName}>
                {dept.departmentName}
              </option>
            ))}
          </select>
        </div>
      </div>


      <div className="semester-section">
        <div className="section-header">
          <Title level={3} className="section-title">Semester Fees Management</Title>
          <Text className="section-subtitle">
            {degreeLevel && department ? `${degreeLevel} - ${department}` : 'Select degree level and department to manage fees'}
          </Text>
        </div>

        <Card className="Assgin-fee-card" style={{ borderRadius: '8px', border: 'none' }}>
        
          
          <Tabs 
            activeKey={activeSemester} 
            onChange={setActiveSemester}
            type="card"
            className="custom-tabs"
          >
            {Array.from({ length: maxSemesters }, (_, i) => i + 1).map(semester => (
              <TabPane 
                tab={
                  <span>
                    Semester {semester}
                    {degreeLevel && department && getSemesterStatus(semester) === 'fully-assigned' && (
                      <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 5 }} />
                    )}
                  </span>
                } 
                key={semester.toString()}
              >
                {loading && degreeLevel && department ? (
                  <div style={{ textAlign: 'center', padding: '50px' }}>
                    <Spin size="large" />
                    <div>Loading courses for semester {semester}...</div>
                  </div>
                ) : (
                  <div>
                    <Table
                      columns={generateColumns(semester)}
                      dataSource={displayCourseFees[semester] || []}
                      bordered
                      scroll={{ x: true }}
                      pagination={false}
                      loading={false}
                      title={() => (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text strong>Semester {semester} - Course Fee Assignments</Text>
                          {degreeLevel && department && (
                            <Tag color="#957bab" style={{padding:'5px'}}>
                              {assignedCount}/{totalCount} courses assigned
                            </Tag>
                          )}
                        </div>
                      )}
                      rowKey="courseCode"
                      locale={{
                        emptyText: degreeLevel && department ? (
                          <Empty
                            description="No courses found for this semester"
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                          />
                        ) : (
                          <Empty
                            description="Select degree level and department to view courses"
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                          />
                        )
                      }}
                    />
                    
                    {(displayCourseFees[semester] || []).length > 0 && degreeLevel && department && (
                      <div className="table-footer">
                        <div className="footer-summary">
                          <Text>
                            Total Courses: {totalCount} | 
                            Assigned Courses: {assignedCount} | 
                            Total Fee For the semester: Rs. {totalFee.toLocaleString()}
                          </Text>
                        </div>
                        <Space>
                          
                          <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={() => saveSemesterFees(semester)}
                            disabled={!hasAssignedFees(semester)}
                            loading={saveStatus[semester] === 'saving'}
                            className="save-button"
                          >
                            {saveStatus[semester] === 'saving' ? 'Saving...' : 
                             saveStatus[semester] === 'saved' ? 'Saved' : 
                             saveStatus[semester] === 'error' ? 'Retry Save' : 'Save Semester'}
                          </Button>
                          <Button
                            className="clear-button"
                            icon={<UndoOutlined />}
                            onClick={() => clearAllFees(semester)}
                          >
                            Clear All
                          </Button>
                        </Space>
                      </div>
                    )}
                  </div>
                )}
              </TabPane>
            ))}
          </Tabs>
        </Card>
      </div>

      <ToastContainer 
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
};

export default CourseFee;