import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../../../config';

import { 
  Card, Table, Button, Tag, Space, Input, Select, DatePicker,
  Row, Col, Typography, Alert, Spin, message, Modal, List, Badge,
  Tooltip, Statistic
} from 'antd';
import { 
  DownloadOutlined, FilePdfOutlined, SearchOutlined,
  DollarOutlined, UserOutlined, EyeOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ExclamationCircleOutlined,
  FilterOutlined, ClearOutlined, BookOutlined,
  ReloadOutlined, CreditCardOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const RepeatFreshCourseFeeList = () => {
  const [courseFees, setCourseFees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState({});
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedCourseFee, setSelectedCourseFee] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [filters, setFilters] = useState({
    studentId: '',
    studentName: '',
    paymentStatus: '',
    courseType: '',
    courseName: '',
    dateRange: []
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [paymentData, setPaymentData] = useState({
    amountPaid: '',
    paymentMethod: 'cash',
    transactionId: ''
  });

  useEffect(() => {
    fetchCourseFees();
  }, [filters, pagination.current, pagination.pageSize]);

  const fetchCourseFees = async () => {
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

      const response = await axios.get(`${API_URL}/repeat-fresh-course-fees`, { params });
      
      if (response.data.success) {
        setCourseFees(response.data.data);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.totalRecords
        }));
      }
    } catch (error) {
      console.error('Error fetching course fees:', error);
      message.error('Failed to load course fees');
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async (courseFeeId, studentId) => {
    setDownloading(prev => ({ ...prev, [courseFeeId]: true }));
    
    try {
      const response = await axios.get(
        `${API_URL}/repeat-fresh-course-fees/${courseFeeId}/invoice`,
        { 
          responseType: 'blob',
          headers: {
            'Accept': 'application/pdf'
          }
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `course-fee-${studentId}-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      message.success('Invoice downloaded successfully!');
      
    } catch (error) {
      console.error('Error downloading invoice:', error);
      const errorMessage = error.response?.data?.message || error.message;
      
      if (errorMessage.includes('paid') || errorMessage.includes('already paid')) {
        message.error('Cannot download invoice for paid course fee.');
      } else {
        message.error('Failed to download invoice: ' + errorMessage);
      }
    } finally {
      setDownloading(prev => ({ ...prev, [courseFeeId]: false }));
    }
  };

  const showPaymentModal = (courseFee) => {
    setSelectedCourseFee(courseFee);
    setPaymentData({
      amountPaid: (courseFee.amount - courseFee.amountPaid).toString(),
      paymentMethod: 'cash',
      transactionId: ''
    });
    setPaymentModalVisible(true);
  };

  const handlePayment = async () => {
    if (!paymentData.amountPaid || paymentData.amountPaid <= 0) {
      message.error('Please enter a valid payment amount');
      return;
    }

    setPaymentLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/repeat-fresh-course-fees/${selectedCourseFee._id}/payment`,
        paymentData
      );

      if (response.data.success) {
        message.success('Payment recorded successfully!');
        setPaymentModalVisible(false);
        setPaymentData({
          amountPaid: '',
          paymentMethod: 'cash',
          transactionId: ''
        });
        fetchCourseFees(); t
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      message.error(error.response?.data?.message || 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
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
      paymentStatus: '',
      courseType: '',
      courseName: '',
      dateRange: []
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const getPaymentStatusColor = (status) => {
    const colors = {
      'paid': 'green',
      'pending': 'orange',
      'overdue': 'red',
      'cancelled': 'default'
    };
    return colors[status] || 'default';
  };

  const getCourseTypeColor = (type) => {
    const colors = {
      'repeat': 'volcano',
      'fresh': 'green'
    };
    return colors[type] || 'blue';
  };

  const getCourseTypeLabel = (type) => {
    const labels = {
      'repeat': 'Repeat Course',
      'fresh': 'Fresh Course'
    };
    return labels[type] || type;
  };

  const getStatusIcon = (status) => {
    const icons = {
      'paid': <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      'pending': <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
      'overdue': <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
      'cancelled': <CloseCircleOutlined style={{ color: '#d9d9d9' }} />
    };
    return icons[status] || <ExclamationCircleOutlined />;
  };

  const desktopColumns = [
    {
      title: 'Invoice #',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      width: 140,
      fixed: 'left',
      render: (invoiceNumber) => (
        <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {invoiceNumber}
        </Tag>
      )
    },
    {
      title: 'Student ID',
      dataIndex: 'studentId',
      key: 'studentId',
      width: 120,
      sorter: true,
    },
    {
      title: 'Student Name',
      dataIndex: 'studentName',
      key: 'studentName',
      width: 150,
      sorter: true,
    },
    {
      title: 'Course Type',
      dataIndex: 'courseType',
      key: 'courseType',
      width: 120,
      render: (type) => (
        <Tag color={getCourseTypeColor(type)}>
          {getCourseTypeLabel(type)}
        </Tag>
      ),
      filters: [
        { text: 'Repeat Course', value: 'repeat' },
        { text: 'Fresh Course', value: 'fresh' },
      ],
      onFilter: (value, record) => record.courseType === value,
    },
    {
      title: 'Course Name',
      dataIndex: 'courseName',
      key: 'courseName',
      width: 150,
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          {record.courseCode && (
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                ({record.courseCode})
              </Text>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => (
        <Text strong style={{ color: '#3f8600' }}>
          Rs. {amount?.toLocaleString()}
        </Text>
      ),
      align: 'right',
      width: 120,
      sorter: (a, b) => a.amount - b.amount,
    },
    {
      title: 'Paid',
      dataIndex: 'amountPaid',
      key: 'amountPaid',
      render: (amount) => `Rs. ${amount?.toLocaleString()}`,
      align: 'right',
      width: 120,
      sorter: (a, b) => a.amountPaid - b.amountPaid,
    },
    {
      title: 'Balance',
      key: 'balance',
      render: (_, record) => {
        const balance = record.amount - record.amountPaid;
        return (
          <Text type={balance > 0 ? "danger" : "success"}>
            Rs. {balance?.toLocaleString()}
          </Text>
        );
      },
      align: 'right',
      width: 120,
      sorter: (a, b) => (a.amount - a.amountPaid) - (b.amount - b.amountPaid),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date) => new Date(date).toLocaleDateString(),
      width: 120,
      sorter: (a, b) => new Date(a.dueDate) - new Date(b.dueDate),
    },
    {
      title: 'Status',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      render: (status) => (
        <Tag color={getPaymentStatusColor(status)}>
          {status?.toUpperCase()}
        </Tag>
      ),
      width: 100,
      filters: [
        { text: 'Pending', value: 'pending' },
        { text: 'Paid', value: 'paid' },
        { text: 'Overdue', value: 'overdue' },
      ],
      onFilter: (value, record) => record.paymentStatus === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Download Invoice">
            <Button 
              size="small"
              icon={<DownloadOutlined />}
              loading={downloading[record._id]}
              onClick={() => downloadInvoice(record._id, record.studentId)}
              disabled={record.paymentStatus === 'paid'}
              className="btn submit-btn"
            >
              Invoice
            </Button>
          </Tooltip>
          
          {record.paymentStatus !== 'paid' && (
            <Tooltip title="Record Payment">
              <Button 
                size="small"
                icon={<CreditCardOutlined />}
                onClick={() => showPaymentModal(record)}
                className="btn submit-btn"
              >
                Pay
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    }
  ];

  const mobileColumns = [
    {
      title: 'Course Fee Details',
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
            <br />
            <Tag color={getCourseTypeColor(record.courseType)} style={{ marginTop: 4 }}>
              {getCourseTypeLabel(record.courseType)}
            </Tag>
          </div>
          
          <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
            <Col span={12}>
              <Text strong>Course:</Text>
              <br />
              <Text style={{ fontSize: '14px' }}>{record.courseName}</Text>
              {record.courseCode && (
                <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                  ({record.courseCode})
                </Text>
              )}
            </Col>
            <Col span={12}>
              <Text strong>Due Date:</Text>
              <br />
              <Text style={{ fontSize: '14px' }}>
                {new Date(record.dueDate).toLocaleDateString()}
              </Text>
            </Col>
          </Row>
          
          <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
            <Col span={8}>
              <Text strong>Total:</Text>
              <br />
              <Text strong style={{ color: '#3f8600', fontSize: '14px' }}>
                Rs. {record.amount?.toLocaleString()}
              </Text>
            </Col>
            <Col span={8}>
              <Text strong>Status:</Text>
              <br />
              <Tag color={getPaymentStatusColor(record.paymentStatus)} style={{ margin: 0 }}>
                {record.paymentStatus?.toUpperCase()}
              </Tag>
            </Col>
            <Col span={8}>
              <Text strong>Balance:</Text>
              <br />
              <Text type={record.amount - record.amountPaid > 0 ? "danger" : "success"} style={{ fontSize: '14px' }}>
                Rs. {(record.amount - record.amountPaid)?.toLocaleString()}
              </Text>
            </Col>
          </Row>
          
          <Space size="small" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button 
              size="small"
              icon={<DownloadOutlined />}
              loading={downloading[record._id]}
              onClick={() => downloadInvoice(record._id, record.studentId)}
              disabled={record.paymentStatus === 'paid'}
              className="btn submit-btn"
            >
              Invoice
            </Button>
            
            {record.paymentStatus !== 'paid' && (
              <Button 
                size="small"
                icon={<CreditCardOutlined />}
                onClick={() => showPaymentModal(record)}
                className="btn submit-btn"
              >
                Pay
              </Button>
            )}
          </Space>
        </Card>
      ),
    },
  ];

  const totalCourseFees = pagination.total;
  const totalRevenue = courseFees.reduce((sum, fee) => sum + (fee.amountPaid || 0), 0);
  const pendingRevenue = courseFees.reduce((sum, fee) => sum + ((fee.amount || 0) - (fee.amountPaid || 0)), 0);
  const repeatCourses = courseFees.filter(fee => fee.courseType === 'repeat').length;
  const freshCourses = courseFees.filter(fee => fee.courseType === 'fresh').length;

  return (
    <div className="container mt-5" style={{ minHeight: '100vh' }}>
      <div className="d-flex justify-content-between align-items-center mb-5">
        <div>
          <h2 className="create-expense-title" style={{ margin: 0, color: '#262626' }}>
            Repeat/Fresh Course Fee Management
          </h2>
          <Text type="secondary">
            Manage course fees for repeat and fresh courses
          </Text>
        </div>
        <Button 
          icon={<ReloadOutlined />}
          onClick={fetchCourseFees}
          loading={loading}
          className="btn submit-btn"
        >
          Refresh
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f0f8ff' }}>
            <Statistic
              title="Total Course Fees"
              value={totalCourseFees}
              prefix={<BookOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff0f6' }}>
            <Statistic
              title="Repeat Courses"
              value={repeatCourses}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
            <Statistic
              title="Fresh Courses"
              value={freshCourses}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
            <Statistic
              title="Total Revenue"
              value={totalRevenue}
              prefix="Rs."
              valueStyle={{ color: '#fa8c16' }}
              formatter={value => value.toLocaleString()}
            />
          </Card>
        </Col>
      </Row>

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
              <label className="form-label">Course Type</label>
              <Select
                placeholder="Select Course Type"
                value={filters.courseType}
                onChange={(value) => handleFilterChange('courseType', value)}
                style={{ width: '100%' }}
                allowClear
                size="large"
              >
                <Option value="repeat">Repeat Course</Option>
                <Option value="fresh">Fresh Course</Option>
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Payment Status</label>
              <Select
                placeholder="Select Status"
                value={filters.paymentStatus}
                onChange={(value) => handleFilterChange('paymentStatus', value)}
                style={{ width: '100%' }}
                allowClear
                size="large"
              >
                <Option value="pending">Pending</Option>
                <Option value="paid">Paid</Option>
                <Option value="overdue">Overdue</Option>
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Course Name</label>
              <Input
                placeholder="Enter Course Name"
                value={filters.courseName}
                onChange={(e) => handleFilterChange('courseName', e.target.value)}
                allowClear
                size="large"
              />
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

      <Card 
        className="create-event-card"
        style={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        title={
          <Text strong style={{ color: '#262626', fontSize: '18px' }}>
            Course Fees ({totalCourseFees})
          </Text>
        }
      >
        <div className="d-none d-md-block">
          <Table
            columns={desktopColumns}
            dataSource={courseFees.map(fee => ({ ...fee, key: fee._id }))}
            rowKey="_id"
            loading={loading}
            scroll={{ x: 1200 }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} course fees`,
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
            onChange={handleTableChange}
            size="middle"
          />
        </div>

        <div className="d-block d-md-none">
          <Table
            columns={mobileColumns}
            dataSource={courseFees.map(fee => ({ ...fee, key: fee._id }))}
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
      </Card>

      <Modal
        title={
          <Text strong style={{ fontSize: '18px', color: '#262626' }}>
            <CreditCardOutlined /> Record Payment
          </Text>
        }
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => setPaymentModalVisible(false)}
            className="btn cancel-btn"
          >
            Cancel
          </Button>,
          <Button 
            key="submit" 
            type="primary"
            loading={paymentLoading}
            onClick={handlePayment}
            className="btn submit-btn"
          >
            Record Payment
          </Button>
        ]}
        width={500}
      >
        {selectedCourseFee && (
          <div>
            <Alert
              message="Payment Details"
              description={
                <div>
                  <Text strong>Student: </Text>{selectedCourseFee.studentName} ({selectedCourseFee.studentId})
                  <br />
                  <Text strong>Course: </Text>{selectedCourseFee.courseName}
                  <br />
                  <Text strong>Course Type: </Text>
                  <Tag color={getCourseTypeColor(selectedCourseFee.courseType)}>
                    {getCourseTypeLabel(selectedCourseFee.courseType)}
                  </Tag>
                  <br />
                  <Text strong>Total Amount: </Text>Rs. {selectedCourseFee.amount?.toLocaleString()}
                  <br />
                  <Text strong>Already Paid: </Text>Rs. {selectedCourseFee.amountPaid?.toLocaleString()}
                  <br />
                  <Text strong type="danger">Remaining: </Text>
                  Rs. {(selectedCourseFee.amount - selectedCourseFee.amountPaid)?.toLocaleString()}
                </div>
              }
              type="info"
              style={{ marginBottom: 16 }}
            />

            <Row gutter={16}>
              <Col span={24}>
                <div className="form-group">
                  <label className="form-label">Amount to Pay (Rs.)</label>
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="Enter amount"
                    value={paymentData.amountPaid}
                    onChange={(value) => setPaymentData(prev => ({ ...prev, amountPaid: value }))}
                    min={0}
                    max={selectedCourseFee.amount - selectedCourseFee.amountPaid}
                    size="large"
                  />
                </div>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <Select
                    style={{ width: '100%' }}
                    value={paymentData.paymentMethod}
                    onChange={(value) => setPaymentData(prev => ({ ...prev, paymentMethod: value }))}
                    size="large"
                  >
                    <Option value="cash">Cash</Option>
                    <Option value="card">Card</Option>
                    <Option value="bank_transfer">Bank Transfer</Option>
                    <Option value="online">Online Payment</Option>
                  </Select>
                </div>
              </Col>
              <Col span={12}>
                <div className="form-group">
                  <label className="form-label">Transaction ID (Optional)</label>
                  <Input
                    placeholder="Enter transaction ID"
                    value={paymentData.transactionId}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, transactionId: e.target.value }))}
                    size="large"
                  />
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RepeatFreshCourseFeeList;