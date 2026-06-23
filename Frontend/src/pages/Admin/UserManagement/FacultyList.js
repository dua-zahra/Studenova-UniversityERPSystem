import React, { useEffect, useState } from "react";
import axios from "axios";
import API_URL from '../../../config';

import { 
  Card, Table, Button, Tag, Space, Input,Select, 
  Row, Col, Typography, Alert, Spin, Empty, Tooltip
} from 'antd';
import { 
  SearchOutlined, SyncOutlined, EditOutlined, 
  LockOutlined, UnlockOutlined, UserOutlined,
  MailOutlined, PhoneOutlined, CalendarOutlined,
  FilterOutlined, ClearOutlined, PlusOutlined,
  TeamOutlined, CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import { toast, ToastContainer } from 'react-toastify';
import Swal from 'sweetalert2';
import 'react-toastify/dist/ReactToastify.css';
import "../../../assets/style.css";
import AddProfessor from "./AddProfessor";
import EditProfessor from "./EditProfessor";

const { Title, Text } = Typography;
const { Search } = Input;

const FacultyList = () => {
  const [faculty, setFaculty] = useState([]);
  const [filteredFaculty, setFilteredFaculty] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    department: 'all',
    searchTerm: ''
  });
  const [departments, setDepartments] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentProfessorId, setCurrentProfessorId] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  const fetchFaculty = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/faculty`);
      const facultyData = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setFaculty(facultyData);
      setFilteredFaculty(facultyData);
      
      const uniqueDepartments = [...new Set(facultyData.map(f => f.department).filter(Boolean))];
      setDepartments(uniqueDepartments.map(dept => ({
        value: dept,
        label: dept
      })));

      setPagination(prev => ({
        ...prev,
        total: facultyData.length
      }));
    } catch (err) {
      console.error("Error fetching faculty list:", err);
      toast.error("Failed to fetch faculty data.");
    } finally {
      setLoading(false);
    }
  };

  const blockFaculty = async (id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "You are blocking this faculty member. They will not be active anymore.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, block it!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.put(`${API_URL}/faculty/block/${id}`, { isActive: false });
          toast.success("Professor blocked successfully!");
          fetchFaculty();
        } catch (err) {
          console.error("Blocking failed:", err);
          toast.error("Failed to block professor.");
        }
      }
    });
  };

  const unblockFaculty = async (id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "You are unblocking this faculty member. They will be active again.",
      icon: 'success',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, unblock it!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.put(`${API_URL}/faculty/unblock/${id}`, { isActive: true });
          toast.success("Professor unblocked successfully!");
          fetchFaculty();
        } catch (err) {
          console.error("Unblocking failed:", err);
          toast.error("Failed to unblock professor.");
        }
      }
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  useEffect(() => {
    let filtered = [...faculty];

    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(prof => {
        const fullName = `${prof.firstName || ""} ${prof.lastName || ""}`.toLowerCase();
        const email = (prof.universityEmail || "").toLowerCase();
        const department = (prof.department || "").toLowerCase();
        
        return fullName.includes(searchLower) || 
               email.includes(searchLower) ||
               department.includes(searchLower) ||
               (prof.mobile || "").includes(searchLower);
      });
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(prof => 
        filters.status === 'active' ? prof.isActive : !prof.isActive
      );
    }

    if (filters.department !== 'all') {
      filtered = filtered.filter(prof => 
        prof.department === filters.department
      );
    }

    setFilteredFaculty(filtered);
    setPagination(prev => ({
      ...prev,
      total: filtered.length,
      current: 1
    }));
  }, [filters, faculty]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      department: 'all',
      searchTerm: ''
    });
  };

  const refreshData = () => {
    fetchFaculty();
  };

  const toggleEditMode = (mode, id = null) => {
    setIsEditMode(mode);
    setCurrentProfessorId(id);
  };

  const getStatusTag = (isActive) => {
    return isActive ? (
      <Tag color="green" icon={<CheckCircleOutlined />}>Active</Tag>
    ) : (
      <Tag color="red" icon={<CloseCircleOutlined />}>Blocked</Tag>
    );
  };

  const stats = {
    total: faculty.length,
    active: faculty.filter(f => f.isActive).length,
    blocked: faculty.filter(f => !f.isActive).length,
    departments: new Set(faculty.map(f => f.department).filter(Boolean)).size
  };

  const desktopColumns = [
    {
      title: 'Profile',
      dataIndex: 'photo',
      key: 'photo',
      width: 80,
      render: (photo, record) => (
        <div style={{ textAlign: 'center' }}>
          <img
            src={`${API_URL}/uploads/${photo}`}
            alt="Profile"
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "50%",
              objectFit: "cover"
            }}
          />
        </div>
      )
    },
    {
      title: 'Faculty Information',
      dataIndex: 'firstName',
      key: 'facultyInfo',
      width: 200,
      fixed: 'left',
      render: (firstName, record) => (
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
            {firstName} {record.lastName}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            ID: {record.employeeId || 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.designation || 'N/A'}
          </div>
        </div>
      ),
      sorter: (a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 150,
      render: (department) => (
        <Tag color="blue" style={{ fontSize: '11px' }}>
          {department || 'N/A'}
        </Tag>
      ),
      sorter: (a, b) => (a.department || '').localeCompare(b.department || '')
    },
    {
      title: 'Contact Information',
      dataIndex: 'universityEmail',
      key: 'contact',
      width: 250,
      render: (email, record) => (
        <div>
          <div style={{ fontSize: '14px' }}>
            <MailOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            {email || 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
            <PhoneOutlined style={{ marginRight: 8, color: '#52c41a' }} />
            {record.mobile || 'N/A'}
          </div>
        </div>
      )
    },
    {
      title: 'Joining Date',
      dataIndex: 'joiningDate',
      key: 'joiningDate',
      width: 120,
      render: (date) => (
        <div>
          <CalendarOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
          {formatDate(date)}
        </div>
      ),
      sorter: (a, b) => new Date(a.joiningDate) - new Date(b.joiningDate)
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      width: 100,
      render: (isActive) => getStatusTag(isActive),
      sorter: (a, b) => a.isActive - b.isActive
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button 
              type="link" 
              icon={<EditOutlined />}
              onClick={() => toggleEditMode(true, record._id)}
              disabled={!record.isActive}
              style={{ color: record.isActive ? '#1890ff' : '#d9d9d9' }}
            />
          </Tooltip>
          {record.isActive ? (
            <Tooltip title="Block">
              <Button 
                type="link" 
                icon={<LockOutlined />}
                onClick={() => blockFaculty(record._id)}
                style={{ color: '#ff4d4f' }}
              />
            </Tooltip>
          ) : (
            <Tooltip title="Unblock">
              <Button 
                type="link" 
                icon={<UnlockOutlined />}
                onClick={() => unblockFaculty(record._id)}
                style={{ color: '#52c41a' }}
              />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  const mobileColumns = [
    {
      title: 'Faculty Details',
      key: 'mobileView',
      render: (_, record) => (
        <Card 
          size="small" 
          style={{ marginBottom: 8, background: '#fafafa' }}
          bodyStyle={{ padding: '12px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <img
              src={`${API_URL}/uploads/${record.photo}`}
              alt="Profile"
              style={{
                width: "50px",
                height: "50px",
                borderRadius: "50%",
                objectFit: "cover",
                marginRight: "12px"
              }}
            />
            <div>
              <Text strong style={{ fontSize: '16px' }}>
                {record.firstName} {record.lastName}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: '14px' }}>
                {record.employeeId || 'N/A'}
              </Text>
            </div>
          </div>
          
          <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
            <Col span={12}>
              <Text strong>Department:</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.department || 'N/A'}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Status:</Text>
              <br />
              {getStatusTag(record.isActive)}
            </Col>
          </Row>
          
          <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
            <Col span={24}>
              <Text strong>Email:</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.universityEmail || 'N/A'}
              </Text>
            </Col>
          </Row>

          <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Text strong>Mobile:</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.mobile || 'N/A'}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Joined:</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {formatDate(record.joiningDate)}
              </Text>
            </Col>
          </Row>

          <Space>
            <Button 
              size="small" 
              icon={<EditOutlined />}
              onClick={() => toggleEditMode(true, record._id)}
              disabled={!record.isActive}
            >
              Edit
            </Button>
            {record.isActive ? (
              <Button 
                size="small" 
                icon={<LockOutlined />}
                onClick={() => blockFaculty(record._id)}
                danger
              >
                Block
              </Button>
            ) : (
              <Button 
                size="small" 
                icon={<UnlockOutlined />}
                onClick={() => unblockFaculty(record._id)}
                type="primary"
              >
                Unblock
              </Button>
            )}
          </Space>
        </Card>
      ),
    },
  ];

  if (isEditMode) {
    return (
      <EditProfessor
        toggleEditMode={toggleEditMode}
        id={currentProfessorId}
      />
    );
  }

  if (showAddForm) {
    return (
      <AddProfessor
        onClose={() => {
          setShowAddForm(false);
          fetchFaculty();
        }}
      />
    );
  }

  return (
    <div className="container mt-4" style={{ minHeight: '100vh' }}>
      <ToastContainer />
      
      <div className="d-flex justify-content-between align-items-center mb-5">
        <div>
          <h2 className="Faculty-Management-title">
            Faculty Management
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
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f0f8ff' }}>
            <div style={{ padding: '12px' }}>
              <TeamOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Total Faculty</Text>
                <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                  {stats.total?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
            <div style={{ padding: '12px' }}>
              <CheckCircleOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Active</Text>
                <Text strong style={{ fontSize: '18px', color: '#52c41a' }}>
                  {stats.active?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff2f0' }}>
            <div style={{ padding: '12px' }}>
              <CloseCircleOutlined style={{ fontSize: '24px', color: '#ff4d4f', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Blocked</Text>
                <Text strong style={{ fontSize: '18px', color: '#ff4d4f' }}>
                  {stats.blocked?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f9f0ff' }}>
            <div style={{ padding: '12px' }}>
              <UserOutlined style={{ fontSize: '24px', color: '#722ed1', marginBottom: '8px' }} />
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
          <Space>
            <Button 
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowAddForm(true)}
              className="btn submit-btn"
            >
              Add New Faculty
            </Button>
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
          <Col xs={24} sm={12} md={8}>
            <div className="form-group">
              <label className="form-label">Search</label>
              <Input
                placeholder="Search by name, email, or department..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                prefix={<SearchOutlined />}
                allowClear
                size="large"
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
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
                <Option value="all">All Status</Option>
                <Option value="active">Active</Option>
                <Option value="blocked">Blocked</Option>
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="form-group">
              <label className="form-label">Department</label>
              <Select
                placeholder="Select Department"
                value={filters.department}
                onChange={(value) => handleFilterChange('department', value)}
                style={{ width: '100%' }}
                allowClear
                size="large"
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
        </Row>
      </Card>

      {/* Faculty Table */}
      <Card 
        className="create-event-card"
        style={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        title={
          <Text strong style={{ color: '#262626', fontSize: '18px' }}>
            Faculty Members ({stats.total})
          </Text>
        }
      >
        {/* Results Count */}
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            Showing {filteredFaculty.length} of {faculty.length} faculty members
            {filters.searchTerm && ` for "${filters.searchTerm}"`}
            {filters.status !== 'all' && ` • Status: ${filters.status}`}
            {filters.department !== 'all' && ` • Department: ${filters.department}`}
          </Text>
        </div>

        {/* Desktop Table */}
        <div className="d-none d-md-block">
          <Table
            columns={desktopColumns}
            dataSource={filteredFaculty}
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
                `${range[0]}-${range[1]} of ${total} faculty members`,
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
            onChange={(newPagination) => setPagination(newPagination)}
            size="middle"
            locale={{
              emptyText: (
                <Empty
                  description={
                    filters.searchTerm || filters.status !== 'all' || filters.department !== 'all' 
                      ? "No faculty members match your search criteria" 
                      : "No faculty members found"
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
            dataSource={filteredFaculty}
            rowKey="_id"
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
                    filters.searchTerm || filters.status !== 'all' || filters.department !== 'all' 
                      ? "No faculty members match your search criteria" 
                      : "No faculty members found"
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

export default FacultyList;