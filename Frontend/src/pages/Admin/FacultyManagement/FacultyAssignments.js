import React, { useState, useEffect } from 'react';
import API_URL from '../../../config';

import axios from 'axios';
import { 
  Card, Table, Button, Tag, Space, Input, Select, 
  Row, Col, Typography, Alert, Spin, Empty, Tooltip
} from 'antd';
import { 
  SearchOutlined, SyncOutlined, EyeOutlined, 
  CheckCircleOutlined, ClockCircleOutlined, UserOutlined,
  BookOutlined, TeamOutlined, FileDoneOutlined,
  FilterOutlined, ClearOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

const TeacherAssignmentsListView = () => {
  const [assignments, setAssignments] = useState([]);
  const [filteredAssignments, setFilteredAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    teachingStatus: 'all',
    semester: 'all',
    department: 'all',
    degreeLevel: 'all',
    searchTerm: ''
  });
  const [departments, setDepartments] = useState([]);
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  const fetchFiltersData = async () => {
    try {
      const degreeResponse = await axios.get(`${API_URL}/api/degree-levels`);
      console.log('Degree Levels Response:', degreeResponse.data);
      
      let degreeData = [];
      if (Array.isArray(degreeResponse.data)) {
        degreeData = degreeResponse.data;
      } else if (degreeResponse.data.data && Array.isArray(degreeResponse.data.data)) {
        degreeData = degreeResponse.data.data;
      } else if (degreeResponse.data.degreeLevels && Array.isArray(degreeResponse.data.degreeLevels)) {
        degreeData = degreeResponse.data.degreeLevels;
      }
      
      const formattedDegreeLevels = degreeData.map(level => ({
        value: level.name || level.degreeLevelName || level,
        label: level.name || level.degreeLevelName || level
      })).filter(level => level.value); 
      
      setDegreeLevels(formattedDegreeLevels);
      console.log('Formatted Degree Levels:', formattedDegreeLevels);

      const deptResponse = await axios.get(`${API_URL}/api/departments/by-degree`);
      console.log('Departments Response:', deptResponse.data);
      
      let deptData = [];
      if (Array.isArray(deptResponse.data)) {
        deptData = deptResponse.data;
      } else if (deptResponse.data.data && Array.isArray(deptResponse.data.data)) {
        deptData = deptResponse.data.data;
      } else if (deptResponse.data.departments && Array.isArray(deptResponse.data.departments)) {
        deptData = deptResponse.data.departments;
      }
      
      const formattedDepartments = deptData.map(dept => ({
        value: dept.departmentName || dept.name || dept,
        label: dept.departmentName || dept.name || dept
      })).filter(dept => dept.value);
      
      setDepartments(formattedDepartments);
      console.log('Formatted Departments:', formattedDepartments);

    } catch (error) {
      console.error('Error fetching filter data:', error);
    }
  };

  const fetchTeacherAssignments = async () => {
    setLoading(true);
    try {
      const batchesResponse = await axios.get(`${API_URL}/api/teacher-assignment/batches/active`);
      
      let batchesData = [];
      if (Array.isArray(batchesResponse.data)) {
        batchesData = batchesResponse.data;
      } else if (batchesResponse.data.data && Array.isArray(batchesResponse.data.data)) {
        batchesData = batchesResponse.data.data;
      }

      const facultyResponse = await axios.get(`${API_URL}/api/teacher-assignment/faculty/with-teaching-status`);
      
      let facultyData = [];
      if (Array.isArray(facultyResponse.data)) {
        facultyData = facultyResponse.data;
      } else if (facultyResponse.data.data && Array.isArray(facultyResponse.data.data)) {
        facultyData = facultyResponse.data.data;
      }

      const assignmentRecords = [];

      for (const batch of batchesData) {
        if (!batch._id || batch.graduationStatus === 'graduated') continue;

        const currentSemester = batch.currentSemester || 1;
        
        try {
          const coursesResponse = await axios.get(
            `${API_URL}/api/teacher-assignment/batches/${batch._id}/semesters/${currentSemester}/courses`
          );

          const coursesData = coursesResponse.data.data || coursesResponse.data || [];

          coursesData.forEach(course => {
            if (!course.sections || !Array.isArray(course.sections)) return;

            course.sections.forEach(section => {
              if (section.facultyId && section.facultyName) {
                const faculty = facultyData.find(f => f._id === section.facultyId);
                
                assignmentRecords.push({
                  key: `${batch._id}-${course.courseCode}-${section.sectionName}-assigned`,
                  facultyId: section.facultyId,
                  facultyName: section.facultyName,
                  employeeId: faculty?.employeeId || 'N/A',
                  designation: faculty?.designation || 'N/A',
                  department: batch.departmentName || batch.department,
                  degreeLevel: batch.degreeLevel,
                  courseCode: course.courseCode,
                  courseName: course.courseName,
                  sectionName: section.sectionName,
                  semester: currentSemester,
                  batchId: batch._id,
                  batchName: batch.batchName,
                  creditHrs: course.creditHrs,
                  teachingStatus: section.teachingStatus || 'in-progress',
                  status: section.teachingStatus === 'completed' ? 'Completed' : 'Active',
                  assignedAt: section.assignedAt,
                  isActive: section.status === 'active',
                  facultyData: faculty,
                  isAssigned: true
                });
              } else {
                assignmentRecords.push({
                  key: `${batch._id}-${course.courseCode}-${section.sectionName}-unassigned`,
                  facultyId: null,
                  facultyName: 'Not Assigned',
                  employeeId: 'N/A',
                  designation: 'N/A',
                  department: batch.departmentName || batch.department,
                  degreeLevel: batch.degreeLevel,
                  courseCode: course.courseCode,
                  courseName: course.courseName,
                  sectionName: section.sectionName,
                  semester: currentSemester,
                  batchId: batch._id,
                  batchName: batch.batchName,
                  creditHrs: course.creditHrs,
                  teachingStatus: 'unassigned',
                  status: 'Unassigned',
                  assignedAt: null,
                  isActive: false,
                  facultyData: null,
                  isAssigned: false
                });
              }
            });
          });

        } catch (error) {
          console.error(`Error fetching courses for batch ${batch.batchName}:`, error);
          continue;
        }
      }

      facultyData.forEach(faculty => {
        faculty.completedAssignments?.forEach(assignment => {
          assignmentRecords.push({
            key: `${faculty._id}-${assignment.courseCode}-${assignment.sectionName}-completed`,
            facultyId: faculty._id,
            facultyName: faculty.name || `${faculty.firstName} ${faculty.lastName}`,
            employeeId: faculty.employeeId,
            designation: faculty.designation,
            department: assignment.department || faculty.department,
            degreeLevel: assignment.degreeLevel,
            courseCode: assignment.courseCode,
            courseName: assignment.courseName,
            sectionName: assignment.sectionName,
            semester: assignment.semester,
            batchId: assignment.batchId,
            batchName: assignment.batchName,
            creditHrs: assignment.creditHrs,
            teachingStatus: 'completed',
            status: 'Completed',
            assignedAt: assignment.assignedAt,
            completedAt: assignment.completedAt,
            isActive: false,
            facultyData: faculty,
            isAssigned: true
          });
        });
      });

      console.log('Final Assignment Records:', assignmentRecords);
      setAssignments(assignmentRecords);
      setFilteredAssignments(assignmentRecords);
      setPagination(prev => ({
        ...prev,
        total: assignmentRecords.length
      }));

    } catch (error) {
      console.error('Error fetching teacher assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiltersData();
    fetchTeacherAssignments();
  }, []);

  useEffect(() => {
    let filtered = [...assignments];

    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(assignment => 
        assignment.facultyName?.toLowerCase().includes(searchLower) ||
        assignment.employeeId?.toLowerCase().includes(searchLower) ||
        assignment.courseCode?.toLowerCase().includes(searchLower) ||
        assignment.courseName?.toLowerCase().includes(searchLower) ||
        assignment.department?.toLowerCase().includes(searchLower) ||
        assignment.batchName?.toLowerCase().includes(searchLower) ||
        assignment.sectionName?.toLowerCase().includes(searchLower) ||
        assignment.degreeLevel?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.teachingStatus !== 'all') {
      if (filters.teachingStatus === 'unassigned') {
        filtered = filtered.filter(assignment => !assignment.isAssigned);
      } else {
        filtered = filtered.filter(assignment => 
          assignment.teachingStatus === filters.teachingStatus
        );
      }
    }

    if (filters.department !== 'all') {
      filtered = filtered.filter(assignment => 
        assignment.department === filters.department
      );
    }

    if (filters.degreeLevel !== 'all') {
      filtered = filtered.filter(assignment => 
        assignment.degreeLevel === filters.degreeLevel
      );
    }

    if (filters.semester !== 'all') {
      filtered = filtered.filter(assignment => 
        assignment.semester === parseInt(filters.semester)
      );
    }

    setFilteredAssignments(filtered);
    setPagination(prev => ({
      ...prev,
      total: filtered.length,
      current: 1
    }));
  }, [filters, assignments]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      teachingStatus: 'all',
      semester: 'all',
      department: 'all',
      degreeLevel: 'all',
      searchTerm: ''
    });
  };

  const refreshData = () => {
    fetchTeacherAssignments();
    fetchFiltersData();
  };

  const getStatusTag = (status, isAssigned) => {
    if (!isAssigned) {
      return <Tag color="orange">Not Assigned</Tag>;
    }

    const statusConfig = {
      'in-progress': { color: 'blue', text: 'In Progress', icon: <ClockCircleOutlined /> },
      'completed': { color: 'green', text: 'Completed', icon: <CheckCircleOutlined /> },
      'unassigned': { color: 'orange', text: 'Not Assigned' }
    };

    const config = statusConfig[status] || { color: 'default', text: status, icon: null };

    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const getSemesterOptions = () => {
    const semesters = [...new Set(assignments.map(a => a.semester))].filter(s => s).sort((a, b) => a - b);
    return semesters.map(sem => (
      <Option key={sem} value={sem.toString()}>Semester {sem}</Option>
    ));
  };

  const stats = {
    total: assignments.length,
    assigned: assignments.filter(a => a.isAssigned).length,
    unassigned: assignments.filter(a => !a.isAssigned).length,
    inProgress: assignments.filter(a => a.teachingStatus === 'in-progress').length,
    completed: assignments.filter(a => a.teachingStatus === 'completed').length,
    departments: new Set(assignments.map(a => a.department)).size,
    degreeLevels: new Set(assignments.map(a => a.degreeLevel)).size
  };

  const desktopColumns = [
    {
      title: 'Faculty Information',
      dataIndex: 'facultyName',
      key: 'facultyName',
      width: 200,
      fixed: 'left',
      render: (name, record) => (
        <div>
          <div style={{ 
            fontWeight: 'bold', 
            fontSize: '14px',
            color: record.isAssigned ? '#262626' : '#ff4d4f'
          }}>
            {name || 'Not Assigned'}
          </div>
          {record.isAssigned && (
            <>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {record.employeeId || 'N/A'}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {record.designation || 'N/A'}
              </div>
            </>
          )}
        </div>
      ),
      sorter: (a, b) => (a.facultyName || '').localeCompare(b.facultyName || '')
    },
    {
      title: 'Degree Level',
      dataIndex: 'degreeLevel',
      key: 'degreeLevel',
      width: 120,
      render: (degreeLevel) => (
        <Tag color="blue" style={{ fontSize: '11px' }}>
          {degreeLevel || 'N/A'}
        </Tag>
      ),
      sorter: (a, b) => (a.degreeLevel || '').localeCompare(b.degreeLevel || '')
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 150,
      render: (department) => (
        <Tag color="purple" style={{ fontSize: '11px' }}>
          {department || 'N/A'}
        </Tag>
      ),
      sorter: (a, b) => (a.department || '').localeCompare(b.department || '')
    },
    {
      title: 'Course Details',
      dataIndex: 'courseName',
      key: 'courseName',
      width: 250,
      render: (courseName, record) => (
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
            {courseName || 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
            Code: {record.courseCode || 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            Credits: {record.creditHrs || 'N/A'}
          </div>
        </div>
      ),
      sorter: (a, b) => (a.courseName || '').localeCompare(b.courseName || '')
    },
    {
      title: 'Batch & Section',
      dataIndex: 'batchName',
      key: 'batchSection',
      width: 180,
      render: (batchName, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>
            {batchName || 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            Section: {record.sectionName || 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            Semester: {record.semester || 'N/A'}
          </div>
        </div>
      ),
      sorter: (a, b) => (a.batchName || '').localeCompare(b.batchName || '')
    },
    {
      title: 'Teaching Status',
      dataIndex: 'teachingStatus',
      key: 'teachingStatus',
      width: 130,
      render: (status, record) => getStatusTag(status, record.isAssigned),
      sorter: (a, b) => (a.teachingStatus || '').localeCompare(b.teachingStatus || '')
    },
    {
      title: 'Workload Impact',
      key: 'workload',
      width: 120,
      render: (_, record) => (
        record.isAssigned ? (
          <Tooltip title={`${record.creditHrs} credit hours`}>
            <Tag color={record.facultyData?.currentWorkload >= 20 ? 'red' : 'green'}>
              {record.creditHrs || 0} Cr.
            </Tag>
          </Tooltip>
        ) : (
          <Tag color="default">-</Tag>
        )
      ),
      sorter: (a, b) => (a.creditHrs || 0) - (b.creditHrs || 0)
    }
  ];

  const mobileColumns = [
    {
      title: 'Assignment Details',
      key: 'mobileView',
      render: (_, record) => (
        <Card 
          size="small" 
          style={{ marginBottom: 8, background: '#fafafa' }}
          bodyStyle={{ padding: '12px' }}
        >
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ color: record.isAssigned ? '#262626' : '#ff4d4f', fontSize: '16px' }}>
              {record.facultyName || 'Not Assigned'}
            </Text>
            {record.isAssigned && (
              <>
                <br />
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  {record.employeeId || 'N/A'} • {record.designation || 'N/A'}
                </Text>
              </>
            )}
          </div>
          
          <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
            <Col span={12}>
              <Text strong>Course:</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.courseName || 'N/A'}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Code: {record.courseCode || 'N/A'}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Credits:</Text>
              <br />
              <Text strong style={{ color: '#3f8600', fontSize: '14px' }}>
                {record.creditHrs || 0} Cr.
              </Text>
            </Col>
          </Row>
          
          <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
            <Col span={12}>
              <Text strong>Degree:</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.degreeLevel || 'N/A'}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Dept:</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.department || 'N/A'}
              </Text>
            </Col>
          </Row>

          <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Text strong>Batch:</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.batchName || 'N/A'}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Section:</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.sectionName || 'N/A'}
              </Text>
            </Col>
          </Row>

          <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Text strong>Status:</Text>
              <br />
              {getStatusTag(record.teachingStatus, record.isAssigned)}
            </Col>
            <Col span={12}>
              <Text strong>Semester:</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.semester || 'N/A'}
              </Text>
            </Col>
          </Row>
        </Card>
      ),
    },
  ];

  return (
    <div className="container mt-4" style={{ minHeight: '100vh' }}>
      <div className="d-flex justify-content-between align-items-center mb-5">
        <div>
          <h2 className="Faculty-Management-title" >
            Faculty Assignments List
          </h2>
        </div>
        <Button 
          icon={<SyncOutlined />} 
          onClick={refreshData}
          loading={loading}
          className="btn submit-btn"
        >
          Refresh Data
        </Button>
      </div>

      {/* Summary Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6} md={4}>
          <Card size="small" style={{ textAlign: 'center', background: '#f0f8ff' }}>
            <div style={{ padding: '12px' }}>
              <FileDoneOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Total Assignments</Text>
                <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                  {stats.total?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={4}>
          <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
            <div style={{ padding: '12px' }}>
              <UserOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Assigned</Text>
                <Text strong style={{ fontSize: '18px', color: '#52c41a' }}>
                  {stats.assigned?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={4}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
            <div style={{ padding: '12px' }}>
              <TeamOutlined style={{ fontSize: '24px', color: '#fa8c16', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Not Assigned</Text>
                <Text strong style={{ fontSize: '18px', color: '#fa8c16' }}>
                  {stats.unassigned?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={4}>
          <Card size="small" style={{ textAlign: 'center', background: '#e6f7ff' }}>
            <div style={{ padding: '12px' }}>
              <ClockCircleOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>In Progress</Text>
                <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                  {stats.inProgress?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={4}>
          <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
            <div style={{ padding: '12px' }}>
              <CheckCircleOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Completed</Text>
                <Text strong style={{ fontSize: '18px', color: '#52c41a' }}>
                  {stats.completed?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={4}>
          <Card size="small" style={{ textAlign: 'center', background: '#f9f0ff' }}>
            <div style={{ padding: '12px' }}>
              <BookOutlined style={{ fontSize: '24px', color: '#722ed1', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Departments</Text>
                <Text strong style={{ fontSize: '18px', color: '#722ed1' }}>
                  {stats.departments?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Filters Section */}
      <Card 
        className="mb-4"
        style={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        title={
          <Space>
            <FilterOutlined />
            <Text strong style={{ color: '#262626' }}>Search & Filters</Text>
          </Space>
        }
        extra={
          <Button 
            onClick={clearFilters} 
            size="small"
            icon={<ClearOutlined />}
            className="btn cancel-btn"
          >
            Clear Filters
          </Button>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Search</label>
              <Input
                placeholder="Search faculty, courses, batches..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                prefix={<SearchOutlined />}
                allowClear
                size="large"
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Teaching Status</label>
              <Select
                placeholder="Select Status"
                value={filters.teachingStatus}
                onChange={(value) => handleFilterChange('teachingStatus', value)}
                style={{ width: '100%' }}
                allowClear
                size="large"
              >
                <Option value="all">All Status</Option>
                <Option value="unassigned">Not Assigned</Option>
                <Option value="in-progress">In Progress</Option>
                <Option value="completed">Completed</Option>
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Degree Level</label>
              <Select
                placeholder="Select Degree Level"
                value={filters.degreeLevel}
                onChange={(value) => handleFilterChange('degreeLevel', value)}
                style={{ width: '100%' }}
                allowClear
                size="large"
                loading={degreeLevels.length === 0}
              >
                <Option value="all">All Degrees</Option>
                {degreeLevels.map(level => (
                  <Option key={level.value} value={level.value}>
                    {level.label}
                  </Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Department</label>
              <Select
                placeholder="Select Department"
                value={filters.department}
                onChange={(value) => handleFilterChange('department', value)}
                style={{ width: '100%' }}
                allowClear
                size="large"
                loading={departments.length === 0}
              >
                <Option value="all">All Departments</Option>
                {departments.map(dept => (
                  <Option key={dept.value} value={dept.value}>
                    {dept.label}
                  </Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Semester</label>
              <Select
                placeholder="Select Semester"
                value={filters.semester}
                onChange={(value) => handleFilterChange('semester', value)}
                style={{ width: '100%' }}
                allowClear
                size="large"
              >
                <Option value="all">All Semesters</Option>
                {getSemesterOptions()}
              </Select>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Assignments Table */}
      <Card 
        className="create-event-card"
        style={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        title={
          <Text strong style={{ color: '#262626', fontSize: '18px' }}>
            Faculty Assignments ({stats.total})
          </Text>
        }
      >
        {/* Results Count */}
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            Showing {filteredAssignments.length} of {assignments.length} assignments
            {filters.searchTerm && ` for "${filters.searchTerm}"`}
            {filters.teachingStatus !== 'all' && ` • Status: ${filters.teachingStatus}`}
            {filters.degreeLevel !== 'all' && ` • Degree: ${filters.degreeLevel}`}
            {filters.department !== 'all' && ` • Department: ${filters.department}`}
            {filters.semester !== 'all' && ` • Semester: ${filters.semester}`}
          </Text>
        </div>

        {/* Desktop Table */}
        <div className="d-none d-md-block">
          <Table
            columns={desktopColumns}
            dataSource={filteredAssignments}
            rowKey="key"
            loading={loading}
            scroll={{ x: 1000 }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} assignments`,
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
            onChange={(newPagination) => setPagination(newPagination)}
            size="middle"
            locale={{
              emptyText: (
                <Empty
                  description={
                    filters.searchTerm || filters.teachingStatus !== 'all' || filters.department !== 'all' 
                      ? "No assignments match your search criteria" 
                      : "No teacher assignments found"
                  }
                />
              )
            }}
          />
        </div>

        {/* Mobile View */}
        <div className="d-block d-md-none">
          <Table
            columns={mobileColumns}
            dataSource={filteredAssignments}
            rowKey="key"
            loading={loading}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              simple: true
            }}
            showHeader={false}
            locale={{
              emptyText: (
                <Empty
                  description={
                    filters.searchTerm || filters.teachingStatus !== 'all' || filters.department !== 'all' 
                      ? "No assignments match your search criteria" 
                      : "No teacher assignments found"
                  }
                />
              )
            }}
          />
        </div>
      </Card>
    </div>
  );
};

export default TeacherAssignmentsListView;