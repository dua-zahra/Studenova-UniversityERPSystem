import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../axiosConfig';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  Card, Table, Button, Tag, Space, Input, Select, 
  Row, Col, Typography, Alert, Spin, Modal, Statistic,
  Dropdown, Menu, DatePicker
} from 'antd';
import { 
  EyeOutlined, DownloadOutlined, FilePdfOutlined,
  PlusOutlined, SearchOutlined, MoreOutlined,
  DollarOutlined, TeamOutlined, CalendarOutlined,
  FilterOutlined, ClearOutlined
} from '@ant-design/icons';
import API_URL from '../../../config';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const EventList = () => {
  const [events, setEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    batch: '',
    degreeLevel: '',
    department: '',
    status: '',
    eventTitle: '',
    dateRange: []
  });

  useEffect(() => {
    fetchEvents();
  }, []);
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get(`${API_URL}/api/event-payments`, {
        params: {
          page: 1,
          limit: 1000 
        }
      });
      
      if (response.data.success) {
        const eventsData = response.data.data.eventPayments || [];
        setAllEvents(eventsData);
        setEvents(eventsData); s
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    applyFilters();
  }, [filters, allEvents]);

  const applyFilters = () => {
    let filteredEvents = [...allEvents];

    if (filters.eventTitle) {
      filteredEvents = filteredEvents.filter(event => 
        event.title?.toLowerCase().includes(filters.eventTitle.toLowerCase()) ||
        event.eventPlace?.toLowerCase().includes(filters.eventTitle.toLowerCase())
      );
    }

    if (filters.degreeLevel) {
      filteredEvents = filteredEvents.filter(event => 
        event.degreeLevel?.toLowerCase().includes(filters.degreeLevel.toLowerCase())
      );
    }

    if (filters.department) {
      filteredEvents = filteredEvents.filter(event => 
        event.department?.toLowerCase().includes(filters.department.toLowerCase())
      );
    }

    if (filters.batch) {
      filteredEvents = filteredEvents.filter(event => 
        event.batch?.toLowerCase().includes(filters.batch.toLowerCase())
      );
    }

    if (filters.status) {
      filteredEvents = filteredEvents.filter(event => 
        event.status === filters.status
      );
    }

    if (filters.dateRange && filters.dateRange.length === 2) {
      const startDate = filters.dateRange[0].startOf('day');
      const endDate = filters.dateRange[1].endOf('day');
      
      filteredEvents = filteredEvents.filter(event => {
        const eventDate = new Date(event.eventDate);
        return eventDate >= startDate && eventDate <= endDate;
      });
    }

    setEvents(filteredEvents);
  };

  const fetchEventDetails = async (eventId) => {
    try {
      const response = await axiosInstance.get(`${API_URL}/api/event-payments/${eventId}`);
      if (response.data.success) {
        setSelectedEvent(response.data.data);
        setDetailModalVisible(true);
      }
    } catch (error) {
      console.error('Error fetching event details:', error);
      toast.error('Failed to load event details');
    }
  };

  const downloadIndividualInvoice = async (eventId, studentId) => {
    try {
      const response = await axiosInstance.get(
        `${API_URL}/api/event-payments/${eventId}/invoice/${studentId}`,
        { 
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `event-invoice-${studentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Invoice downloaded successfully!');
      
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast.error('Failed to download invoice');
    }
  };

  const downloadAllInvoices = async (eventId) => {
    try {
      const response = await axiosInstance.get(
        `${API_URL}/api/event-payments/${eventId}/invoices/all`,
        { 
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `event-${eventId}-all-invoices.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('All invoices downloaded successfully!');
      
    } catch (error) {
      console.error('Error downloading invoices:', error);
      toast.error('Failed to download invoices');
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      batch: '',
      degreeLevel: '',
      department: '',
      status: '',
      eventTitle: '',
      dateRange: []
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'blue',
      'completed': 'green',
      'cancelled': 'red'
    };
    return colors[status] || 'default';
  };

  const getPaymentStatusColor = (status) => {
    const colors = {
      'pending': 'orange',
      'paid': 'green',
      'overdue': 'red'
    };
    return colors[status] || 'default';
  };

  const columns = [
    {
      title: 'Event Title',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      responsive: ['md'],
      render: (title, record) => (
        <div>
          <Text strong style={{ color: '#262626' }}>{title}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.eventPlace}
          </Text>
        </div>
      ),
    },
    {
      title: 'Batch Info',
      key: 'batchInfo',
      width: 180,
      responsive: ['md'],
      render: (_, record) => (
        <div>
          <Text strong style={{ color: '#262626' }}>{record.batch}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.degreeLevel} - {record.department}
          </Text>
        </div>
      ),
    },
    {
      title: 'Event Date & Time',
      key: 'eventDateTime',
      width: 150,
      responsive: ['md'],
      render: (_, record) => (
        <div>
          <Text>{new Date(record.eventDate).toLocaleDateString()}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.eventTime}
          </Text>
        </div>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      responsive: ['sm'],
      render: (amount) => (
        <Text strong style={{ color: '#3f8600' }}>
          Rs. {amount?.toLocaleString()}
        </Text>
      ),
      align: 'right',
    },
    {
      title: 'Students',
      key: 'students',
      width: 120,
      responsive: ['lg'],
      render: (_, record) => (
        <div style={{ textAlign: 'center' }}>
          <TeamOutlined style={{ color: '#1890ff', marginRight: 4 }} />
          <Text strong>{record.paidStudents || 0}</Text>
          <Text type="secondary"> / {record.totalStudents}</Text>
        </div>
      ),
    },
    {
      title: 'Collection',
      key: 'collection',
      width: 120,
      responsive: ['lg'],
      render: (_, record) => (
        <Text strong style={{ color: '#52c41a' }}>
          Rs. {(record.totalCollected || 0)?.toLocaleString()}
        </Text>
      ),
      align: 'right',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      responsive: ['sm'],
      render: (status) => (
        <Tag color={getStatusColor(status)} style={{ margin: 0 }}>
          {status?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => fetchEventDetails(record._id)}
            size="small"
            style={{ padding: '4px 8px' }}
          >
            View
          </Button>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item 
                  key="download-all"
                  icon={<DownloadOutlined />}
                  onClick={() => downloadAllInvoices(record._id)}
                >
                  Download All Invoices
                </Menu.Item>
              </Menu>
            }
            trigger={['click']}
          >
            <Button 
              type="text" 
              icon={<MoreOutlined />}
              size="small"
              style={{ padding: '4px 8px' }}
            />
          </Dropdown>
        </Space>
      ),
    },
  ];

  const mobileColumns = [
    {
      title: 'Event Details',
      key: 'mobileView',
      render: (_, record) => (
        <Card 
          size="small" 
          style={{ marginBottom: 8, background: '#fafafa' }}
          bodyStyle={{ padding: '12px' }}
        >
          <div style={{ marginBottom: 8 }}>
            <Text strong style={{ color: '#262626', fontSize: '16px' }}>
              {record.title}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: '14px' }}>
              {record.eventPlace}
            </Text>
          </div>
          
          <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
            <Col span={12}>
              <Text strong>Batch Info:</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.batch} - {record.degreeLevel}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.department}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Date:</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {new Date(record.eventDate).toLocaleDateString()}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.eventTime}
              </Text>
            </Col>
          </Row>
          
          <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Text strong>Amount:</Text>
              <br />
              <Text strong style={{ color: '#3f8600', fontSize: '14px' }}>
                Rs. {record.amount?.toLocaleString()}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Status:</Text>
              <br />
              <Tag color={getStatusColor(record.status)} style={{ margin: 0 }}>
                {record.status?.toUpperCase()}
              </Tag>
            </Col>
          </Row>

          <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Text strong>Students:</Text>
              <br />
              <Text style={{ fontSize: '14px' }}>
                {record.paidStudents || 0} / {record.totalStudents}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Collection:</Text>
              <br />
              <Text strong style={{ color: '#52c41a', fontSize: '14px' }}>
                Rs. {(record.totalCollected || 0)?.toLocaleString()}
              </Text>
            </Col>
          </Row>
          
          <Space>
            <Button 
              type="primary" 
              size="small"
              icon={<EyeOutlined />}
              onClick={() => fetchEventDetails(record._id)}
              className="btn submit-btn"
            >
              View Details
            </Button>
            <Dropdown
              overlay={
                <Menu>
                  <Menu.Item 
                    key="download-all"
                    icon={<DownloadOutlined />}
                    onClick={() => downloadAllInvoices(record._id)}
                  >
                    Download All Invoices
                  </Menu.Item>
                </Menu>
              }
            >
              <Button 
                size="small"
                icon={<MoreOutlined />}
              />
            </Dropdown>
          </Space>
        </Card>
      ),
    },
  ];

  const totalEvents = events.length;
  const activeEvents = events.filter(e => e.status === 'active').length;
  const totalStudents = events.reduce((sum, e) => sum + (e.totalStudents || 0), 0);
  const totalCollection = events.reduce((sum, e) => sum + (e.totalCollected || 0), 0);

  return (
    <div className="container mt-4" style={{ minHeight: '100vh' }}>
      <ToastContainer 
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      
      <div className="d-flex justify-content-between align-items-center mb-5">
        <div>
          <h2 className="create-event-title mt-5" style={{ margin: 0, color: '#262626' }}>
            Event Payments Management
          </h2>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => window.location.href = '/create-event'}
          size="large"
          className="btn submit-btn"
        >
          Create Event Payment
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f0f8ff' }}>
            <div style={{ padding: '12px' }}>
              <CalendarOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Total Events</Text>
                <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                  {totalEvents?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
            <div style={{ padding: '12px' }}>
              <CalendarOutlined style={{ fontSize: '24px', color: '#fa8c16', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Active Events</Text>
                <Text strong style={{ fontSize: '18px', color: '#fa8c16' }}>
                  {activeEvents?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
            <div style={{ padding: '12px' }}>
              <TeamOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Total Students</Text>
                <Text strong style={{ fontSize: '18px', color: '#52c41a' }}>
                  {totalStudents?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff2f0' }}>
            <div style={{ padding: '12px' }}>
              <DollarOutlined style={{ fontSize: '24px', color: '#ff4d4f', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Total Collection</Text>
                <Text strong style={{ fontSize: '18px', color: '#ff4d4f' }}>
                  Rs. {totalCollection?.toLocaleString()}
                </Text>
              </div>
            </div>
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
              <label className="form-label">Search Event</label>
              <Input
                placeholder="Search event title or place"
                value={filters.eventTitle}
                onChange={(e) => handleFilterChange('eventTitle', e.target.value)}
                prefix={<SearchOutlined />}
                allowClear
                size="large"
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Degree Level</label>
              <Input
                placeholder="Search degree level"
                value={filters.degreeLevel}
                onChange={(e) => handleFilterChange('degreeLevel', e.target.value)}
                allowClear
                size="large"
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Department</label>
              <Input
                placeholder="Search department"
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
                allowClear
                size="large"
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Batch</label>
              <Input
                placeholder="Search batch"
                value={filters.batch}
                onChange={(e) => handleFilterChange('batch', e.target.value)}
                allowClear
                size="large"
              />
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
                <Option value="active">Active</Option>
                <Option value="completed">Completed</Option>
                <Option value="cancelled">Cancelled</Option>
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Event Date Range</label>
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
            Event Payments ({events.length})
          </Text>
        }
      >
        <div className="d-none d-md-block">
          <Table
            columns={columns}
            dataSource={events.map(event => ({ ...event, key: event._id }))}
            rowKey="_id"
            loading={loading}
            scroll={{ x: 1000 }}
            size="middle"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} events`
            }}
          />
        </div>

        <div className="d-block d-md-none">
          <Table
            columns={mobileColumns}
            dataSource={events.map(event => ({ ...event, key: event._id }))}
            rowKey="_id"
            loading={loading}
            pagination={{
              pageSize: 5,
              simple: true
            }}
            showHeader={false}
          />
        </div>
      </Card>

      <Modal
        title={
          <Text strong style={{ fontSize: '18px', color: '#262626' }}>
            Event Details: {selectedEvent?.title}
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
          </Button>,
          <Button 
            key="download-all"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => downloadAllInvoices(selectedEvent?._id)}
            className="btn submit-btn"
          >
            Download All Invoices
          </Button>
        ]}
        width={1000}
        style={{ top: 20 }}
      >
        {selectedEvent && (
          <div>
            <Card 
              size="small" 
              style={{ marginBottom: 16, background: '#fafafa' }}
              bodyStyle={{ padding: '16px' }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Text strong>Event:</Text>
                  <br />
                  <Text style={{ color: '#262626' }}>{selectedEvent.title}</Text>
                </Col>
                <Col xs={24} md={8}>
                  <Text strong>Date & Time:</Text>
                  <br />
                  <Text style={{ color: '#262626' }}>
                    {new Date(selectedEvent.eventDate).toLocaleDateString()} at {selectedEvent.eventTime}
                  </Text>
                </Col>
                <Col xs={24} md={8}>
                  <Text strong>Venue:</Text>
                  <br />
                  <Text style={{ color: '#262626' }}>{selectedEvent.eventPlace}</Text>
                </Col>
              </Row>
              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24} md={8}>
                  <Text strong>Batch Info:</Text>
                  <br />
                  <Text style={{ color: '#262626' }}>
                    {selectedEvent.batch} - {selectedEvent.degreeLevel}
                  </Text>
                  <br />
                  <Text style={{ color: '#262626' }}>{selectedEvent.department}</Text>
                </Col>
                <Col xs={24} md={8}>
                  <Text strong>Amount:</Text>
                  <br />
                  <Text strong style={{ color: '#3f8600' }}>
                    Rs. {selectedEvent.amount?.toLocaleString()}
                  </Text>
                </Col>
                <Col xs={24} md={8}>
                  <Text strong>Due Date:</Text>
                  <br />
                  <Text style={{ color: '#262626' }}>
                    {new Date(selectedEvent.dueDate).toLocaleDateString()}
                  </Text>
                </Col>
              </Row>
            </Card>

            <Card 
              size="small" 
              title={
                <Text strong style={{ color: '#262626' }}>
                  Student Payments
                </Text>
              }
            >
              <Table
                size="small"
                dataSource={selectedEvent.studentPayments || []}
                rowKey="studentId"
                scroll={{ x: 600 }}
                pagination={{ 
                  pageSize: 5,
                  simple: true
                }}
                columns={[
                  {
                    title: 'Student ID',
                    dataIndex: 'studentId',
                    key: 'studentId',
                    width: 120,
                  },
                  {
                    title: 'Student Name',
                    key: 'studentName',
                    width: 150,
                    render: (_, record) => (
                      <Text style={{ color: '#262626' }}>
                        {record.student?.firstName} {record.student?.lastName}
                      </Text>
                    ),
                  },
                  {
                    title: 'Invoice Number',
                    dataIndex: 'invoiceNumber',
                    key: 'invoiceNumber',
                    width: 120,
                  },
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    width: 100,
                    render: (status) => (
                      <Tag color={getPaymentStatusColor(status)} style={{ margin: 0 }}>
                        {status?.toUpperCase()}
                      </Tag>
                    ),
                  },
                  {
                    title: 'Amount Paid',
                    key: 'paidAmount',
                    width: 100,
                    render: (_, record) => (
                      <Text strong style={{ color: '#3f8600' }}>
                        Rs. {record.paidAmount?.toLocaleString()}
                      </Text>
                    ),
                    align: 'right',
                  },
                  {
                    title: 'Actions',
                    key: 'actions',
                    width: 120,
                    render: (_, record) => (
                      <Button 
                        type="link" 
                        icon={<FilePdfOutlined />}
                        onClick={() => downloadIndividualInvoice(selectedEvent._id, record.studentId)}
                        size="small"
                        style={{ padding: 0 }}
                        className="btn submit-btn"
                      >
                        Invoice
                      </Button>
                    ),
                  },
                ]}
              />
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EventList;