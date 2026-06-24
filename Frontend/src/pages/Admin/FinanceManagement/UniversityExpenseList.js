import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../axiosConfig';
import API_URL from '../../../config';

import { 
  Card, Table, Button, Tag, Space, Input, Select, DatePicker,
  Row, Col, Typography, Alert, Spin, message, Modal, List, Badge
} from 'antd';
import { 
  DownloadOutlined, FilePdfOutlined, SearchOutlined,
  DollarOutlined, UserOutlined, EyeOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ExclamationCircleOutlined,
  FilterOutlined, ClearOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const StudentExpenseList = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState({});
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [filters, setFilters] = useState({
    studentId: '',
    studentName: '',
    paymentStatus: '',
    expenseTitle: '',
    dateRange: []
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  useEffect(() => {
    fetchExpenses();
  }, [filters, pagination.current, pagination.pageSize]);

  const fetchExpenses = async () => {
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

      const response = await axiosInstance.get(`${API_URL}/api/university-expenses/expenses`, { params });
      
      if (response.data.success) {
        setExpenses(response.data.data);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.totalRecords
        }));
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
      message.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentInvoices = async (studentId) => {
    try {
      const response = await axiosInstance.get(`${API_URL}/api/university-expenses/invoices/student/${studentId}`);
      if (response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching student invoices:', error);
      message.error('Failed to load invoices');
      return null;
    }
  };

  const showInvoicesModal = async (expense) => {
    setSelectedExpense(expense);
    setInvoiceModalVisible(true);
    
    const invoiceData = await fetchStudentInvoices(expense.studentId);
    if (invoiceData) {
      setSelectedExpense(prev => ({
        ...prev,
        invoices: invoiceData.invoices,
        invoiceSummary: invoiceData.summary
      }));
    }
  };

  const downloadIndividualInvoice = async (expenseId, invoiceNumber, studentId) => {
    setDownloading(prev => ({ ...prev, [invoiceNumber]: true }));
    
    try {
      const response = await axiosInstance.get(
        `${API_URL}/api/university-expenses/invoices/${expenseId}/${invoiceNumber}/download`,
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
      link.setAttribute('download', `invoice-${invoiceNumber}-${studentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      message.success('Invoice downloaded successfully!');
      
    } catch (error) {
      console.error('Error downloading invoice:', error);
      const errorMessage = error.response?.data?.message || error.message;
      
      if (errorMessage.includes('paid') || errorMessage.includes('already paid')) {
        message.error('Cannot download paid invoice. This invoice has already been paid.');
      } else {
        message.error('Failed to download invoice: ' + errorMessage);
      }
    } finally {
      setDownloading(prev => ({ ...prev, [invoiceNumber]: false }));
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
      expenseTitle: '',
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

  const getExpenseTypeColor = (type) => {
    const colors = {
      'bus': 'blue',
      'hostel': 'green',
      'sports': 'orange',
      'society': 'purple',
      'fine': 'red',
      'library': 'cyan'
    };
    return colors[type] || 'default';
  };

  const getExpenseLabel = (expenseType) => {
    const labels = {
      'bus': 'Transport',
      'hostel': 'Hostel',
      'sports': 'Sports',
      'society': 'Society',
      'fine': 'Fine',
      'library': 'Library'
    };
    return labels[expenseType] || expenseType;
  };

  const getInvoiceStatusIcon = (status) => {
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
      title: 'Expense Types',
      key: 'expenseTypes',
      width: 200,
      render: (_, record) => (
        <Space wrap>
          {record.expenseConfigurations?.map((config, index) => (
            <Tag 
              key={index} 
              color={getExpenseTypeColor(config.expenseTitle)}
              style={{ margin: '2px', fontSize: '11px' }}
            >
              {getExpenseLabel(config.expenseTitle)}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Invoices',
      key: 'invoices',
      width: 100,
      render: (_, record) => (
        <Badge 
          count={record.invoices?.length || 0} 
          showZero 
          style={{ backgroundColor: '#1890ff' }}
        >
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => showInvoicesModal(record)}
            style={{ padding: '4px 8px' }}
          >
            View
          </Button>
        </Badge>
      ),
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount) => (
        <Text strong style={{ color: '#3f8600' }}>
          Rs. {amount?.toLocaleString()}
        </Text>
      ),
      align: 'right',
      width: 120,
      sorter: (a, b) => a.totalAmount - b.totalAmount,
    },
    {
      title: 'Amount Paid',
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
        const balance = record.totalAmount - record.amountPaid;
        return (
          <Text type={balance > 0 ? "danger" : "success"}>
            Rs. {balance?.toLocaleString()}
          </Text>
        );
      },
      align: 'right',
      width: 120,
      sorter: (a, b) => (a.totalAmount - a.amountPaid) - (b.totalAmount - b.amountPaid),
    },
    {
      title: 'Payment Status',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      render: (status) => (
        <Tag color={getPaymentStatusColor(status)}>
          {status?.toUpperCase()}
        </Tag>
      ),
      width: 120,
      filters: [
        { text: 'Pending', value: 'pending' },
        { text: 'Paid', value: 'paid' },
        { text: 'Overdue', value: 'overdue' },
        { text: 'Cancelled', value: 'cancelled' },
      ],
      onFilter: (value, record) => record.paymentStatus === value,
    }
  ];

  // Mobile columns
  const mobileColumns = [
    {
      title: 'Student Details',
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
              <Text strong>Dept:</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.department}
              </Text>
            </Col>
          </Row>
          
          <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
            <Col span={12}>
              <Text strong>Total:</Text>
              <br />
              <Text strong style={{ color: '#3f8600', fontSize: '14px' }}>
                Rs. {record.totalAmount?.toLocaleString()}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Status:</Text>
              <br />
              <Tag color={getPaymentStatusColor(record.paymentStatus)} style={{ margin: 0 }}>
                {record.paymentStatus?.toUpperCase()}
              </Tag>
            </Col>
          </Row>

          <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Text strong>Balance:</Text>
              <br />
              <Text type={record.totalAmount - record.amountPaid > 0 ? "danger" : "success"} style={{ fontSize: '14px' }}>
                Rs. {(record.totalAmount - record.amountPaid)?.toLocaleString()}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Invoices:</Text>
              <br />
              <Badge 
                count={record.invoices?.length || 0} 
                showZero 
                style={{ backgroundColor: '#1890ff' }}
              />
            </Col>
          </Row>
          
          <Button 
            type="primary" 
            size="small"
            icon={<EyeOutlined />}
            onClick={() => showInvoicesModal(record)}
            className="btn submit-btn"
            style={{ width: '100%' }}
          >
            View Details
          </Button>
        </Card>
      ),
    },
  ];

  // Calculate statistics
  const totalExpenses = pagination.total;
  const pendingPayments = expenses.filter(e => e.paymentStatus === 'pending').length;
  const totalRevenue = expenses.reduce((sum, e) => sum + (e.amountPaid || 0), 0);
  const pendingRevenue = expenses.reduce((sum, e) => sum + ((e.totalAmount || 0) - (e.amountPaid || 0)), 0);

  return (
    <div className="container mt-5" style={{ minHeight: '100vh' }}>
      <div className="d-flex justify-content-between align-items-center mb-5">
        <div>
          <h2 className="create-expense-title" style={{ margin: 0, color: '#262626' }}>
            Student Expenses Management
          </h2>
          
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f0f8ff' }}>
            <div style={{ padding: '12px' }}>
              <FilePdfOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Total Expenses</Text>
                <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                  {totalExpenses?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
            <div style={{ padding: '12px' }}>
              <DollarOutlined style={{ fontSize: '24px', color: '#fa8c16', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Pending Payments</Text>
                <Text strong style={{ fontSize: '18px', color: '#fa8c16' }}>
                  {pendingPayments?.toLocaleString()}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
            <div style={{ padding: '12px' }}>
              <DollarOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Total Revenue</Text>
                <Text strong style={{ fontSize: '18px', color: '#52c41a' }}>
                  Rs. {totalRevenue?.toLocaleString()}
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
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Pending Revenue</Text>
                <Text strong style={{ fontSize: '18px', color: '#ff4d4f' }}>
                  Rs. {pendingRevenue?.toLocaleString()}
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
                <Option value="cancelled">Cancelled</Option>
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Expense Type</label>
              <Select
                placeholder="Select Type"
                value={filters.expenseTitle}
                onChange={(value) => handleFilterChange('expenseTitle', value)}
                style={{ width: '100%' }}
                allowClear
                size="large"
              >
                <Option value="bus">Transport</Option>
                <Option value="hostel">Hostel</Option>
                <Option value="sports">Sports</Option>
                <Option value="society">Society</Option>
                <Option value="fine">Fine</Option>
                <Option value="library">Library</Option>
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

      {/* Expenses Table */}
      <Card 
        className="create-event-card"
        style={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        title={
          <Text strong style={{ color: '#262626', fontSize: '18px' }}>
            Student Expenses ({totalExpenses})
          </Text>
        }
      >
        {/* Desktop Table */}
        <div className="d-none d-md-block">
          <Table
            columns={desktopColumns}
            dataSource={expenses.map(expense => ({ ...expense, key: expense._id }))}
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
                `${range[0]}-${range[1]} of ${total} expenses`,
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
            dataSource={expenses.map(expense => ({ ...expense, key: expense._id }))}
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

      {/* Invoice Details Modal */}
      <Modal
        title={
          <Text strong style={{ fontSize: '18px', color: '#262626' }}>
            <FilePdfOutlined /> Invoices for {selectedExpense?.studentName} ({selectedExpense?.studentId})
          </Text>
        }
        open={invoiceModalVisible}
        onCancel={() => setInvoiceModalVisible(false)}
        footer={[
          <Button 
            key="close" 
            onClick={() => setInvoiceModalVisible(false)}
            className="btn cancel-btn"
          >
            Close
          </Button>
        ]}
        width={800}
        style={{ top: 20 }}
      >
        {selectedExpense && (
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
                  <Text style={{ color: '#262626' }}>{selectedExpense.studentName}</Text>
                </Col>
                <Col xs={24} sm={8}>
                  <Text strong>Batch:</Text>
                  <br />
                  <Text style={{ color: '#262626' }}>{selectedExpense.batch}</Text>
                </Col>
                <Col xs={24} sm={8}>
                  <Text strong>Department:</Text>
                  <br />
                  <Text style={{ color: '#262626' }}>{selectedExpense.department}</Text>
                </Col>
              </Row>
            </Card>

            {/* Invoice Summary */}
            {selectedExpense.invoiceSummary && (
              <Card size="small" style={{ marginBottom: 16, background: '#f0f8ff' }}>
                <Row gutter={16}>
                  <Col xs={12} sm={6}>
                    <Text strong>Total Invoices:</Text>
                    <br />
                    <Text style={{ fontSize: '16px' }}>{selectedExpense.invoiceSummary.totalInvoices}</Text>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Text strong>Paid:</Text>
                    <br />
                    <Tag color="green">{selectedExpense.invoiceSummary.paidInvoices}</Tag>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Text strong>Pending:</Text>
                    <br />
                    <Tag color="orange">{selectedExpense.invoiceSummary.pendingInvoices}</Tag>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Text strong>Total Due:</Text>
                    <br />
                    <Text type="danger" strong>Rs. {selectedExpense.invoiceSummary.totalDue?.toLocaleString()}</Text>
                  </Col>
                </Row>
              </Card>
            )}

            {/* Individual Invoices List */}
            <List
              size="small"
              header={<Text strong>Individual Invoices</Text>}
              dataSource={selectedExpense.invoices || []}
              renderItem={(invoice) => (
                <List.Item
                  actions={[
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      loading={downloading[invoice.invoiceNumber]}
                      onClick={() => downloadIndividualInvoice(
                        selectedExpense._id, 
                        invoice.invoiceNumber, 
                        selectedExpense.studentId
                      )}
                      disabled={invoice.paymentStatus === 'paid'}
                      title={invoice.paymentStatus === 'paid' ? 'Cannot download paid invoice' : 'Download invoice'}
                      className="btn submit-btn"
                      size="small"
                    >
                      Download
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={getInvoiceStatusIcon(invoice.paymentStatus)}
                    title={
                      <Space>
                        <Text strong>{invoice.invoiceNumber}</Text>
                        <Tag color={getPaymentStatusColor(invoice.paymentStatus)} style={{ margin: 0 }}>
                          {invoice.paymentStatus.toUpperCase()}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Text>{invoice.description}</Text>
                        <Text type="secondary">
                          Amount: Rs. {invoice.amount?.toLocaleString()} | 
                          Due: {new Date(invoice.dueDate).toLocaleDateString()}
                        </Text>
                        {invoice.amountPaid > 0 && (
                          <Text type="success">
                            Paid: Rs. {invoice.amountPaid?.toLocaleString()}
                          </Text>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />

            {(!selectedExpense.invoices || selectedExpense.invoices.length === 0) && (
              <Alert
                message="No Invoices Found"
                description="This student doesn't have any invoices yet."
                type="info"
                showIcon
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StudentExpenseList;