import React, { useState, useEffect } from 'react';
import axiosInstance  from '../../../axiosConfig';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import API_URL from '../../../config';

import { 
  Card, Button, Typography, Row, Col, Input, Form,
  Alert, Modal, InputNumber, DatePicker, TimePicker
} from 'antd';
import { 
  SaveOutlined
} from '@ant-design/icons';
import moment from 'moment';
import "../../../assets/style.css";

const { Text } = Typography;

const CreateEvent = () => {
  const [degreeLevel, setDegreeLevel] = useState('');
  const [department, setDepartment] = useState('');
  const [batch, setBatch] = useState('');
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [saving, setSaving] = useState(false);
  
  const [eventForm] = Form.useForm();

  useEffect(() => {
    fetchDegreeLevels();
  }, []);

  useEffect(() => {
    if (degreeLevel) {
      fetchDepartments();
      setDepartment('');
      setBatch('');
      setBatches([]);
    }
  }, [degreeLevel]);

  useEffect(() => {
    if (degreeLevel && department) {
      fetchBatches();
    }
  }, [degreeLevel, department]);

  const fetchDegreeLevels = async () => {
    try {
      const response = await axiosInstance.get(`${API_URL}/api/degree-levels`);
      setDegreeLevels(response.data);
    } catch (error) {
      toast.error('Failed to load degree levels');
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await axiosInstance.get(`${API_URL}/api/departments/by-degree`, {
        params: { degreeLevel }
      });
      setDepartments(response.data.departments || []);
    } catch (error) {
      toast.error('Failed to load departments');
    }
  };

  const fetchBatches = async () => {
    try {
      const response = await axiosInstance.get(`${API_URL}/api/batches`);
      
      if (response.data.success) {
        const filteredBatches = response.data.data.filter(batchItem => 
          batchItem.departmentName && 
          batchItem.departmentName.toLowerCase() === department.toLowerCase() &&
          batchItem.degreeLevel &&
          batchItem.degreeLevel.toLowerCase() === degreeLevel.toLowerCase() &&
          batchItem.isActive === true
        );
        setBatches(filteredBatches);
      } else {
        setBatches([]);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast.error('Failed to load batches');
      setBatches([]);
    }
  };

  const formatTime = (time) => {
    if (!time) return '';
    return moment(time).format('hh:mm A');
  };

  const handleTitleChange = (e) => {
    const input = e.target.value;
    if (/^[A-Za-z\s\-.,!?']*$/.test(input)) {
    } else {
      toast.error('Only letters, spaces, and basic punctuation are allowed', { toastId: 'invalid-title' });
      const lastValidValue = eventForm.getFieldValue('title') || '';
      e.target.value = lastValidValue;
    }
  };

  const handleTitleKeyPress = (e) => {
    const char = e.key;
    if (!/^[A-Za-z\s\-.,!?']$/.test(char) && char !== 'Backspace' && char !== 'Delete' && char !== 'Tab') {
      e.preventDefault();
      toast.error('Numbers and special characters are not allowed in event title', { toastId: 'title-chars' });
    }
  };

  const handleEventPlaceChange = (e) => {
    const input = e.target.value;
    if (/^[A-Za-z0-9\s\-.,!?']*$/.test(input)) {
    } else {
      toast.error('Only letters, numbers, spaces, and basic punctuation are allowed', { toastId: 'invalid-place' });
      const lastValidValue = eventForm.getFieldValue('eventPlace') || '';
      e.target.value = lastValidValue;
    }
  };

  const handleEventPlaceKeyPress = (e) => {
    const char = e.key;
    if (!/^[A-Za-z0-9\s\-.,!?']$/.test(char) && char !== 'Backspace' && char !== 'Delete' && char !== 'Tab') {
      e.preventDefault();
      toast.error('Special characters are not allowed except basic punctuation', { toastId: 'place-chars' });
    }
  };

  const handleAmountChange = (value) => {
    if (value === null || value === '') {
      eventForm.setFieldsValue({ amount: undefined });
      return;
    }
    
    if (typeof value === 'number' && value >= 0) {
      if (value > 1000000) {
        toast.error('Amount cannot exceed Rs. 1,000,000', { toastId: 'amount-max' });
        eventForm.setFieldsValue({ amount: 1000000 });
      }
    } else {
      toast.error('Please enter numbers only for amount', { toastId: 'invalid-amount' });
      eventForm.setFieldsValue({ amount: undefined });
    }
  };

  const handleAmountKeyPress = (e) => {
    const charCode = e.which ? e.which : e.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57) && 
        charCode !== 8 && charCode !== 9 && charCode !== 37 && charCode !== 39) {
      e.preventDefault();
      toast.error('Please enter numbers only for amount', { toastId: 'amount-numeric' });
    }
  };

  const validateFormFields = (values) => {
    if (!degreeLevel) {
      toast.error('Please select degree level', { toastId: 'degree-required' });
      return false;
    }
    if (!department) {
      toast.error('Please select department', { toastId: 'dept-required' });
      return false;
    }
    if (!batch) {
      toast.error('Please select batch', { toastId: 'batch-required' });
      return false;
    }
    if (!values.title || values.title.trim().length === 0) {
      toast.error('Please enter event title', { toastId: 'title-required' });
      return false;
    }
    if (!values.amount || values.amount <= 0) {
      toast.error('Please enter valid amount (minimum Rs. 1)', { toastId: 'amount-required' });
      return false;
    }
    if (!values.eventDate) {
      toast.error('Please select event date', { toastId: 'event-date-required' });
      return false;
    }
    if (!values.eventTime) {
      toast.error('Please select event time', { toastId: 'event-time-required' });
      return false;
    }
    if (!values.dueDate) {
      toast.error('Please select payment due date', { toastId: 'due-date-required' });
      return false;
    }
    if (!values.eventPlace || values.eventPlace.trim().length === 0) {
      toast.error('Please enter event place', { toastId: 'place-required' });
      return false;
    }

    if (values.title && values.title.trim().length < 3) {
      toast.error('Event title must be at least 3 characters long', { toastId: 'title-min' });
      return false;
    }

    if (values.title && values.title.trim().length > 100) {
      toast.error('Event title cannot exceed 100 characters', { toastId: 'title-max' });
      return false;
    }

    if (values.amount && values.amount > 1000000) {
      toast.error('Amount cannot exceed Rs. 1,000,000', { toastId: 'amount-max' });
      return false;
    }

    if (values.eventDate && values.eventDate < moment().startOf('day')) {
      toast.error('Event date cannot be in the past', { toastId: 'event-date-past' });
      return false;
    }

    if (values.dueDate && values.dueDate < moment().startOf('day')) {
      toast.error('Due date cannot be in the past', { toastId: 'due-date-past' });
      return false;
    }

    if (values.eventPlace && values.eventPlace.trim().length < 3) {
      toast.error('Event place must be at least 3 characters long', { toastId: 'place-min' });
      return false;
    }

    if (values.eventPlace && values.eventPlace.trim().length > 200) {
      toast.error('Event place cannot exceed 200 characters', { toastId: 'place-max' });
      return false;
    }

    return true;
  };

  const createEventPayment = async (values) => {
    if (!validateFormFields(values)) {
      return;
    }

    try {
      setSaving(true);
      
      const eventData = {
        ...values,
        degreeLevel,
        department,
        batch,
        amount: Number(values.amount),
        eventDate: values.eventDate.format('YYYY-MM-DD'),
        dueDate: values.dueDate.format('YYYY-MM-DD'),
        eventTime: formatTime(values.eventTime)
      };

      console.log('Sending event data:', eventData);

      const response = await axiosInstance.post(`${API_URL}/api/event-payments`, eventData);
      
      if (response.data.success) {
        toast.success('Event payment created successfully!', { toastId: 'success' });
        
       
        Modal.success({
          title: 'Event Created Successfully',
          content: (
            <div>
              <p>Event "<strong>{values.title}</strong>" has been created for {batch} batch.</p>
          
            </div>
          ),
          okText: 'Create Another Event',
          onOk: () => {
            resetForm();
          },
          cancelText: 'View Events',
          onCancel: () => {
            window.location.href = '/events';
          }
        });
      }
    } catch (error) {
      console.error('Error creating event payment:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create event payment';
      toast.error(errorMessage, { toastId: 'server-error' });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    eventForm.resetFields();
    setDegreeLevel('');
    setDepartment('');
    setBatch('');
    toast.info('Form has been reset', { toastId: 'reset' });
  };



  return (
    <div className="create-event container mt-5">
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
      
 
      
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="create-event-title">Event Payment</h2>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Degree Level</label>
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
          <label className="form-label">Department</label>
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

        <div className="form-group">
          <label className="form-label">Batch</label>
          <select
            className="form-select"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            required
            disabled={!department || batches.length === 0}
          >
            <option value="">Select Batch</option>
            {batches.map(batchItem => (
              <option key={batchItem._id} value={batchItem.batchName}>
                {batchItem.batchName} 
               
              </option>
            ))}
          </select>
          {batches.length === 0 && department && (
            <Text type="secondary" style={{ fontSize: '12px', marginTop: '5px' }}>
              No active batches found for this department
            </Text>
          )}
        </div>
      </div>

      <Card 
        className="create-event-card mt-4" 
        style={{ borderRadius: '8px', border: 'none' }}
        title="Event Payment Details"
      >
        <Form
          form={eventForm}
          layout="vertical"
          onFinish={createEventPayment}
          validateTrigger="onSubmit"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="title"
                label="Event Title"
                validateStatus=""
                help=""
              >
                <Input 
                  placeholder="Enter event title (letters and spaces only)" 
                  size="large"
                  maxLength={100}
                  onChange={handleTitleChange}
                  onKeyPress={handleTitleKeyPress}
                  disabled={saving}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="Amount (Rs.)"
                validateStatus=""
                help=""
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="Enter amount (numbers only)"
                  min={1}
                  max={1000000}
                  step={100}
                  size="large"
                  formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/Rs\s?|(,*)/g, '')}
                  onChange={handleAmountChange}
                  onKeyPress={handleAmountKeyPress}
                  disabled={saving}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="eventDate"
                label="Event Date"
                validateStatus=""
                help=""
              >
                <DatePicker
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                  size="large"
                  placeholder="Select event date"
                  disabledDate={(current) => current && current < moment().startOf('day')}
                  disabled={saving}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="eventTime"
                label="Event Time"
                validateStatus=""
                help=""
              >
                <TimePicker
                  style={{ width: '100%' }}
                  format="hh:mm A"
                  size="large"
                  placeholder="Select event time"
                  use12Hours
                  minuteStep={15}
                  disabled={saving}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="dueDate"
                label="Payment Due Date"
                validateStatus=""
                help=""
              >
                <DatePicker
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                  size="large"
                  placeholder="Select payment due date"
                  disabledDate={(current) => current && current < moment().startOf('day')}
                  disabled={saving}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="eventPlace"
            label="Event Place/Venue"
            validateStatus=""
            help=""
          >
            <Input
              placeholder="Enter event venue or location"
              size="large"
              maxLength={200}
              onChange={handleEventPlaceChange}
              onKeyPress={handleEventPlaceKeyPress}
              disabled={saving}
            />
          </Form.Item>

         

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={saving}
              icon={<SaveOutlined />}
              size="large"
              className="btn submit-btn"
            >
              Create Event Payment
            </Button>
            <Button 
              onClick={resetForm}
              size="large"
              className="btn cancel-btn"
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default CreateEvent;