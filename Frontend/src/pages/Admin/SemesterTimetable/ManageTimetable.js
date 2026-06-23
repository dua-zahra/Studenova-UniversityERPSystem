import React, { useState, useEffect } from 'react';
import axiosInstance  from '../../../axiosConfig';
import API_URL from '../../../config';

import { 
  Table, Button, Select, Card, Row, Col, 
  message, Modal, Form, Input, 
  Tag, Space, Spin, Alert, Divider, Statistic,
  Tooltip, Popconfirm, Switch, Tabs, Badge, List
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  CalendarOutlined, ClockCircleOutlined, CheckCircleOutlined, 
  ExclamationCircleOutlined, WarningOutlined, SyncOutlined,
  EyeOutlined, SendOutlined, FilePdfOutlined, UserOutlined,
  CloseCircleOutlined, InfoCircleOutlined, RedoOutlined
} from '@ant-design/icons';
import "../../../assets/style.css";
const { Option } = Select;
const { TabPane } = Tabs;

const TimetableManagement = () => {
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedDegree, setSelectedDegree] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [batchDetails, setBatchDetails] = useState(null);
  const [courses, setCourses] = useState([]);
  const [timetable, setTimetable] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [isTimeSlotModalVisible, setIsTimeSlotModalVisible] = useState(false);
  const [currentTimeSlot, setCurrentTimeSlot] = useState(null);
  const [semesterDates, setSemesterDates] = useState(null);
  const [validityStatus, setValidityStatus] = useState(null);
  const [academicYearDisplay, setAcademicYearDisplay] = useState('');
  const [syncStatus, setSyncStatus] = useState(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [allBatchesTimetables, setAllBatchesTimetables] = useState({});
  const [allBatchesDetails, setAllBatchesDetails] = useState({});
  const [publishedTimetables, setPublishedTimetables] = useState([]);
  const [activeTab, setActiveTab] = useState('manage');
  const [changesSincePublish, setChangesSincePublish] = useState([]);
  
  const [loading, setLoading] = useState({
    degree: false,
    department: false,
    batch: false,
    courses: false,
    timetable: false,
    semesterDates: false,
    sync: false,
    allBatches: false,
    publish: false,
    republish: false
  });
  const [form] = Form.useForm();

  const timeOptions = [
    '08:00-10:00', '10:00-12:00',
    '12:00-14:00', '14:00-16:00'
  ];

  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
  
  const roomOptions = [
    'Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5', 'Room 6', 'Room 7', 'Room 8',
    'Room 9', 'Room 10', 'Room 11', 'Lab 1', 'Lab 2', 'Lab 3', 'Lab 4', 'Lab 5'
  ];

  useEffect(() => {
    fetchDegreeLevels();
    fetchPublishedTimetables();
  }, []);

  const fetchDegreeLevels = async () => {
    try {
      setLoading(prev => ({ ...prev, degree: true }));
      const response = await axiosInstance.get(`${API_URL}/api/degree-levels`);
      setDegreeLevels(response.data);
    } catch (error) {
      console.error('Error fetching degree levels:', error);
      message.error('Failed to load degree levels');
    } finally {
      setLoading(prev => ({ ...prev, degree: false }));
    }
  };

  const fetchPublishedTimetables = async () => {
    try {
      const response = await axiosInstance.get(`${API_URL}/api/timetables/published-timetables`);
      setPublishedTimetables(response.data.data || []);
    } catch (error) {
      console.error('Error fetching published timetables:', error);
    }
  };

  useEffect(() => {
    if (selectedDegree) {
      fetchDepartments();
    } else {
      setDepartments([]);
      setSelectedDepartment('');
    }
  }, [selectedDegree]);

  const fetchDepartments = async () => {
    try {
      setLoading(prev => ({ ...prev, department: true }));
      const response = await axiosInstance.get(`${API_URL}/api/departments/by-degree`, {
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
      message.error('Failed to load departments');
    } finally {
      setLoading(prev => ({ ...prev, department: false }));
    }
  };

  useEffect(() => {
    if (selectedDepartment) {
      fetchBatches();
    } else {
      setBatches([]);
      setSelectedBatch('');
    }
  }, [selectedDepartment]);

  const fetchBatches = async () => {
    try {
      setLoading(prev => ({ ...prev, batch: true }));
      const response = await axiosInstance.get(`${API_URL}/api/teacher-assignment/batches/active`, {
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

  const fetchAllBatchesTimetables = async () => {
    if (!selectedDepartment) return;
    
    try {
      setLoading(prev => ({ ...prev, allBatches: true }));
      console.log('🔄 Fetching timetables for all batches in department:', selectedDepartment);
      
      const batchesResponse = await axiosInstance.get(`${API_URL}/api/teacher-assignment/batches/active`, {
        params: { 
          degreeLevel: selectedDegree,
          department: selectedDepartment 
        }
      });

      let allBatches = [];
      if (Array.isArray(batchesResponse.data)) {
        allBatches = batchesResponse.data;
      } else if (batchesResponse.data.data && Array.isArray(batchesResponse.data.data)) {
        allBatches = batchesResponse.data.data;
      } else if (batchesResponse.data.batches && Array.isArray(batchesResponse.data.batches)) {
        allBatches = batchesResponse.data.batches;
      }

      const timetablesMap = {};
      const batchesDetailsMap = {};

      for (const batch of allBatches) {
        try {
          batchesDetailsMap[batch._id] = batch;
          
          const timetableResponse = await axiosInstance.get(
            `${API_URL}/api/timetables/batches/${batch._id}/semesters/${batch.currentSemester || 1}/timetable`
          );
          
          if (timetableResponse.data.data?.timetable) {
            timetablesMap[batch._id] = timetableResponse.data.data.timetable;
          } else {
            timetablesMap[batch._id] = null;
          }
        } catch (error) {
          console.error(`Error fetching timetable for batch ${batch.batchName}:`, error);
          timetablesMap[batch._id] = null;
        }
      }

      setAllBatchesTimetables(timetablesMap);
      setAllBatchesDetails(batchesDetailsMap);
      
    } catch (error) {
      console.error('Error fetching all batches timetables:', error);
    } finally {
      setLoading(prev => ({ ...prev, allBatches: false }));
    }
  };

  useEffect(() => {
    if (selectedBatch) {
      fetchBatchDetails();
      fetchCoursesWithTeachers();
      fetchTimetable();
      fetchSemesterDates();
      fetchChangesSincePublish();
    } else {
      setBatchDetails(null);
      setCourses([]);
      setTimetable(null);
      setTimeSlots([]);
      setSemesterDates(null);
      setValidityStatus(null);
      setAcademicYearDisplay('');
      setSyncStatus(null);
      setChangesSincePublish([]);
    }
  }, [selectedBatch]);

  useEffect(() => {
    if (selectedDepartment) {
      fetchAllBatchesTimetables();
    } else {
      setAllBatchesTimetables({});
      setAllBatchesDetails({});
    }
  }, [selectedDepartment]);

  useEffect(() => {
    if (timetable?._id) {
      checkSyncStatus();
      
      const interval = setInterval(() => {
        if (autoSyncEnabled) {
          checkSyncStatus();
        }
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [timetable, autoSyncEnabled]);

 const fetchBatchDetails = async () => {
  try {
    const response = await axiosInstance.get(`${API_URL}/api/teacher-assignment/batches/${selectedBatch}`);
    const batchData = response.data;
    const actualBatchData = batchData.data || batchData;
    
    const sectionNames = actualBatchData.sections?.map(s => s.name) || [];
    
    setBatchDetails({
      ...actualBatchData,
      sectionNames: sectionNames,
      totalSections: sectionNames.length
    });
  } catch (error) {
    console.error('Error fetching batch details:', error);
    message.error('Failed to load batch details');
  }
};

  const fetchSemesterDates = async () => {
    try {
      setLoading(prev => ({ ...prev, semesterDates: true }));
      const response = await axiosInstance.get(`${API_URL}/api/timetables/batches/${selectedBatch}/current-semester-dates`);
      
      if (response.data.success && response.data.data) {
        const semesterData = response.data.data;
        setSemesterDates(semesterData);
        calculateValidityStatus(semesterData);
        determineAcademicYearDisplay(semesterData);
      }
    } catch (error) {
      console.error('Error fetching semester dates:', error);
    } finally {
      setLoading(prev => ({ ...prev, semesterDates: false }));
    }
  };

  const fetchChangesSincePublish = async () => {
    if (!timetable?._id) return;
    
    try {
      const response = await axiosInstance.get(`${API_URL}/api/timetables/timetables/${timetable._id}/changes-since-publish`);
      setChangesSincePublish(response.data.data?.changesSincePublish || []);
    } catch (error) {
      console.error('Error fetching changes since publish:', error);
    }
  };

  const determineAcademicYearDisplay = (semesterData) => {
    if (!semesterData) return;
    
    const semesterName = semesterData.semesterName || '';
    const startDate = new Date(semesterData.startDate);
    const year = startDate.getFullYear();
    
    if (semesterName.toLowerCase().includes('fall')) {
      setAcademicYearDisplay(`FALL-${year}`);
    } else if (semesterName.toLowerCase().includes('spring')) {
      setAcademicYearDisplay(`SPRING-${year}`);
    } else {
      const month = startDate.getMonth() + 1;
      if (month >= 8 && month <= 12) {
        setAcademicYearDisplay(`FALL-${year}`);
      } else {
        setAcademicYearDisplay(`SPRING-${year}`);
      }
    }
  };

  const calculateValidityStatus = (semesterData) => {
    if (!semesterData || !semesterData.endDate) {
      setValidityStatus(null);
      return;
    }

    const now = new Date();
    const endDate = new Date(semesterData.endDate);
    const timeDiff = endDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

    let status = 'unknown';
    let message = '';
    let color = 'default';
    let icon = <ClockCircleOutlined />;

    if (daysRemaining > 30) {
      status = 'valid';
      message = `Valid for ${daysRemaining} days`;
      color = 'green';
      icon = <CheckCircleOutlined />;
    } else if (daysRemaining > 7) {
      status = 'warning';
      message = `${daysRemaining} days remaining`;
      color = 'orange';
      icon = <ExclamationCircleOutlined />;
    } else if (daysRemaining > 0) {
      status = 'critical';
      message = `Only ${daysRemaining} days left!`;
      color = 'red';
      icon = <ExclamationCircleOutlined />;
    } else if (daysRemaining === 0) {
      status = 'expired';
      message = 'Expires today';
      color = 'red';
      icon = <ExclamationCircleOutlined />;
    } else {
      status = 'expired';
      message = `Expired ${Math.abs(daysRemaining)} days ago`;
      color = 'red';
      icon = <ExclamationCircleOutlined />;
    }

    setValidityStatus({
      status,
      message,
      color,
      icon,
      daysRemaining,
      endDate: endDate.toLocaleDateString()
    });
  };

  const fetchCoursesWithTeachers = async () => {
    try {
      setLoading(prev => ({ ...prev, courses: true }));
      
      const batchResponse = await axiosInstance.get(`${API_URL}/api/teacher-assignment/batches/${selectedBatch}`);
      const currentBatch = batchResponse.data;
      const actualBatchData = currentBatch.data || currentBatch;
      const currentSemester = actualBatchData.currentSemester || 1;
      
      const coursesResponse = await axiosInstance.get(
        `${API_URL}/api/timetables/batches/${selectedBatch}/semesters/${currentSemester}/courses`
      );

      const coursesData = coursesResponse.data.data || [];
      console.log('Courses with faculty data:', coursesData);
      setCourses(coursesData);
      
    } catch (error) {
      console.error('Error fetching courses with teachers:', error);
      message.error('Failed to load courses');
    } finally {
      setLoading(prev => ({ ...prev, courses: false }));
    }
  };

  const performAutoSync = async () => {
    if (!timetable?._id) return;
    
    try {
      console.log('Performing STRICT auto-sync with targeted cleanup...');
      setLoading(prev => ({ ...prev, sync: true }));
      
      const response = await axiosInstance.post(
        `${API_URL}/api/timetables/timetables/${timetable._id}/sync-faculty`
      );
      
      if (response.data.data?.removedCount > 0) {
        const details = response.data.details;
        let detailedMessage = `Auto-sync removed ${response.data.data.removedCount} time slots from specific courses.`;
        
        if (details.teacherChangedRemovals > 0) {
          detailedMessage += ` ${details.teacherChangedRemovals} due to teacher changes.`;
        }
        if (details.facultyInactiveRemovals > 0) {
          detailedMessage += ` ${details.facultyInactiveRemovals} due to inactive faculty.`;
        }
        
        message.warning(detailedMessage);
        
        if (response.data.data.changes && response.data.data.changes.length > 0) {
          Modal.info({
            title: 'Auto-Sync Changes Applied',
            width: 600,
            content: (
              <div>
                <p><strong>Summary:</strong> {detailedMessage}</p>
                <p><em>Only courses with actual teacher changes were removed.</em></p>
                <Divider />
                <List
                  size="small"
                  dataSource={response.data.data.changes.slice(0, 10)}
                  renderItem={(change, index) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          change.type.includes('removed') ? 
                            <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> : 
                            <InfoCircleOutlined style={{ color: '#1890ff' }} />
                        }
                        title={`${change.courseCode} - ${change.sectionName}`}
                        description={
                          <div>
                            <div><strong>Reason:</strong> {change.reason}</div>
                            {change.oldFaculty && (
                              <div><strong>Previous Teacher:</strong> {change.oldFaculty}</div>
                            )}
                            {change.newFaculty && (
                              <div><strong>New Teacher:</strong> {change.newFaculty}</div>
                            )}
                            {change.type.includes('removed') && (
                              <Tag color="red" style={{ marginTop: 4 }}>
                                Removed from timetable
                              </Tag>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
                {response.data.data.changes.length > 10 && (
                  <p style={{ marginTop: 10, textAlign: 'center', color: '#666' }}>
                    ... and {response.data.data.changes.length - 10} more changes
                  </p>
                )}
              </div>
            ),
          });
        }
      } else {
        message.success('Timetable is synced with current faculty assignments - no changes needed');
      }
      
      await fetchTimetable();
      await fetchCoursesWithTeachers();
      await fetchAllBatchesTimetables();
      await checkSyncStatus();
      await fetchChangesSincePublish();
      
    } catch (error) {
      console.error(' Auto-sync failed:', error);
      message.error('Auto-sync failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(prev => ({ ...prev, sync: false }));
    }
  };

  const checkSyncStatus = async () => {
    if (!timetable?._id) return;
    
    try {
      setLoading(prev => ({ ...prev, sync: true }));
      const response = await axiosInstance.get(
        `${API_URL}/api/timetables/timetables/${timetable._id}/sync-status`
      );
      setSyncStatus(response.data.data);
      
      if (response.data.data.syncStatus.needsSync && autoSyncEnabled) {
        console.log('Changes detected, performing IMMEDIATE auto-sync...');
        await performAutoSync();
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
    } finally {
      setLoading(prev => ({ ...prev, sync: false }));
    }
  };

  const fetchTimetable = async () => {
    try {
      setLoading(prev => ({ ...prev, timetable: true }));
      
      const batchResponse = await axiosInstance.get(`${API_URL}/api/teacher-assignment/batches/${selectedBatch}`);
      const currentBatch = batchResponse.data;
      const actualBatchData = currentBatch.data || currentBatch;
      const currentSemester = actualBatchData.currentSemester || 1;
      
      const response = await axiosInstance.get(
        `${API_URL}/api/timetables/batches/${selectedBatch}/semesters/${currentSemester}/timetable`
      );
      
      if (response.data.data?.timetable) {
        const timetableData = response.data.data.timetable;
        setTimetable(timetableData);
        setTimeSlots(timetableData?.timeSlots || []);
        setChangesSincePublish(timetableData?.changesSincePublish || []);
      } else {
        setTimetable(null);
        setTimeSlots([]);
        setChangesSincePublish([]);
      }
    } catch (error) {
      console.error('Error fetching timetable:', error);
      setTimetable(null);
      setTimeSlots([]);
      setChangesSincePublish([]);
    } finally {
      setLoading(prev => ({ ...prev, timetable: false }));
    }
  };

  const initializeTimetable = async () => {
    try {
      const batchResponse = await axiosInstance.get(`${API_URL}/api/teacher-assignment/batches/${selectedBatch}`);
      const currentBatch = batchResponse.data;
      const actualBatchData = currentBatch.data || currentBatch;
      const currentSemester = actualBatchData.currentSemester || 1;
      
      const academicYear = academicYearDisplay || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
      const timetableName = `${actualBatchData.batchName}_Sem${currentSemester}_${academicYear}`;
      
      const response = await axiosInstance.post(
        `${API_URL}/api/timetables/batches/${selectedBatch}/semesters/${currentSemester}/timetable`,
        {
          timetableName,
          academicYear,
          description: `Timetable for ${actualBatchData.batchName} - Semester ${currentSemester}`,
          timeSlots: []
        }
      );
      
      setTimetable(response.data.data);
      message.success('Timetable initialized successfully');
      
      await fetchAllBatchesTimetables();
      
    } catch (error) {
      console.error('Error initializing timetable:', error);
      message.error('Failed to initialize timetable');
    }
  };

  const publishTimetable = async () => {
    if (!timetable?._id) {
      message.error('No timetable to publish');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, publish: true }));
      
      const response = await axiosInstance.post(
        `${API_URL}/api/timetables/timetables/${timetable._id}/publish`
      );

      if (response.data.success) {
        message.success('Timetable published successfully!');
        await fetchTimetable();
        await fetchPublishedTimetables();
        await fetchChangesSincePublish();
        
        Modal.success({
          title: 'Timetable Published Successfully',
          content: (
            <div>
              <p><strong>{timetable.timetableName}</strong> has been published.</p>
              <p>Faculty timetables have been generated and the timetable is now live.</p>
              <p>Published at: {new Date().toLocaleString()}</p>
            </div>
          ),
        });
      }
    } catch (error) {
      console.error('Error publishing timetable:', error);
      message.error('Failed to publish timetable: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(prev => ({ ...prev, publish: false }));
    }
  };

  const republishTimetable = async () => {
    if (!timetable?._id) {
      message.error('No timetable to republish');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, republish: true }));
      
      const response = await axiosInstance.post(
        `${API_URL}/api/timetables/timetables/${timetable._id}/republish`
      );

      if (response.data.success) {
        message.success('Timetable republished successfully!');
        await fetchTimetable();
        await fetchPublishedTimetables();
        await fetchChangesSincePublish();
        
        Modal.success({
          title: 'Timetable Republished Successfully',
          width: 600,
          content: (
            <div>
              <p><strong>{response.data.data.timetable.timetableName}</strong> has been republished.</p>
              <p>Version: {response.data.data.timetable.version}</p>
              <p>Faculty timetables have been updated.</p>
              <p>Republished at: {new Date().toLocaleString()}</p>
              {response.data.data.timetable.changesApplied && response.data.data.timetable.changesApplied.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <p><strong>Changes Applied:</strong></p>
                  <List
                    size="small"
                    dataSource={response.data.data.timetable.changesApplied.slice(0, 5)}
                    renderItem={(change, index) => (
                      <List.Item>
                        <List.Item.Meta
                          title={`${change.courseCode} - ${change.sectionName}`}
                          description={
                            <div>
                              <div><strong>Type:</strong> {change.type}</div>
                              <div><strong>Reason:</strong> {change.reason}</div>
                              {change.oldFacultyName && (
                                <div><strong>Previous Teacher:</strong> {change.oldFacultyName}</div>
                              )}
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                  {response.data.data.timetable.changesApplied.length > 5 && (
                    <p style={{ marginTop: '8px', textAlign: 'center', color: '#666' }}>
                      ... and {response.data.data.timetable.changesApplied.length - 5} more changes
                    </p>
                  )}
                </div>
              )}
            </div>
          ),
        });
      }
    } catch (error) {
      console.error('Error republishing timetable:', error);
      message.error('Failed to republish timetable: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(prev => ({ ...prev, republish: false }));
    }
  };

  const exportTimetable = async (timetableId, timetableName) => {
    try {
      const response = await axiosInstance.get(
        `${API_URL}/api/timetables/timetables/${timetableId}/export-pdf`,
        {
          responseType: 'blob'
        }
      );

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${timetableName || 'timetable'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('Timetable exported successfully!');
    } catch (error) {
      console.error('Error exporting timetable:', error);
      message.error('Failed to export timetable: ' + (error.response?.data?.message || error.message));
    }
  };

  const createNewTimetableForNextSemester = async () => {
    try {
      const batchResponse = await axiosInstance.get(`${API_URL}/api/teacher-assignment/batches/${selectedBatch}`);
      const currentBatch = batchResponse.data;
      const actualBatchData = currentBatch.data || currentBatch;
      const nextSemester = (actualBatchData.currentSemester || 1) + 1;
      
      if (nextSemester > actualBatchData.totalSemesters) {
        message.error('This batch has completed all semesters');
        return;
      }

      const currentYear = new Date().getFullYear();
      let nextAcademicYearDisplay = '';
      
      if (academicYearDisplay.includes('FALL')) {
        nextAcademicYearDisplay = `SPRING-${currentYear + 1}`;
      } else {
        nextAcademicYearDisplay = `FALL-${currentYear}`;
      }

      const timetableName = `${actualBatchData.batchName}_Sem${nextSemester}_${nextAcademicYearDisplay}`;
      
      const response = await axiosInstance.post(
        `${API_URL}/api/timetables/batches/${selectedBatch}/semesters/${nextSemester}/timetable`,
        {
          timetableName,
          academicYear: nextAcademicYearDisplay,
          description: `Timetable for ${actualBatchData.batchName} - Semester ${nextSemester}`,
          timeSlots: []
        }
      );
      
      setTimetable(response.data.data);
      message.success(`New timetable created for Semester ${nextSemester}`);
      
      await fetchCoursesWithTeachers();
      await fetchTimetable();
      await fetchAllBatchesTimetables();
    } catch (error) {
      console.error('Error creating new timetable:', error);
      message.error('Failed to create new timetable');
    }
  };

  const handleAddTimeSlot = (course, section) => {
    if (!section.canAssignTimeSlot) {
      let reason = "No teacher assigned";
      if (section.facultyName === 'Teacher Inactive/Blocked') {
        reason = "Assigned teacher is inactive or blocked";
      } else if (section.facultyName === 'Teacher Status Unknown') {
        reason = "Teacher status could not be verified";
      }
      
      Modal.warning({
        title: 'Cannot Add Time Slot',
        content: (
          <div>
            <p><strong>{course.courseName} - {section.sectionName}</strong></p>
            <p>Reason: {reason}</p>
            <p>Please assign an active teacher to this course-section before adding time slots.</p>
          </div>
        ),
      });
      return;
    }

    setCurrentTimeSlot({
      courseCode: course.courseCode,
      courseName: course.courseName,
      sectionName: section.sectionName,
      facultyName: section.facultyName,
      facultyId: section.facultyId,
      classType: 'lecture'
    });
    setIsTimeSlotModalVisible(true);
  };

  const calculateWeeklyHoursForCourse = (courseCode, sectionName) => {
    const courseSlots = timeSlots.filter(
      slot => slot.courseCode === courseCode && slot.sectionName === sectionName
    );
    
    let totalMinutes = 0;
    courseSlots.forEach(slot => {
      const [startHour, startMinute] = slot.startTime.split(':').map(Number);
      const [endHour, endMinute] = slot.endTime.split(':').map(Number);
      
      const startTotalMinutes = startHour * 60 + startMinute;
      const endTotalMinutes = endHour * 60 + endMinute;
      
      totalMinutes += (endTotalMinutes - startTotalMinutes);
    });
    
    return totalMinutes / 60;
  };

  const handleSaveTimeSlot = async (values) => {
    try {
      if (!timetable) {
        message.error('Please initialize timetable first');
        return;
      }

      const [startTime, endTime] = values.timeSlot.split('-');
      
      const timeSlotData = {
        day: values.day,
        startTime: startTime,
        endTime: endTime,
        room: values.room,
        classType: values.classType,
        courseCode: currentTimeSlot?.courseCode,
        sectionName: currentTimeSlot?.sectionName,
        isActive: true
      };

      let response;
      if (currentTimeSlot?._id) {
        response = await axiosInstance.put(
          `${API_URL}/api/timetables/timetables/${timetable._id}/slots/${currentTimeSlot._id}`,
          timeSlotData
        );
        message.success('Time slot updated successfully');
      } else {
        response = await axiosInstance.post(
          `${API_URL}/api/timetables/timetables/${timetable._id}/slots`,
          timeSlotData
        );
        message.success('Time slot added successfully');
      }

      setIsTimeSlotModalVisible(false);
      form.resetFields();
      setCurrentTimeSlot(null);
      
      await fetchTimetable();
      await fetchAllBatchesTimetables();
      await fetchChangesSincePublish();
      
      if (response.data.needsRepublish) {
        message.warning('Changes made to published timetable. Please republish to update faculty records.');
      }
      
    } catch (error) {
      console.error('Error saving time slot:', error);
      const errorMessage = error.response?.data?.message || 'Failed to save time slot';
      
      if (error.response?.data?.conflicts) {
        const conflicts = error.response.data.conflicts;
        let conflictDetails = '';
        
        if (Array.isArray(conflicts)) {
          conflicts.forEach(conflict => {
            if (conflict.type === 'faculty') {
              conflictDetails += ` Faculty Conflict: ${conflict.facultyName} is already teaching ${conflict.courseCode} in ${conflict.room} at ${conflict.time}\n`;
            } else if (conflict.type === 'room') {
              conflictDetails += ` Room Conflict: ${conflict.room} is already occupied by ${conflict.courseCode} (${conflict.facultyName}) at ${conflict.time}\n`;
            } else if (conflict.type === 'section') {
              conflictDetails += `👥 Section Conflict: ${conflict.sectionName} is already studying ${conflict.courseCode} at ${conflict.time}\n`;
            } else if (conflict.type === 'weekly_hours') {
              conflictDetails += ` Weekly Hours: ${conflict.courseCode}-${conflict.sectionName} already has ${conflict.currentHours} hours, adding ${conflict.additionalHours} would exceed 2 hours per week\n`;
            }
          });
        }
        
        Modal.error({
          title: 'Scheduling Conflict Detected',
          content: (
            <div>
              <p style={{ marginBottom: '16px', fontWeight: 'bold' }}>{errorMessage}</p>
              <pre style={{ 
                whiteSpace: 'pre-wrap', 
                background: '#f5f5f5', 
                padding: '16px', 
                borderRadius: '6px',
                border: '1px solid #d9d9d9',
                fontSize: '14px',
                lineHeight: '1.5'
              }}>
                {conflictDetails}
              </pre>
            </div>
          ),
          width: 600,
        });
      } else {
        message.error(errorMessage);
      }
    }
  };

  const handleDeleteTimeSlot = async (slotId) => {
    try {
      if (!timetable?._id) {
        message.error('Timetable not found');
        return;
      }

      Modal.confirm({
        title: 'Are you sure you want to delete this time slot?',
        content: 'This action cannot be undone.',
        okText: 'Yes, Delete',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: async () => {
          try {
            const response = await axiosInstance.delete(
              `${API_URL}/api/timetables/timetables/${timetable._id}/slots/${slotId}`
            );
            
            message.success('Time slot deleted successfully');
            await fetchTimetable();
            await fetchAllBatchesTimetables();
            await fetchChangesSincePublish();
            
            // Show republish prompt if needed
            if (response.data.needsRepublish) {
              message.warning('Changes made to published timetable. Please republish to update faculty records.');
            }
          } catch (error) {
            console.error('Error deleting time slot:', error);
            message.error('Failed to delete time slot');
          }
        }
      });
    } catch (error) {
      console.error('Error in delete confirmation:', error);
      message.error('Error initiating delete');
    }
  };

  const generateTimetableGrid = () => {
    const grid = {};
    
    days.forEach(day => {
      grid[day] = {};
      timeOptions.forEach(time => {
        grid[day][time] = {};
        roomOptions.forEach(room => {
          const currentBatchSlots = timeSlots.filter(slot => {
            const slotTimeRange = `${slot.startTime}-${slot.endTime}`;
            const currentTimeStart = time.split('-')[0];
            const currentTimeEnd = time.split('-')[1];
            
            const basicMatch = 
              slot.day.toUpperCase() === day &&
              slot.room === room;
            
            const timeOverlap = 
              currentTimeStart >= slot.startTime && 
              currentTimeEnd <= slot.endTime;
            
            return basicMatch && timeOverlap;
          });

          const otherBatchesSlots = [];
          Object.entries(allBatchesTimetables).forEach(([batchId, batchTimetable]) => {
            if (batchId !== selectedBatch && batchTimetable?.timeSlots) {
              const batchSlots = batchTimetable.timeSlots.filter(slot => {
                const slotTimeRange = `${slot.startTime}-${slot.endTime}`;
                const currentTimeStart = time.split('-')[0];
                const currentTimeEnd = time.split('-')[1];
                
                const basicMatch = 
                  slot.day.toUpperCase() === day &&
                  slot.room === room &&
                  slot.isActive;
                
                const timeOverlap = 
                  currentTimeStart >= slot.startTime && 
                  currentTimeEnd <= slot.endTime;
                
                return basicMatch && timeOverlap;
              });

              if (batchSlots.length > 0) {
                batchSlots.forEach(slot => {
                  otherBatchesSlots.push({
                    ...slot,
                    batchId: batchId,
                    batchName: allBatchesDetails[batchId]?.batchName || 'Unknown Batch',
                    currentSemester: allBatchesDetails[batchId]?.currentSemester || 'N/A',
                    isOtherBatch: true
                  });
                });
              }
            }
          });

          grid[day][time][room] = {
            currentBatchSlots,
            otherBatchesSlots
          };
        });
      });
    });

    return grid;
  };

  const timetableGrid = generateTimetableGrid();

  const renderRepublishControls = () => {
    if (timetable?.status !== 'needs_republish') return null;

    return (
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RedoOutlined style={{ color: '#faad14' }} />
            <span>Republish Required</span>
            <Badge count={changesSincePublish.length} showZero style={{ backgroundColor: '#faad14' }} />
          </div>
        }
        style={{ marginBottom: 16, border: '1px solid #faad14' }}
        extra={
          <Button 
            type="primary"
            icon={<RedoOutlined />}
            onClick={republishTimetable}
            loading={loading.republish}
            style={{ backgroundColor: '#957bab', borderColor: '#957bab' }}
          >
            Republish Now
          </Button>
        }
      >
        <Alert
          message="Timetable has changes since last publish"
          description={
            <div>
              <p>The following changes require republishing to update faculty records:</p>
              <List
                size="small"
                dataSource={changesSincePublish.slice(0, 3)}
                renderItem={(change, index) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<InfoCircleOutlined style={{ color: '#1890ff' }} />}
                      title={`${change.courseCode} - ${change.sectionName}`}
                      description={
                        <div>
                          <div><strong>Type:</strong> {change.type}</div>
                          <div><strong>Reason:</strong> {change.reason}</div>
                          {change.oldFacultyName && (
                            <div><strong>Previous Teacher:</strong> {change.oldFacultyName}</div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
              {changesSincePublish.length > 3 && (
                <p style={{ marginTop: '8px', fontStyle: 'italic' }}>
                  ... and {changesSincePublish.length - 3} more changes
                </p>
              )}
            </div>
          }
          type="warning"
          showIcon
        />
      </Card>
    );
  };

  const renderSyncControls = () => (
    <Card 
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SyncOutlined />
          Faculty Assignment Sync
          <Badge 
            count={syncStatus?.syncStatus?.changeCount || 0} 
            showZero 
            style={{ 
              backgroundColor: syncStatus?.syncStatus?.needsSync ? '#ff4d4f' : '#52c41a',
              marginLeft: '8px'
            }} 
          />
          <Tag color={autoSyncEnabled ? 'green' : 'orange'}>
            {autoSyncEnabled ? 'AUTO SYNC ON' : 'AUTO SYNC OFF'}
          </Tag>
        </div>
      } 
      style={{ marginBottom: 16 }}
      extra={
        <Space>
          <Switch
            checked={autoSyncEnabled}
            onChange={setAutoSyncEnabled}
            checkedChildren="Auto"
            unCheckedChildren="Manual"
          />
          <Button 
            icon={<SyncOutlined />}
            onClick={checkSyncStatus}
            loading={loading.sync}
          >
            Check Status
          </Button>
          <Button 
            type="primary"
            icon={<SyncOutlined />}
            onClick={performAutoSync}
            loading={loading.sync}
            style={{ backgroundColor: '#957bab', borderColor: '#957bab' }}
            danger={syncStatus?.syncStatus?.needsSync}
          >
            Sync Now
          </Button>
        </Space>
      }
    >
      {syncStatus ? (
        <Alert
          message={
            syncStatus.syncStatus.needsSync ? 
            `Sync Required: ${syncStatus.syncStatus.changeCount} changes pending` :
            'Ensure to Sync for updated data, Timetable is synced with current faculty assignments'
          }
          type={syncStatus.syncStatus.needsSync ? 'warning' : 'success'}
          showIcon
          description={
            syncStatus.syncStatus.needsSync ? (
              <div>
                <p><strong>Only courses with actual changes will be affected:</strong></p>
                <List
                  size="small"
                  dataSource={syncStatus.syncStatus.pendingChanges.slice(0, 3)}
                  renderItem={(change, index) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                        title={`${change.courseCode} - ${change.sectionName}`}
                        description={
                          <div>
                            <div>{change.reason}</div>
                            {change.type === 'remove_course' && (
                              <Tag color="orange" style={{ marginTop: 4, fontSize: '10px' }}>
                                Teacher Changed
                              </Tag>
                            )}
                            {change.type === 'remove_faculty_inactive' && (
                              <Tag color="red" style={{ marginTop: 4, fontSize: '10px' }}>
                                Faculty Inactive
                              </Tag>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
                {syncStatus.syncStatus.pendingChanges.length > 3 && (
                  <p style={{ marginTop: '8px', fontStyle: 'italic' }}>
                    ... and {syncStatus.syncStatus.pendingChanges.length - 3} more changes
                  </p>
                )}
                {autoSyncEnabled && (
                  <p style={{ marginTop: '8px', fontStyle: 'italic', color: '#1890ff' }}>
                    Auto-sync will apply these changes automatically...
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p>Last sync: {new Date(syncStatus.lastSync).toLocaleString()}</p>
              </div>
            )
          }
        />
      ) : (
        <Alert
          message="Sync status unavailable"
          description="Select a batch and load timetable to check sync status."
          type="info"
          showIcon
        />
      )}
    </Card>
  );

  const renderValidityStatus = () => {
    if (!validityStatus || !semesterDates) return null;

    const showNewTimetableButton = validityStatus.status === 'expired' && validityStatus.daysRemaining < 0;

    return (
      <Card 
        title="Timetable Validity" 
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Tag color={validityStatus.color} icon={validityStatus.icon}>
              {validityStatus.message}
            </Tag>
            {showNewTimetableButton && (
              <Button 
                type="primary" 
                size="small"
                style={{backgroundColor:'#957bab', borderColor: '#957bab'}}
                onClick={createNewTimetableForNextSemester}
              >
                Create New Timetable
              </Button>
            )}
          </Space>
        }
      >
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="Academic Year"
              value={academicYearDisplay}
              prefix={<CalendarOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Current Semester"
              value={semesterDates.currentSemester}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Valid Until"
              value={validityStatus.endDate}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Days Remaining"
              value={validityStatus.daysRemaining}
              valueStyle={{ 
                color: validityStatus.status === 'expired' ? '#cf1322' : 
                       validityStatus.status === 'critical' ? '#cf1322' :
                       validityStatus.status === 'warning' ? '#faad14' : '#52c41a'
              }}
              prefix={<ClockCircleOutlined />}
            />
          </Col>
        </Row>
        {validityStatus.status === 'expired' && (
          <Alert
            message="Timetable Expired"
            description="This timetable has expired. Please create a new timetable for the current semester."
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
        {validityStatus.status === 'critical' && (
          <Alert
            message="Timetable Expiring Soon"
            description="This timetable will expire soon. Consider updating it for the next semester."
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>
    );
  };

  // UPDATED: Render course table with faculty status
  const renderCourseTable = () => {
    const columns = [
      {
        title: 'Section',
        dataIndex: 'sectionName',
        key: 'sectionName',
        width: 100,
      },
      {
        title: 'Course Name',
        dataIndex: 'courseName',
        key: 'courseName',
        width: 250
      },
      {
        title: 'Course Code',
        dataIndex: 'courseCode',
        key: 'courseCode',
        width: 120
      },
      {
        title: 'Weekly Hours',
        key: 'weeklyHours',
        width: 100,
        render: (_, record) => {
          const weeklyHours = calculateWeeklyHoursForCourse(record.courseCode, record.sectionName);
          const isMaxReached = weeklyHours >= 2;
          return (
            <Tag color={isMaxReached ? '#970505' : weeklyHours > 0 ? 'orange' : 'default'}>
              {weeklyHours.toFixed(1)} / 2 hrs
            </Tag>
          );
        }
      },
      {
        title: 'Assigned Teacher',
        dataIndex: 'facultyName',
        key: 'facultyName',
        width: 200,
        render: (text, record) => {
          let color = '#970505';
          let icon = <CloseCircleOutlined />;
          
          if (record.isFacultyActive) {
            color = '#0f5505';
            icon = <UserOutlined />;
          } else if (text === 'No Teacher Assigned') {
            color = '#8c8c8c';
            icon = <UserOutlined />;
          } else if (text === 'Teacher Inactive/Blocked') {
            color = '#cf1322';
            icon = <CloseCircleOutlined />;
          }
          
          return (
            <Tag color={color} icon={icon}>
              {text}
            </Tag>
          );
        }
      },
      {
        title: 'Teacher Status',
        key: 'teacherStatus',
        width: 120,
        render: (_, record) => (
          <Tag color={record.canAssignTimeSlot ? 'green' : 'red'}>
            {record.canAssignTimeSlot ? 'Can Add Slot' : 'Cannot Add Slot'}
          </Tag>
        )
      },
      {
        title: 'Actions',
        key: 'action',
        width: 150,
        render: (_, record) => {
          const weeklyHours = calculateWeeklyHoursForCourse(record.courseCode, record.sectionName);
          const isMaxReached = weeklyHours >= 2;
          const canAddSlot = record.canAssignTimeSlot && !isMaxReached;
          
          return (
            <Tooltip
              title={
                !record.canAssignTimeSlot ? 
                  'No active teacher assigned' : 
                  isMaxReached ? 
                  'Maximum weekly hours reached' : 
                  'Add time slot'
              }
            >
              <Button
                type="primary"
                style={{backgroundColor:'#957bab', borderColor: '#957bab'}}
                icon={<PlusOutlined />}
                onClick={() => handleAddTimeSlot(record, record)}
                disabled={!timetable || validityStatus?.status === 'expired' || !canAddSlot}
                size="small"
              >
                {isMaxReached ? 'Max Hours' : 'Add Slot'}
              </Button>
            </Tooltip>
          );
        }
      }
    ];

    const tableData = courses.flatMap(course => 
      course.sections.map(section => ({
        key: `${course.courseCode}-${section.sectionName}`,
        courseCode: course.courseCode,
        courseName: course.courseName,
        sectionName: section.sectionName,
        facultyName: section.facultyName,
        facultyId: section.facultyId,
        isFacultyActive: section.isFacultyActive,
        canAssignTimeSlot: section.canAssignTimeSlot,
        creditHrs: course.creditHrs,
        type: course.type
      }))
    );

    // Calculate statistics
    const totalSections = tableData.length;
    const sectionsWithActiveTeachers = tableData.filter(item => item.canAssignTimeSlot).length;
    const sectionsWithoutTeachers = tableData.filter(item => !item.canAssignTimeSlot).length;

    return (
      <Card 
        title={
          <div>
            Course Sections 
            <span style={{ marginLeft: '8px', fontSize: '14px', color: '#666' }}>
              ({sectionsWithActiveTeachers}/{totalSections} with active teachers)
            </span>
          </div>
        } 
        style={{ marginBottom: 24 }}
        extra={
          <Space>
            {!timetable && selectedBatch && (
              <Button 
                type="primary" 
                style={{backgroundColor:'#957bab', borderColor: '#957bab'}}
                onClick={initializeTimetable}
                size="small"
              >
                Initialize Timetable
              </Button>
            )}
            {timetable && timetable.status === 'draft' && (
              <Button 
                type="primary" 
                icon={<SendOutlined />}
                onClick={publishTimetable}
                loading={loading.publish}
                disabled={timeSlots.length === 0}
                style={{backgroundColor:'#957bab', borderColor: '#957bab'}}
              >
                Publish Timetable
              </Button>
            )}
            {timetable && timetable.status === 'published' && (
              <Button 
                type="primary" 
                icon={<SendOutlined />}
                disabled
                style={{backgroundColor:'#52c41a', borderColor: '#52c41a'}}
              >
                Published
              </Button>
            )}
            {timetable && timetable.status === 'needs_republish' && (
              <Button 
                type="primary"
                icon={<RedoOutlined />}
                onClick={republishTimetable}
                loading={loading.republish}
                style={{ backgroundColor: '#957bab', borderColor: '#957bab' }}
              >
                Republish
              </Button>
            )}
          </Space>
        }
      >
        {/* Statistics Row */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="Total Sections"
                value={totalSections}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="With Active Teachers"
                value={sectionsWithActiveTeachers}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="Need Teacher Assignment"
                value={sectionsWithoutTeachers}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>

        {selectedBatch ? (
          <Table
            columns={columns}
            dataSource={tableData}
            pagination={false}
            scroll={{ x: 1000 }}
            loading={loading.courses}
            locale={{
              emptyText: courses.length === 0 ? 'No courses found for this batch' : 'No data'
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <CalendarOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
            <div>Please select a batch to view courses</div>
          </div>
        )}
      </Card>
    );
  };

  const renderTimetableGrid = () => {
    const columns = [
      {
        title: 'DAY',
        dataIndex: 'day',
        key: 'day',
        width: 120,
        fixed: 'left',
        render: (day) => (
          <div style={{ fontWeight: 'bold', textAlign: 'center' }}>
            {day}
          </div>
        )
      },
      {
        title: 'TIME',
        dataIndex: 'time',
        key: 'time',
        width: 100,
        fixed: 'left',
        render: (time) => (
          <div style={{ fontWeight: 'bold', textAlign: 'center' }}>
            {time}
          </div>
        )
      },
      ...roomOptions.map(room => ({
        title: room,
        dataIndex: room,
        key: room,
        width: 250,
        render: (slotData) => (
          <div style={{ minHeight: '80px' }}>
            {slotData.currentBatchSlots && slotData.currentBatchSlots.map((slot, index) => (
              <Tooltip
                key={`current-${slot._id || index}`}
                title={
                  <div>
                    <div><strong>{slot.courseCode} - {slot.courseName}</strong></div>
                    <div>Section: {slot.sectionName}</div>
                    <div>Teacher: {slot.facultyName}</div>
                    <div>Time: {slot.startTime}-{slot.endTime}</div>
                    <div>Type: {slot.classType}</div>
                    <div>Room: {slot.room}</div>
                    <div>Batch: {batchDetails?.batchName} (Current)</div>
                    <div>Semester: {batchDetails?.currentSemester || 'N/A'}</div>
                    {timetable?.status === 'published' && (
                      <div><Tag color="green">PUBLISHED</Tag></div>
                    )}
                    {timetable?.status === 'needs_republish' && (
                      <div><Tag color="orange">NEEDS REPUBLISH</Tag></div>
                    )}
                  </div>
                }
              >
                <Card
                  size="small"
                  style={{ 
                    marginBottom: '4px',
                    backgroundColor: getCourseColor(slot.courseCode),
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  bodyStyle={{ padding: '6px' }}
                >
                  <div style={{ fontSize: '11px', lineHeight: '1.2' }}>
                    <div><strong>{slot.courseName}</strong></div>
                    <div style={{fontWeight: 'bold'}}>
                     Semester {batchDetails?.currentSemester || 'N/A'} {slot.sectionName} 
                    </div>
                    <div style={{ fontType:'bold', fontSize: '10px', opacity: 0.9 }}>
                      {slot.facultyName} - {slot.classType}
                    </div>
                    <div style={{ marginTop: '2px', display: 'flex', gap: '2px' }}>
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        size="small"
                        style={{ color: 'white', padding: 0, minWidth: 'auto', height: 'auto', fontSize: '9px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentTimeSlot({
                            ...slot,
                            courseName: slot.courseName,
                            facultyName: slot.facultyName,
                            facultyId: slot.facultyId
                          });
                          form.setFieldsValue({
                            timeSlot: `${slot.startTime}-${slot.endTime}`,
                            day: slot.day,
                            room: slot.room,
                            classType: slot.classType
                          });
                          setIsTimeSlotModalVisible(true);
                        }}
                        disabled={validityStatus?.status === 'expired'}
                      />
                      <Popconfirm
                        title="Are you sure to delete this time slot?"
                        onConfirm={(e) => {
                          e?.stopPropagation();
                          handleDeleteTimeSlot(slot._id);
                        }}
                        onCancel={(e) => e?.stopPropagation()}
                        okText="Yes"
                        cancelText="No"
                        disabled={validityStatus?.status === 'expired'}
                      >
                        <Button
                          type="text"
                          icon={<DeleteOutlined />}
                          size="small"
                          style={{ color: 'white', padding: 0, minWidth: 'auto', height: 'auto', fontSize: '9px' }}
                          onClick={(e) => e.stopPropagation()}
                          disabled={validityStatus?.status === 'expired'}
                        />
                      </Popconfirm>
                    </div>
                  </div>
                </Card>
              </Tooltip>
            ))}
            
            {slotData.otherBatchesSlots && slotData.otherBatchesSlots.map((slot, index) => (
              <Tooltip
                key={`other-${slot.batchId}-${slot._id || index}`}
                title={
                  <div>
                    <div><strong>{slot.courseName} </strong></div>
                    <div>Course Code: {slot.courseCode}</div>
                    <div>Section: {slot.sectionName}</div>
                    <div>Teacher: {slot.facultyName}</div>
                    <div>Time: {slot.startTime}-{slot.endTime}</div>
                    <div>Type: {slot.classType}</div>
                    <div>Room: {slot.room}</div>
                    <div>Batch: {slot.batchName}</div>
                    <div>Semester: {slot.currentSemester}</div>
                    <div style={{ marginTop: '8px', padding: '4px', background: '#f0f0f0', borderRadius: '4px' }}>
                      <small>Other Batch</small>
                    </div>
                  </div>
                }
              >
                <Card
                  size="small"
                  style={{ 
                    marginBottom: '4px',
                    backgroundColor: '#f8f9fa',
                    color: '#495057',
                    border: '1px solid #dee2e6',
                    cursor: 'pointer'
                  }}
                  bodyStyle={{ padding: '4px' }}
                >
                  <div style={{ fontSize: '10px', lineHeight: '1.2' }}>
                    <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                    {slot.courseName}
                    </div>
                    <div style={{ fontWeight: 'bold', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Semester {slot.currentSemester} {slot.sectionName}</span>
                    </div>
                    <div style={{ fontWeight: 'bold',fontSize: '10px', color: '#6c757d', fontStyle: 'italic' }}>
                      {slot.facultyName} - {slot.classType}
                    </div>
                    <div style={{ fontSize: '10px', color: '#adb5bd', marginTop: '4px' }}>
                      <Tag color="#957bab" style={{ fontSize: '10px', padding: '2px 2px', lineHeight: '1' }}>
                        {slot.batchName}
                      </Tag>
                    </div>
                  </div>
                </Card>
              </Tooltip>
            ))}
          </div>
        )
      }))
    ];

    const dataSource = days.flatMap(day => 
      timeOptions.map(time => ({
        key: `${day}-${time}`,
        day: day,
        time: time,
        ...timetableGrid[day][time]
      }))
    );

    return (
      <Card 
        title={
          <div>
            Timetable {timetable ? `- ${timetable.timetableName}` : ''}
            {timetable?.status === 'published' && (
              <Tag color="green" style={{ marginLeft: '8px' }}>
                PUBLISHED
              </Tag>
            )}
            {timetable?.status === 'needs_republish' && (
              <Tag color="orange" style={{ marginLeft: '8px' }}>
                NEEDS REPUBLISH
              </Tag>
            )}
          </div>
        }
        loading={loading.timetable || loading.allBatches}
        style={{ overflowX: 'auto' }}
        extra={
          <Space>
            {timetable?.status === 'published' && (
              <Tag color="green">
                Published {timetable.lastPublishedAt ? new Date(timetable.lastPublishedAt).toLocaleDateString() : ''}
              </Tag>
            )}
            {timetable?.status === 'needs_republish' && (
              <Tag color="orange">
                Version {timetable.version} • {changesSincePublish.length} changes
              </Tag>
            )}
            <Tag color="#957bab">
              Showing: {Object.keys(allBatchesTimetables).filter(id => id !== selectedBatch && allBatchesTimetables[id]).length} Batches
            </Tag>
          </Space>
        }
      >
        {selectedBatch ? (
          timetable ? (
            <>
              {renderValidityStatus()}
              {renderRepublishControls()}
              {renderSyncControls()}
              
              <Table
                columns={columns}
                dataSource={dataSource}
                pagination={false}
                scroll={{ x: 2500 }}
                bordered
                size="small"
                components={{
                  body: {
                    cell: (props) => (
                      <td 
                        {...props} 
                        style={{ 
                          ...props.style,
                          border: '1px solid #f0f0f0',
                          padding: '4px 8px',
                          verticalAlign: 'top'
                        }}
                      />
                    ),
                  },
                }}
                locale={{
                  emptyText: 'No time slots scheduled. Add time slots using the "Add Slot" button above.'
                }}
              />
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', background: '#fafafa', borderRadius: '8px' }}>
              <CalendarOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
              <p style={{ color: '#999', marginBottom: '16px' }}>
                No timetable initialized for this batch and semester.
              </p>
              <Button type="primary" style={{backgroundColor:'#957bab', borderColor: '#957bab'}} onClick={initializeTimetable}>
                Initialize Timetable
              </Button>
            </div>
          )
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <CalendarOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
            <div>Please select a batch to view timetable</div>
          </div>
        )}
      </Card>
    );
  };

  const renderPublishedTimetables = () => {
    const columns = [
      {
        title: 'Timetable Name',
        dataIndex: 'timetableName',
        key: 'timetableName',
        render: (name, record) => (
          <div>
            <strong>{name}</strong>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {record.batchId?.batchName} - Semester {record.semester}
            </div>
          </div>
        )
      },
      {
        title: 'Department',
        dataIndex: 'department',
        key: 'department',
      },
      {
        title: 'Academic Year',
        dataIndex: 'academicYear',
        key: 'academicYear',
      },
      {
        title: 'Time Slots',
        key: 'timeSlots',
        render: (_, record) => (
          <Tag color="blue">
            {record.timeSlots?.filter(slot => slot.isActive).length || 0} slots
          </Tag>
        )
      },
      {
        title: 'Published Date',
        key: 'lastPublishedAt',
        render: (_, record) => (
          <div>
            {record.lastPublishedAt ? new Date(record.lastPublishedAt).toLocaleDateString() : 'N/A'}
          </div>
        )
      },
      {
        title: 'Status',
        key: 'status',
        render: (_, record) => (
          <Tag color={
            record.status === 'published' ? 'green' : 
            record.status === 'needs_republish' ? 'orange' : 'default'
          }>
            {record.status?.toUpperCase()}
          </Tag>
        )
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_, record) => (
          <Space>
            <Button 
              icon={<EyeOutlined />} 
              size="small"
              onClick={() => {
                setSelectedBatch(record.batchId._id);
                setActiveTab('manage');
              }}
            >
              View
            </Button>
            <Button 
              icon={<FilePdfOutlined />} 
              size="small"
              type="primary"
              style={{backgroundColor:'#957bab', borderColor: '#957bab'}}
              onClick={() => exportTimetable(record._id, record.timetableName)}
            >
              Export
            </Button>
          </Space>
        )
      }
    ];

    return (
      <Card title="Published Timetables">
        <Table
          columns={columns}
          dataSource={publishedTimetables}
          rowKey="_id"
          pagination={{ pageSize: 10 }}
          loading={loading.timetable}
        />
      </Card>
    );
  };

  const getCourseColor = (courseCode) => {
    const colors = [
      '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
      '#fa541c', '#13c2c2', '#eb2f96', '#a0d911', '#2f54eb',
      '#fa8c16', '#a0d911', '#1890ff', '#52c41a', '#faad14'
    ];
    const index = courseCode?.charCodeAt(0) % colors.length || 0;
    return colors[index];
  };

  return (
    <div className="Timetable-Management container mt-5">
      <h2 className="Timetable-Management-title ">Timetable Management</h2>
     
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Manage Timetables" key="manage">
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

          {batchDetails && (
            <div className="batch-details-container">
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
                    <span className="detail-label">Current Semester:</span> {batchDetails.currentSemester}
                  </div>
                </div>
                
                <div className="row mb-3">
                  <div className="col-md-4 col-6 detail-item">
                    <span className="detail-label">Sections:</span> {batchDetails.sectionNames?.join(', ') || 'No sections'}
                  </div>
                  <div className="col-md-4 col-6 detail-item">
                    <span className="detail-label">Academic Year:</span> {academicYearDisplay}
                  </div>
                  <div className="col-md-4 col-6 detail-item">
                    {semesterDates && (
                      <div>
                        <span className="detail-label">Semester End:</span> 
                        <span className="date-range">
                          {new Date(semesterDates.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <hr className="divider" />

          {renderCourseTable()}
          {renderTimetableGrid()}
        </TabPane>

        <TabPane tab="Published Timetables" key="published">
          {renderPublishedTimetables()}
        </TabPane>
      </Tabs>

      <Modal
        title={currentTimeSlot?._id ? "Edit Time Slot" : "Add Time Slot"}
        open={isTimeSlotModalVisible}
        onCancel={() => {
          setIsTimeSlotModalVisible(false);
          form.resetFields();
          setCurrentTimeSlot(null);
        }}
        footer={null}
        width={500}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveTimeSlot}
          initialValues={{
            classType: 'lecture'
          }}
        >
          <Form.Item label="Course">
            <Input value={currentTimeSlot?.courseName} disabled />
          </Form.Item>
          
          <Form.Item label="Section">
            <Input value={currentTimeSlot?.sectionName} disabled />
          </Form.Item>

          <Form.Item label="Teacher">
            <Input 
              value={currentTimeSlot?.facultyName} 
              disabled 
              addonBefore={<UserOutlined />}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="timeSlot"
                label="Time Slot"
                rules={[{ required: true, message: 'Please select time slot' }]}
              >
                <Select placeholder="Select time slot">
                  {timeOptions.map(time => (
                    <Option key={time} value={time}>{time}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="day"
                label="Day"
                rules={[{ required: true, message: 'Please select day' }]}
              >
                <Select placeholder="Select day">
                  {days.map(day => (
                    <Option key={day} value={day.toLowerCase()}>{day}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="classType"
                label="Class Type"
                rules={[{ required: true, message: 'Please select class type' }]}
              >
                <Select placeholder="Select class type">
                  <Option value="lecture">Lecture</Option>
                  <Option value="lab">Lab</Option>
                  <Option value="tutorial">Tutorial</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="room"
                label="Room"
                rules={[{ required: true, message: 'Please select room' }]}
              >
                <Select 
                  placeholder="Select room" 
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {roomOptions.map(room => (
                    <Option key={room} value={room}>{room}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => {
              setIsTimeSlotModalVisible(false);
              form.resetFields();
              setCurrentTimeSlot(null);
            }} style={{ marginRight: 8 }}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" style={{backgroundColor:'#957bab', borderColor: '#957bab'}}>
              {currentTimeSlot?._id ? 'Update' : 'Add'} Time Slot
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TimetableManagement;