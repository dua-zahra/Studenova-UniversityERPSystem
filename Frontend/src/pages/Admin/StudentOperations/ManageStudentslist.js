import React, { useState, useEffect } from 'react';
import axios from 'axios';
import "../../../assets/style.css";

import { 
  Card, Table, Button, Tag, Space, Input, Select, DatePicker,
  Row, Col, Typography, Alert, Spin, message, Modal, List, Badge
} from 'antd';
import { 
  DownloadOutlined, FilePdfOutlined, SearchOutlined,
  DollarOutlined, UserOutlined, EyeOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ExclamationCircleOutlined,
  FilterOutlined, ClearOutlined, PauseOutlined, 
  DeleteOutlined, UnlockOutlined, RedoOutlined,
  BarChartOutlined, CalendarOutlined, TeamOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const StudentAcademicOperationsList = () => {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    studentId: '',
    studentName: '',
    operationType: '',
    status: '',
    dateRange: []
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [statistics, setStatistics] = useState({
    totalOperations: 0,
    freezeOperations: 0,
    unfreezeOperations: 0,
    dropOperations: 0,
    freshOperations: 0,
    pendingOperations: 0
  });

  useEffect(() => {
    fetchOperations();
    fetchStatistics();
  }, [filters, pagination.current, pagination.pageSize]);

  const fetchOperations = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      };

      if (filters.dateRange && filters.dateRange.length === 2) {
        params.startDate = filters.dateRange[0].format('YYYY-MM-DD');
        params.endDate = filters.dateRange[1].format('YYYY-MM-DD');
      }

      console.log('Fetching operations with params:', params);
      
      const response = await axios.get('http://localhost:65000/api/students/academic-operations', { params });
      
      console.log('Operations response:', response.data);
      
      if (response.data.success) {
        setOperations(response.data.data || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination?.totalRecords || 0
        }));
      } else {
        message.error('Failed to load academic operations');
        setOperations([]);
      }
    } catch (error) {
      console.error('Error fetching operations:', error);
      message.error('Failed to load academic operations');
      setOperations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const params = {};
      
      if (filters.dateRange && filters.dateRange.length === 2) {
        params.startDate = filters.dateRange[0].format('YYYY-MM-DD');
        params.endDate = filters.dateRange[1].format('YYYY-MM-DD');
      }

      const response = await axios.get('http://localhost:65000/api/students/academic-operations/statistics', { params });
      
      if (response.data.success) {
        setStatistics(response.data.data.summary || {
          totalOperations: 0,
          freezeOperations: 0,
          unfreezeOperations: 0,
          dropOperations: 0,
          freshOperations: 0,
          pendingOperations: 0
        });
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const fetchOperationDetails = async (operationId) => {
    try {
      const response = await axios.get(`http://localhost:65000/api/students/academic-operations/${operationId}/details`);
      if (response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching operation details:', error);
      message.error('Failed to load operation details');
      return null;
    }
  };

  const showDetailsModal = async (operation) => {
    setSelectedOperation(operation);
    setDetailModalVisible(true);
    
    // Fetch detailed operation data
    const operationDetails = await fetchOperationDetails(operation._id);
    if (operationDetails) {
      setSelectedOperation(prev => ({
        ...prev,
        details: operationDetails
      }));
    }
  };

  const handleTableChange = (newPagination, filters, sorter) => {
    setPagination(newPagination);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      studentId: '',
      studentName: '',
      operationType: '',
      status: '',
      dateRange: []
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const exportToCSV = () => {
    try {
      if (operations.length === 0) {
        message.warning('No data to export');
        return;
      }

      const headers = ['Student ID', 'Student Name', 'Batch', 'Department', 'Operation Type', 'Course', 'Semester', 'Date', 'Status', 'Reason'];
      const csvData = operations.map(op => [
        op.studentId || 'N/A',
        op.studentName || 'N/A',
        op.batch || 'N/A',
        op.department || 'N/A',
        getOperationTypeLabel(op.operationType),
        op.courseCode || 'N/A',
        op.semesterNumber || 'N/A',
        op.operationDate ? new Date(op.operationDate).toLocaleDateString() : 'N/A',
        op.status || 'N/A',
        op.reason || 'N/A'
      ]);

      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `academic-operations-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('Data exported successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      message.error('Failed to export data');
    }
  };

  const getOperationTypeColor = (type) => {
    const colors = {
      'freeze': 'orange',
      'unfreeze': 'green',
      'drop': 'red',
      'fresh': 'blue'
    };
    return colors[type] || 'default';
  };

  const getOperationTypeIcon = (type) => {
    const icons = {
      'freeze': <PauseOutlined />,
      'unfreeze': <UnlockOutlined />,
      'drop': <DeleteOutlined />,
      'fresh': <RedoOutlined />
    };
    return icons[type] || <ExclamationCircleOutlined />;
  };

  const getOperationTypeLabel = (type) => {
    const labels = {
      'freeze': 'Freeze Semester',
      'unfreeze': 'Unfreeze Semester',
      'drop': 'Drop Course',
      'fresh': 'Fresh Course Enrollment'
    };
    return labels[type] || type;
  };

  const getStatusColor = (status) => {
    const colors = {
      'completed': 'green',
      'pending': 'orange',
      'failed': 'red',
      'cancelled': 'default'
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'completed': <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      'pending': <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
      'failed': <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
      'cancelled': <CloseCircleOutlined style={{ color: '#d9d9d9' }} />
    };
    return icons[status] || <ExclamationCircleOutlined />;
  };

  const desktopColumns = [
    {
      title: 'Student ID',
      dataIndex: 'studentId',
      key: 'studentId',
      sorter: true,
      width: 120,
      fixed: 'left',
    },
    {
      title: 'Student Name',
      dataIndex: 'studentName',
      key: 'studentName',
      sorter: true,
      width: 150,
      fixed: 'left',
    },
    {
      title: 'Batch',
      dataIndex: 'batch',
      key: 'batch',
      width: 120,
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 150,
    },
    {
      title: 'Current Semester',
      dataIndex: 'currentSemester',
      key: 'currentSemester',
      render: (semester) => <Tag color="#937fa3">Sem {semester}</Tag>,
      width: 120,
    },
    {
      title: 'Operation Type',
      dataIndex: 'operationType',
      key: 'operationType',
      render: (type) => (
        <Tag color={getOperationTypeColor(type)} icon={getOperationTypeIcon(type)}>
          {getOperationTypeLabel(type)}
        </Tag>
      ),
      width: 140,
      filters: [
        { text: 'Freeze Semester', value: 'freeze' },
        { text: 'Unfreeze Semester', value: 'unfreeze' },
        { text: 'Drop Course', value: 'drop' },
        { text: 'Fresh Enrollment', value: 'fresh' }
      ],
      onFilter: (value, record) => record.operationType === value,
    },
    {
      title: 'Details',
      key: 'details',
      width: 120,
      render: (_, record) => (
        <Space>
          {record.courseCode && (
            <Tag color="blue">{record.courseCode}</Tag>
          )}
          {record.semesterNumber && (
            <Tag color="purple">Sem {record.semesterNumber}</Tag>
          )}
          {record.operationType === 'fresh' && record.isCrossBatch && (
            <Tag color="cyan">Cross-Batch</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Operation Date',
      dataIndex: 'operationDate',
      key: 'operationDate',
      render: (date) => date ? new Date(date).toLocaleDateString() : 'N/A',
      width: 120,
      sorter: (a, b) => new Date(a.operationDate) - new Date(b.operationDate),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status?.toUpperCase()}
        </Tag>
      ),
      width: 100,
      filters: [
        { text: 'Completed', value: 'completed' },
        { text: 'Pending', value: 'pending' },
        { text: 'Failed', value: 'failed' }
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />}
          onClick={() => showDetailsModal(record)}
          style={{ padding: '4px 8px' }}
        >
          View
        </Button>
      ),
    }
  ];

  // Mobile columns
  const mobileColumns = [
    {
      title: 'Operation Details',
      key: 'mobileView',
      render: (_, record) => (
        <Card 
          size="small" 
          style={{ marginBottom: 8, background: '#fafafa' }}
          bodyStyle={{ padding: '12px' }}
        >
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ color: '#262626', fontSize: '16px' }}>
              {record.studentName}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: '14px' }}>
              {record.studentId}
            </Text>
          </div>
          
          <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
            <Col span={12}>
              <Text strong>Batch:</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.batch}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Semester:</Text>
              <br />
              <Tag color="#937fa3" style={{ margin: 0 }}>Sem {record.currentSemester}</Tag>
            </Col>
          </Row>
          
          <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
            <Col span={12}>
              <Text strong>Operation:</Text>
              <br />
              <Tag 
                color={getOperationTypeColor(record.operationType)} 
                icon={getOperationTypeIcon(record.operationType)}
                style={{ margin: 0 }}
              >
                {getOperationTypeLabel(record.operationType)}
              </Tag>
            </Col>
            <Col span={12}>
              <Text strong>Status:</Text>
              <br />
              <Tag color={getStatusColor(record.status)} style={{ margin: 0 }}>
                {record.status?.toUpperCase()}
              </Tag>
            </Col>
          </Row>

          {record.courseCode && (
            <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
              <Col span={24}>
                <Text strong>Course:</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {record.courseCode}
                </Text>
              </Col>
            </Row>
          )}

          {record.operationType === 'fresh' && record.isCrossBatch && (
            <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
              <Col span={24}>
                <Text strong>Enrollment Type:</Text>
                <br />
                <Tag color="cyan" style={{ margin: 0 }}>Cross-Batch</Tag>
              </Col>
            </Row>
          )}

          <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
            <Col span={24}>
              <Text strong>Date:</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.operationDate ? new Date(record.operationDate).toLocaleDateString() : 'N/A'}
              </Text>
            </Col>
          </Row>
          
          <Button 
            type="primary" 
            size="small"
            icon={<EyeOutlined />}
            onClick={() => showDetailsModal(record)}
            className="btn submit-btn"
            style={{ width: '100%' }}
          >
            View Details
          </Button>
        </Card>
      ),
    },
  ];

  return (
    <div className="student-academic container mt-5" style={{ minHeight: '100vh' }}>
      <div className="d-flex justify-content-between align-items-center mb-5">
        <div>
          <h2 className="student-academic-title" style={{ margin: 0, color: '#262626' }}>
            Student Academic Operations
          </h2>
          <Text type="secondary">Manage and track all academic operations</Text>
        </div>
        <Button 
          icon={<DownloadOutlined />}
          onClick={exportToCSV}
          className="btn submit-btn"
          disabled={operations.length === 0}
        >
          Export CSV
        </Button>
      </div>

      {/* Statistics Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f0f8ff' }}>
            <div style={{ padding: '12px' }}>
              <BarChartOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Total Operations</Text>
                <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                  {statistics.totalOperations?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
            <div style={{ padding: '12px' }}>
              <PauseOutlined style={{ fontSize: '24px', color: '#fa8c16', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Freeze Operations</Text>
                <Text strong style={{ fontSize: '18px', color: '#fa8c16' }}>
                  {statistics.freezeOperations?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
            <div style={{ padding: '12px' }}>
              <UnlockOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Unfreeze Operations</Text>
                <Text strong style={{ fontSize: '18px', color: '#52c41a' }}>
                  {statistics.unfreezeOperations?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff2f0' }}>
            <div style={{ padding: '12px' }}>
              <DeleteOutlined style={{ fontSize: '24px', color: '#ff4d4f', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Drop Operations</Text>
                <Text strong style={{ fontSize: '18px', color: '#ff4d4f' }}>
                  {statistics.dropOperations?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f0f6ff' }}>
            <div style={{ padding: '12px' }}>
              <RedoOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Fresh Enrollments</Text>
                <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                  {statistics.freshOperations?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
            <div style={{ padding: '12px' }}>
              <ExclamationCircleOutlined style={{ fontSize: '24px', color: '#faad14', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Pending Operations</Text>
                <Text strong style={{ fontSize: '18px', color: '#faad14' }}>
                  {statistics.pendingOperations?.toLocaleString()}
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
          <Space>
            <Button 
              onClick={clearFilters} 
              size="small"
              icon={<ClearOutlined />}
              className="btn cancel-btn"
            >
              Clear Filters
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Student ID</label>
              <Input
                placeholder="Enter Student ID"
                value={filters.studentId}
                onChange={(e) => handleFilterChange('studentId', e.target.value)}
                prefix={<UserOutlined />}
                allowClear
                size="large"
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Student Name</label>
              <Input
                placeholder="Enter Student Name"
                value={filters.studentName}
                onChange={(e) => handleFilterChange('studentName', e.target.value)}
                prefix={<SearchOutlined />}
                allowClear
                size="large"
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Operation Type</label>
              <Select
                placeholder="Select Operation Type"
                value={filters.operationType}
                onChange={(value) => handleFilterChange('operationType', value)}
                style={{ width: '100%' }}
                allowClear
                size="large"
              >
                <Option value="freeze">Freeze Semester</Option>
                <Option value="unfreeze">Unfreeze Semester</Option>
                <Option value="drop">Drop Course</Option>
                <Option value="fresh">Fresh Enrollment</Option>
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Status</label>
              <Select
                placeholder="Select Status"
                value={filters.status}
                onChange={(value) => handleFilterChange('status', value)}
                style={{ width: '100%' }}
                allowClear
                size="large"
              >
                <Option value="completed">Completed</Option>
                <Option value="pending">Pending</Option>
                <Option value="failed">Failed</Option>
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={24} md={12}>
            <div className="form-group">
              <label className="form-label">Date Range</label>
              <RangePicker
                style={{ width: '100%' }}
                value={filters.dateRange}
                onChange={(dates) => handleFilterChange('dateRange', dates)}
                format="YYYY-MM-DD"
                size="large"
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* Operations Table */}
      <Card 
        className="create-event-card"
        style={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        title={
          <Text strong style={{ color: '#262626', fontSize: '18px' }}>
            Academic Operations ({pagination.total})
          </Text>
        }
      >
        {operations.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <ExclamationCircleOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
            <div>
              <Text type="secondary" style={{ fontSize: '16px' }}>
                No academic operations found
              </Text>
              <br />
              <Text type="secondary">
                Try adjusting your filters or check if students have academic operations data.
              </Text>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="d-none d-md-block">
              <Table
                columns={desktopColumns}
                dataSource={operations}
                rowKey="_id"
                loading={loading}
                scroll={{ x: 1000 }}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => 
                    `${range[0]}-${range[1]} of ${total} operations`,
                  pageSizeOptions: ['10', '20', '50', '100'],
                }}
                onChange={handleTableChange}
                size="middle"
              />
            </div>

            {/* Mobile View */}
            <div className="d-block d-md-none">
              <Table
                columns={mobileColumns}
                dataSource={operations}
                rowKey="_id"
                loading={loading}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  simple: true
                }}
                showHeader={false}
              />
            </div>
          </>
        )}
      </Card>

      {/* Operation Details Modal */}
      <Modal
        title={
          <Text strong style={{ fontSize: '18px', color: '#262626' }}>
            Operation Details - {selectedOperation?.studentName} ({selectedOperation?.studentId})
          </Text>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button 
            key="close" 
            onClick={() => setDetailModalVisible(false)}
            className="btn cancel-btn"
          >
            Close
          </Button>
        ]}
        width={700}
        style={{ top: 20 }}
      >
        {selectedOperation ? (
          <div>
            {/* Student Info */}
            <Card 
              size="small" 
              style={{ marginBottom: 16, background: '#fafafa' }}
              bodyStyle={{ padding: '16px' }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <Text strong>Student:</Text>
                  <br />
                  <Text style={{ color: '#262626' }}>{selectedOperation.studentName}</Text>
                </Col>
                <Col xs={24} sm={8}>
                  <Text strong>Batch:</Text>
                  <br />
                  <Text style={{ color: '#262626' }}>{selectedOperation.batch}</Text>
                </Col>
                <Col xs={24} sm={8}>
                  <Text strong>Department:</Text>
                  <br />
                  <Text style={{ color: '#262626' }}>{selectedOperation.department}</Text>
                </Col>
                <Col xs={24} sm={8}>
                  <Text strong>Current Semester:</Text>
                  <br />
                  <Tag color="#937fa3">Sem {selectedOperation.currentSemester}</Tag>
                </Col>
                <Col xs={24} sm={8}>
                  <Text strong>Operation Type:</Text>
                  <br />
                  <Tag 
                    color={getOperationTypeColor(selectedOperation.operationType)}
                    icon={getOperationTypeIcon(selectedOperation.operationType)}
                  >
                    {getOperationTypeLabel(selectedOperation.operationType)}
                  </Tag>
                </Col>
                <Col xs={24} sm={8}>
                  <Text strong>Status:</Text>
                  <br />
                  <Tag color={getStatusColor(selectedOperation.status)}>
                    {selectedOperation.status?.toUpperCase()}
                  </Tag>
                </Col>
              </Row>
            </Card>

            {/* Operation Details */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: '16px', marginBottom: '12px', display: 'block' }}>
                Operation Information
              </Text>
              
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Text strong>Operation Date:</Text>
                  <br />
                  <Text style={{ color: '#262626' }}>
                    {selectedOperation.operationDate ? new Date(selectedOperation.operationDate).toLocaleString() : 'N/A'}
                  </Text>
                </Col>
                
                {selectedOperation.courseCode && (
                  <Col xs={24} sm={12}>
                    <Text strong>Course Code:</Text>
                    <br />
                    <Tag color="blue">{selectedOperation.courseCode}</Tag>
                  </Col>
                )}
                
                {selectedOperation.semesterNumber && (
                  <Col xs={24} sm={12}>
                    <Text strong>Semester:</Text>
                    <br />
                    <Tag color="purple">Sem {selectedOperation.semesterNumber}</Tag>
                  </Col>
                )}
                
                {/* Fresh Enrollment Specific Details */}
                {selectedOperation.operationType === 'fresh' && (
                  <>
                    <Col xs={24} sm={12}>
                      <Text strong>Enrollment Type:</Text>
                      <br />
                      <Space>
                        <Tag color="blue">Fresh Course Enrollment</Tag>
                        {selectedOperation.isCrossBatch && (
                          <Tag color="cyan">Cross-Batch</Tag>
                        )}
                      </Space>
                    </Col>
                    {selectedOperation.freshEnrollmentReason && (
                      <Col xs={24}>
                        <Text strong>Enrollment Reason:</Text>
                        <br />
                        <Text style={{ color: '#262626', fontStyle: 'italic' }}>
                          "{selectedOperation.freshEnrollmentReason}"
                        </Text>
                      </Col>
                    )}
                  </>
                )}
                
                {selectedOperation.reason && (
                  <Col xs={24}>
                    <Text strong>Reason:</Text>
                    <br />
                    <Text style={{ color: '#262626', fontStyle: 'italic' }}>
                      "{selectedOperation.reason}"
                    </Text>
                  </Col>
                )}
              </Row>
            </Card>

            {/* Additional Details from API */}
            {selectedOperation.details && (
              <>
                {/* Batch Information */}
                {selectedOperation.details.batchInfo && (
                  <Card size="small" style={{ marginBottom: 16 }}>
                    <Text strong style={{ fontSize: '16px', marginBottom: '12px', display: 'block' }}>
                      Batch Information
                    </Text>
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={12}>
                        <Text strong>Batch Name:</Text>
                        <br />
                        <Text>{selectedOperation.details.batchInfo.batchName}</Text>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Text strong>Current Semester:</Text>
                        <br />
                        <Text>Sem {selectedOperation.details.batchInfo.currentSemester}</Text>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Text strong>Total Semesters:</Text>
                        <br />
                        <Text>{selectedOperation.details.batchInfo.totalSemesters}</Text>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Text strong>Department:</Text>
                        <br />
                        <Text>{selectedOperation.details.batchInfo.departmentName}</Text>
                      </Col>
                    </Row>
                  </Card>
                )}

                {/* Status History */}
                {selectedOperation.details.statusHistory && (
                  <Card size="small">
                    <Text strong style={{ fontSize: '16px', marginBottom: '12px', display: 'block' }}>
                      Status History
                    </Text>
                    <List
                      size="small"
                      dataSource={selectedOperation.details.statusHistory}
                      renderItem={(item, index) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={getStatusIcon(item.status)}
                            title={
                              <Space>
                                <Text strong>{item.status.toUpperCase()}</Text>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                  {new Date(item.timestamp).toLocaleString()}
                                </Text>
                              </Space>
                            }
                            description={item.note}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                )}
              </>
            )}

            {!selectedOperation.details && (
              <Alert
                message="No Additional Details"
                description="No additional operation details available from the API."
                type="info"
                showIcon
              />
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin tip="Loading operation details..." />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StudentAcademicOperationsList;