import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import API_URL from '../../../config';

import { 
  faSearch, faEye, faDownload, faSync, 
  faCheckCircle, faTimesCircle, faExclamationTriangle,
  faChartBar, faUserGraduate, faBook
} from '@fortawesome/free-solid-svg-icons';
import { 
  Select, Table, Button, Card, Row, Col, 
  Tag, Tabs, Divider, Spin, Space, Typography, Tooltip, Empty, Input,
  Modal, Statistic, Progress, Alert, Badge
} from 'antd';
import { 
  SearchOutlined, EyeOutlined, DownloadOutlined, SyncOutlined,
  InfoCircleOutlined, FileTextOutlined, TeamOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ExclamationOutlined,
  BarChartOutlined, UserOutlined, BookOutlined
} from '@ant-design/icons';
import moment from 'moment';
const { Option } = Select;
const { TabPane } = Tabs;
const { Text, Title } = Typography;
const { Search } = Input;

const BatchResultsManagement = () => {
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedDegree, setSelectedDegree] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchDetails, setBatchDetails] = useState(null);
  const [batchResults, setBatchResults] = useState([]);
  const [studentResults, setStudentResults] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [loading, setLoading] = useState({
    degree: false,
    department: false,
    batch: false,
    details: false,
    results: false,
    studentResults: false
  });
  const [resultDetailsModal, setResultDetailsModal] = useState({
    visible: false,
    data: null
  });

  const filteredStudents = Object.values(studentResults).filter(student => {
    const searchLower = searchTerm.toLowerCase();
    return (
      student.studentId?.toLowerCase().includes(searchLower) ||
      student.studentName?.toLowerCase().includes(searchLower) ||
      `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchLower)
    );
  });

  useEffect(() => {
    const fetchDegreeLevels = async () => {
      try {
        setLoading(prev => ({ ...prev, degree: true }));
        const response = await axios.get(`${API_URL}/degree-levels`);
        setDegreeLevels(response.data);
      } catch (error) {
        console.error('Error fetching degree levels:', error);
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
        const response = await axios.get(`${API_URL}/departments/by-degree`, {
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
        console.error('Error fetching departments:', error);
      } finally {
        setLoading(prev => ({ ...prev, department: false }));
      }
    };
    fetchDepartments();
  }, [selectedDegree]);

  // Fetch batches when department is selected
  useEffect(() => {
    if (!selectedDepartment) {
      setBatches([]);
      setSelectedBatch(null);
      return;
    }

    const fetchBatches = async () => {
      try {
        setLoading(prev => ({ ...prev, batch: true }));
        const response = await axios.get(`${API_URL}/teacher-assignment/batches/active`, {
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
      setBatchResults([]);
      setStudentResults({});
      return;
    }

    const fetchBatchData = async () => {
      try {
        setLoading(prev => ({ ...prev, details: true, results: true }));
        
        const [detailsResponse, resultsResponse] = await Promise.all([
          axios.get(`${API_URL}/teacher-assignment/batches/${selectedBatch}`),
          axios.get(`${API_URL}/results/batch/${selectedBatch}`)
        ]);

        const batchData = detailsResponse.data;
        const actualBatchData = batchData.data || batchData;
        
        const academicCalendar = actualBatchData.academicCalendar || [];
        const currentSemester = actualBatchData.currentSemester || 1;
        
        const currentSemesterData = academicCalendar.find(
          sem => sem.semester === currentSemester
        );
        
        setBatchDetails({
          ...actualBatchData,
          batchName: actualBatchData.batchName || 'Unknown Batch',
          currentSemester: currentSemester,
          currentSemesterStart: currentSemesterData?.startDate,
          currentSemesterEnd: currentSemesterData?.endDate,
          currentSemesterName: currentSemesterData?.name || `Semester ${currentSemester}`,
          sectionNames: actualBatchData.sections?.map(s => s.name) || [],
          totalSections: actualBatchData.sections?.length || 0,
          totalSemesters: actualBatchData.totalSemesters || 8
        });

        if (resultsResponse.data.success) {
          const resultsData = resultsResponse.data.data || [];
          setBatchResults(resultsData);
          await processStudentResults(resultsData);
        }
        
      } catch (error) {
        console.error('Error fetching batch data:', error);
      } finally {
        setLoading(prev => ({ ...prev, details: false, results: false }));
      }
    };
    fetchBatchData();
  }, [selectedBatch]);

  const processStudentResults = async (results) => {
    try {
      setLoading(prev => ({ ...prev, studentResults: true }));
      
      const studentMap = {};
      
      results.forEach(result => {
        if (result.status !== 'published') return;
        
        result.results.forEach(studentResult => {
          const studentId = studentResult.studentId;
          
          if (!studentMap[studentId]) {
            studentMap[studentId] = {
              studentId: studentId,
              studentName: studentResult.studentName,
              firstName: studentResult.firstName || '',
              lastName: studentResult.lastName || '',
              section: result.sectionName,
              courses: [],
              totalCredits: 0,
              totalGradePoints: 0,
              sgpa: 0
            };
          }
          
          const courseData = {
            courseCode: result.courseCode,
            courseName: result.courseName,
            semester: result.semester,
            sectionName: result.sectionName,
            creditHrs: result.creditHrs,
            totalObtainedMarks: studentResult.totalObtainedMarks,
            grade: studentResult.grade,
            gradePoints: studentResult.gradePoints,
            assessments: Object.fromEntries(studentResult.assessments || new Map()),
            publishedAt: result.publishedAt,
            publishedBy: result.publishedBy
          };
          
          studentMap[studentId].courses.push(courseData);
          studentMap[studentId].totalCredits += result.creditHrs || 0;
          studentMap[studentId].totalGradePoints += (studentResult.gradePoints || 0) * (result.creditHrs || 0);
        });
      });
      
      Object.keys(studentMap).forEach(studentId => {
        const student = studentMap[studentId];
        if (student.totalCredits > 0) {
          student.sgpa = Number((student.totalGradePoints / student.totalCredits).toFixed(2));
        }
      });
      
      setStudentResults(studentMap);
    } catch (error) {
      console.error('Error processing student results:', error);
    } finally {
      setLoading(prev => ({ ...prev, studentResults: false }));
    }
  };

  const calculateBatchStatistics = () => {
    const publishedResults = batchResults.filter(result => result.status === 'published');
    const totalStudents = Object.keys(studentResults).length;
    const studentsWithResults = Object.values(studentResults).filter(student => 
      student.courses.length > 0
    ).length;
    
    const coursesBySemester = {};
    const gradeDistribution = {
      'A+': 0, 'A': 0, 'A-': 0,
      'B+': 0, 'B': 0, 'B-': 0,
      'C+': 0, 'C': 0, 'C-': 0,
      'D+': 0, 'D': 0, 'F': 0
    };

    Object.values(studentResults).forEach(student => {
      student.courses.forEach(course => {
        if (course.grade && gradeDistribution.hasOwnProperty(course.grade)) {
          gradeDistribution[course.grade]++;
        }
        
        if (!coursesBySemester[course.semester]) {
          coursesBySemester[course.semester] = new Set();
        }
        coursesBySemester[course.semester].add(course.courseCode);
      });
    });

    const averageSGPA = totalStudents > 0 
      ? Object.values(studentResults).reduce((sum, student) => sum + (student.sgpa || 0), 0) / totalStudents
      : 0;

    return {
      totalPublishedResults: publishedResults.length,
      totalStudents,
      studentsWithResults,
      completionRate: totalStudents > 0 ? (studentsWithResults / totalStudents) * 100 : 0,
      averageSGPA: Number(averageSGPA.toFixed(2)),
      gradeDistribution,
      coursesBySemester: Object.keys(coursesBySemester).reduce((acc, sem) => {
        acc[sem] = coursesBySemester[sem].size;
        return acc;
      }, {})
    };
  };

  const refreshResults = async () => {
    if (!selectedBatch) return;
    
    try {
      setLoading(prev => ({ ...prev, results: true, studentResults: true }));
      
      const response = await axios.get(`${API_URL}/results/batch/${selectedBatch}`);
      
      if (response.data.success) {
        const resultsData = response.data.data || [];
        setBatchResults(resultsData);
        await processStudentResults(resultsData);
      }
    } catch (error) {
      console.error('Error refreshing results:', error);
    } finally {
      setLoading(prev => ({ ...prev, results: false, studentResults: false }));
    }
  };
  const viewResultDetails = (result) => {
    setResultDetailsModal({
      visible: true,
      data: result
    });
  };

  const downloadResults = async (format = 'excel') => {
    try {
      const response = await axios.get(`${API_URL}/results/batch/${selectedBatch}/export`, {
        params: { format },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `batch-results-${batchDetails?.batchName}-${moment().format('YYYY-MM-DD')}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading results:', error);
    }
  };

  const resultsOverviewColumns = [
    {
      title: 'Course Information',
      dataIndex: 'courseName',
      key: 'courseName',
      width: 300,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
            {record.courseName}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <div>Code: {record.courseCode}</div>
            <div>Credits: {record.creditHrs}</div>
            <div>Semester: {record.semester}</div>
          </div>
        </div>
      )
    },
    {
      title: 'Section',
      dataIndex: 'sectionName',
      key: 'sectionName',
      width: 120,
      align: 'center',
      render: (section) => (
        <Tag color="blue" style={{ fontSize: '12px' }}>
          {section}
        </Tag>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (status) => (
        <Tag 
          color={status === 'published' ? 'green' : status === 'draft' ? 'orange' : 'red'}
          style={{ fontSize: '12px' }}
        >
          {status?.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Students',
      dataIndex: 'results',
      key: 'students',
      width: 100,
      align: 'center',
      render: (results) => (
        <div style={{ textAlign: 'center' }}>
          <UserOutlined style={{ marginRight: 4 }} />
          {results?.length || 0}
        </div>
      )
    },
    {
      title: 'Published Date',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      width: 150,
      align: 'center',
      render: (date) => date ? moment(date).format('MMM D, YYYY') : '-'
    },
    {
      title: 'Published By',
      dataIndex: 'publishedBy',
      key: 'publishedBy',
      width: 150,
      render: (publishedBy) => publishedBy || '-'
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button 
              type="link" 
              icon={<EyeOutlined />}
              onClick={() => viewResultDetails(record)}
              size="small"
            />
          </Tooltip>
          {record.status === 'published' && (
            <Tooltip title="Download">
              <Button 
                type="link" 
                icon={<DownloadOutlined />}
                onClick={() => downloadResults('excel')}
                size="small"
              />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  const studentResultsColumns = [
    {
      title: 'Student ID',
      dataIndex: 'studentId',
      key: 'studentId',
      width: 120,
      fixed: 'left',
      sorter: (a, b) => a.studentId.localeCompare(b.studentId)
    },
    {
      title: 'Student Name',
      dataIndex: 'studentName',
      key: 'studentName',
      width: 150,
      fixed: 'left',
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{name}</div>
          <div style={{ fontSize: '11px', color: '#666' }}>
            Section: {record.section}
          </div>
        </div>
      )
    },
    {
      title: 'Courses Completed',
      dataIndex: 'courses',
      key: 'coursesCompleted',
      width: 100,
      align: 'center',
      render: (courses) => (
        <Tag color="blue">
          <BookOutlined /> {courses.length}
        </Tag>
      )
    },
    {
      title: 'Total Credits',
      dataIndex: 'totalCredits',
      key: 'totalCredits',
      width: 100,
      align: 'center',
      render: (credits) => (
        <Text strong>{credits}</Text>
      )
    },
    {
      title: 'SGPA',
      dataIndex: 'sgpa',
      key: 'sgpa',
      width: 100,
      align: 'center',
      render: (sgpa) => (
        <Tag 
          color={
            sgpa >= 3.5 ? 'green' : 
            sgpa >= 3.0 ? 'blue' : 
            sgpa >= 2.0 ? 'orange' : 'red'
          }
          style={{ fontWeight: 'bold', fontSize: '12px' }}
        >
          {sgpa || 'N/A'}
        </Tag>
      ),
      sorter: (a, b) => (a.sgpa || 0) - (b.sgpa || 0)
    },
    {
      title: 'Grade Distribution',
      key: 'gradeDistribution',
      width: 200,
      render: (_, record) => {
        const gradeCount = {};
        record.courses.forEach(course => {
          if (course.grade) {
            gradeCount[course.grade] = (gradeCount[course.grade] || 0) + 1;
          }
        });
        
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.entries(gradeCount).slice(0, 4).map(([grade, count]) => (
              <Tag key={grade} size="small" style={{ fontSize: '10px' }}>
                {grade}: {count}
              </Tag>
            ))}
            {Object.keys(gradeCount).length > 4 && (
              <Tag size="small" style={{ fontSize: '10px' }}>
                +{Object.keys(gradeCount).length - 4}
              </Tag>
            )}
          </div>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Tooltip title="View Detailed Results">
          <Button 
            type="primary" 
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setActiveTab('student-details')}
          >
            Details
          </Button>
        </Tooltip>
      )
    }
  ];

  const statistics = calculateBatchStatistics();

  return (
    <div className="Batch-Results-Management container mt-4">
      <div className="header-section">
        <h2 className="page-title">
          <FontAwesomeIcon icon={faChartBar} style={{ marginRight: 12 }} />
          Batch Results Management
        </h2>
        <Text type="secondary">
          View and manage published results for batches across departments
        </Text>
      </div>

      {/* Selection Filters */}
      <Card className="selection-card" style={{ marginBottom: 16 }}>
        <div className="form-row responsive-form">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Degree Level</label>
            <Select
              placeholder="Select Degree Level"
              value={selectedDegree}
              onChange={setSelectedDegree}
              loading={loading.degree}
              style={{ width: '100%' }}
            >
              {degreeLevels.map(level => (
                <Option key={level._id || level} value={level.name || level}>
                  {level.name || level}
                </Option>
              ))}
            </Select>
          </div>

          <div className="form-group" style={{ flex: 1 }}>
            <label>Department</label>
            <Select
              placeholder="Select Department"
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              loading={loading.department}
              disabled={!selectedDegree}
              style={{ width: '100%' }}
            >
              {departments.map(dept => (
                <Option key={dept._id} value={dept.departmentName || dept.name}>
                  {dept.departmentName || dept.name} 
                  {dept.departmentCode ? ` (${dept.departmentCode})` : ''}
                </Option>
              ))}
            </Select>
          </div>

          <div className="form-group" style={{ flex: 1 }}>
            <label>Batch</label>
            <Select
              placeholder="Select Batch"
              value={selectedBatch}
              onChange={setSelectedBatch}
              loading={loading.batch}
              disabled={!selectedDepartment}
              style={{ width: '100%' }}
            >
              {batches.map(batch => (
                <Option key={batch._id} value={batch._id}>
                  {batch.batchName} ({batch.enrollmentYear})
                </Option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {loading.details && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Loading batch details...</div>
        </div>
      )}

      {batchDetails && (
        <>
          {/* Batch Information */}
          <Card className="batch-info-card" style={{ marginBottom: 16 }}>
            <div className="batch-header">
              <div className="batch-title-section">
                <h3 className="batch-name">{batchDetails.batchName}</h3>
                <div className="batch-meta">
                  <Tag color="blue">{selectedDegree}</Tag>
                  <Tag color="green">{selectedDepartment}</Tag>
                  <Tag color="orange">Semester {batchDetails.currentSemester}</Tag>
                </div>
              </div>
              <div className="batch-actions">
                <Button 
                  icon={<SyncOutlined />} 
                  onClick={refreshResults}
                  loading={loading.results}
                >
                  Refresh Results
                </Button>
                <Button 
                  type="primary" 
                  icon={<DownloadOutlined />}
                  onClick={() => downloadResults('excel')}
                  disabled={statistics.totalPublishedResults === 0}
                >
                  Export Results
                </Button>
              </div>
            </div>

            <Divider />

            {/* Statistics */}
            <Row gutter={16}>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Published Results"
                  value={statistics.totalPublishedResults}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Students with Results"
                  value={statistics.studentsWithResults}
                  suffix={`/ ${statistics.totalStudents}`}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Average SGPA"
                  value={statistics.averageSGPA}
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Completion Rate"
                  value={statistics.completionRate}
                  suffix="%"
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: statistics.completionRate === 100 ? '#52c41a' : '#faad14' }}
                />
              </Col>
            </Row>

            {statistics.completionRate < 100 && (
              <Alert
                message="Results Incomplete"
                description={`Only ${statistics.completionRate.toFixed(1)}% of students have published results.`}
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </Card>

          {/* Main Content Tabs */}
          <Card>
            <Tabs 
              activeKey={activeTab} 
              onChange={setActiveTab}
              type="card"
            >
              {/* Overview Tab */}
              <TabPane tab="Results Overview" key="overview">
                <div className="tab-header">
                  <Title level={4}>Published Results by Course</Title>
                  <Text type="secondary">
                    Showing {batchResults.filter(r => r.status === 'published').length} published results
                  </Text>
                </div>
                
                <Table
                  columns={resultsOverviewColumns}
                  dataSource={batchResults}
                  rowKey={record => `${record.courseCode}-${record.sectionName}-${record.semester}`}
                  loading={loading.results}
                  scroll={{ x: 1000 }}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true
                  }}
                  locale={{
                    emptyText: (
                      <Empty
                        description="No published results found for this batch"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    )
                  }}
                />
              </TabPane>

              {/* Student Results Tab */}
              <TabPane tab="Student Results" key="student-results">
                <div className="tab-header">
                  <div className="header-content">
                    <Title level={4}>Student Performance Summary</Title>
                    <Text type="secondary">
                      {filteredStudents.length} students found
                    </Text>
                  </div>
                  <div className="header-actions">
                    <Search
                      placeholder="Search students..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ width: 300 }}
                      allowClear
                    />
                  </div>
                </div>

                <Table
                  columns={studentResultsColumns}
                  dataSource={filteredStudents}
                  rowKey="studentId"
                  loading={loading.studentResults}
                  scroll={{ x: 1200 }}
                  pagination={{
                    pageSize: 15,
                    showSizeChanger: true,
                    showQuickJumper: true
                  }}
                  locale={{
                    emptyText: (
                      <Empty
                        description="No student results found"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    )
                  }}
                />
              </TabPane>

              {/* Analytics Tab */}
              <TabPane tab="Analytics" key="analytics">
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <Card title="Grade Distribution" size="small">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {Object.entries(statistics.gradeDistribution)
                          .filter(([_, count]) => count > 0)
                          .map(([grade, count]) => (
                            <div key={grade} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <Tag 
                                color={
                                  grade === 'A+' || grade === 'A' || grade === 'A-' ? 'green' :
                                  grade.includes('B') ? 'blue' :
                                  grade.includes('C') ? 'orange' :
                                  grade.includes('D') ? 'volcano' : 'red'
                                }
                                style={{ minWidth: 40, textAlign: 'center' }}
                              >
                                {grade}
                              </Tag>
                              <Progress 
                                percent={Number(((count / Object.values(statistics.gradeDistribution).reduce((a, b) => a + b, 0)) * 100).toFixed(1))}
                                size="small"
                                style={{ flex: 1 }}
                              />
                              <Text style={{ minWidth: 40 }}>{count}</Text>
                            </div>
                          ))}
                      </div>
                    </Card>
                  </Col>
                  
                  <Col xs={24} lg={12}>
                    <Card title="Courses by Semester" size="small">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {Object.entries(statistics.coursesBySemester).map(([semester, count]) => (
                          <div key={semester} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong>Semester {semester}</Text>
                            <Badge 
                              count={count} 
                              showZero 
                              style={{ backgroundColor: '#52c41a' }}
                            />
                          </div>
                        ))}
                      </div>
                    </Card>
                  </Col>
                </Row>
              </TabPane>
            </Tabs>
          </Card>
        </>
      )}

      {/* Result Details Modal */}
      <Modal
        title="Result Details"
        visible={resultDetailsModal.visible}
        onCancel={() => setResultDetailsModal({ visible: false, data: null })}
        footer={[
          <Button key="close" onClick={() => setResultDetailsModal({ visible: false, data: null })}>
            Close
          </Button>,
          <Button 
            key="download" 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={() => downloadResults('excel')}
          >
            Download
          </Button>
        ]}
        width={800}
      >
        {resultDetailsModal.data && (
          <div>
            <div className="result-header" style={{ marginBottom: 16 }}>
              <Title level={4}>{resultDetailsModal.data.courseName}</Title>
              <Text type="secondary">
                {resultDetailsModal.data.courseCode} • Section {resultDetailsModal.data.sectionName} • 
                Semester {resultDetailsModal.data.semester} • {resultDetailsModal.data.creditHrs} Credits
              </Text>
            </div>
            
            <Table
              columns={[
                { title: 'Student ID', dataIndex: 'studentId', key: 'studentId', width: 120 },
                { title: 'Student Name', dataIndex: 'studentName', key: 'studentName', width: 150 },
                { title: 'Total Marks', dataIndex: 'totalObtainedMarks', key: 'totalObtainedMarks', width: 100, align: 'center' },
                { 
                  title: 'Grade', 
                  dataIndex: 'grade', 
                  key: 'grade', 
                  width: 80, 
                  align: 'center',
                  render: (grade) => (
                    <Tag 
                      color={
                        grade === 'A+' || grade === 'A' || grade === 'A-' ? 'green' :
                        grade.includes('B') ? 'blue' :
                        grade.includes('C') ? 'orange' :
                        grade.includes('D') ? 'volcano' : 'red'
                      }
                    >
                      {grade}
                    </Tag>
                  )
                },
                { title: 'Grade Points', dataIndex: 'gradePoints', key: 'gradePoints', width: 100, align: 'center' }
              ]}
              dataSource={resultDetailsModal.data.results || []}
              rowKey="studentId"
              pagination={false}
              scroll={{ y: 400 }}
              size="small"
            />
          </div>
        )}
      </Modal>

      {!selectedBatch && !loading.details && (
        <Card style={{ textAlign: 'center', padding: '40px' }}>
          <Empty
            description="Please select a batch to view results"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}
    </div>
  );
};

export default BatchResultsManagement;