import React, { useState, useEffect } from 'react';
import axiosInstance  from '../../../axiosConfig';
import API_URL from '../../../config';

import { 
  Card, Table, Button, Tag, Space, Input, Select, 
  Row, Col, Typography, Spin, Empty, Tooltip, Tabs,
  Badge, Modal, List, Avatar, Progress, Descriptions,
  Collapse, Divider
} from 'antd';
import { 
  SearchOutlined, SyncOutlined, EyeOutlined, 
  CheckCircleOutlined, ClockCircleOutlined, UserOutlined,
  BookOutlined, TeamOutlined, FileDoneOutlined,
  FilterOutlined, ClearOutlined, CalendarOutlined,
  DownloadOutlined, HistoryOutlined, AppstoreOutlined,
  ClusterOutlined, DatabaseOutlined, ApartmentOutlined,
  ScheduleOutlined, IdcardOutlined
} from '@ant-design/icons';
import "../../../assets/style.css";
const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { Panel } = Collapse;

const AllBatchesTimetable = () => {
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedDegree, setSelectedDegree] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [allBatchesTimetables, setAllBatchesTimetables] = useState({});
  const [allBatchesDetails, setAllBatchesDetails] = useState({});
  const [publishedTimetables, setPublishedTimetables] = useState({});
  const [facultyTimetables, setFacultyTimetables] = useState([]);
  const [facultyData, setFacultyData] = useState({});
  const [loading, setLoading] = useState({
    degree: false,
    department: false,
    batch: false,
    batches: false,
    faculty: false,
    facultyStatus: false
  });
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('master');
  const [searchText, setSearchText] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [selectedDay, setSelectedDay] = useState('all');
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [facultyDetailModal, setFacultyDetailModal] = useState(false);
  const [loadingFacultyDetail, setLoadingFacultyDetail] = useState(false);
  const [facultyDetailData, setFacultyDetailData] = useState(null);
  const [facultyFilter, setFacultyFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [academicYearFilter, setAcademicYearFilter] = useState('all');
  const [facultyGroupedData, setFacultyGroupedData] = useState([]);
  const [academicYearStats, setAcademicYearStats] = useState({});

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

  useEffect(() => {
    if (selectedDegree) {
      fetchDepartments();
    } else {
      setDepartments([]);
      setSelectedDepartment('');
      setBatches([]);
      setSelectedBatch('');
    }
  }, [selectedDegree]);

  useEffect(() => {
    if (selectedDepartment) {
      fetchBatches();
      fetchAllBatchesTimetables();
      fetchFacultyTimetables();
      fetchAllFacultyStatus();
    } else {
      setBatches([]);
      setSelectedBatch('');
      setAllBatchesTimetables({});
      setAllBatchesDetails({});
      setFacultyTimetables([]);
      setFacultyData({});
      setFacultyGroupedData([]);
      setAcademicYearStats({});
    }
  }, [selectedDepartment]);

  const fetchDegreeLevels = async () => {
    try {
      setLoading(prev => ({ ...prev, degree: true }));
      const response = await axiosInstance.get(`${API_URL}/api/degree-levels`);
      
      let degreeData = [];
      if (Array.isArray(response.data)) {
        degreeData = response.data;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        degreeData = response.data.data;
      }
      
      const formattedDegreeLevels = degreeData.map(level => ({
        value: level.name || level.degreeLevelName || level,
        label: level.name || level.degreeLevelName || level
      })).filter(level => level.value);
      
      setDegreeLevels(formattedDegreeLevels);
    } catch (error) {
      console.error('Error fetching degree levels:', error);
    } finally {
      setLoading(prev => ({ ...prev, degree: false }));
    }
  };

  const fetchDepartments = async () => {
    try {
      if (!selectedDegree) return;

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
      
      const formattedDepartments = departmentsData.map(dept => ({
        value: dept.departmentName || dept.name || dept,
        label: dept.departmentName || dept.name || dept
      })).filter(dept => dept.value);
      
      setDepartments(formattedDepartments);
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(prev => ({ ...prev, department: false }));
    }
  };

  const fetchBatches = async () => {
    if (!selectedDepartment) return;
    
    try {
      setLoading(prev => ({ ...prev, batch: true }));
      const response = await axiosInstance.get(`${API_URL}/api/timetables/batches`, {
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

  const fetchAllFacultyStatus = async () => {
    if (!selectedDepartment) return;
    
    try {
      setLoading(prev => ({ ...prev, facultyStatus: true }));
      
      const facultyResponse = await axiosInstance.get(`${API_URL}/api/faculty`, {
        params: { department: selectedDepartment }
      });
      
      if (facultyResponse.data.success) {
        const facultyMap = {};
        facultyResponse.data.data.forEach(faculty => {
          facultyMap[faculty._id] = {
            isActive: faculty.isActive,
            status: faculty.isActive ? 'active' : 'inactive',
            firstName: faculty.firstName,
            lastName: faculty.lastName,
            fullName: `${faculty.firstName} ${faculty.lastName}`,
            employeeId: faculty.employeeId
          };
        });
        setFacultyData(facultyMap);
      }
    } catch (error) {
      console.error('Error fetching faculty status:', error);
    } finally {
      setLoading(prev => ({ ...prev, facultyStatus: false }));
    }
  };

  const fetchAllBatchesTimetables = async () => {
    if (!selectedDepartment) return;
    
    try {
      setLoading(prev => ({ ...prev, batches: true }));
      
      const batchesResponse = await axiosInstance.get(`${API_URL}/api/timetables/batches`, {
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
      
      checkDraftStatus(timetablesMap);
      
    } catch (error) {
      console.error('Error fetching all batches timetables:', error);
    } finally {
      setLoading(prev => ({ ...prev, batches: false }));
    }
  };

  const fetchPublishedTimetables = async () => {
    try {
      const response = await axiosInstance.get(`${API_URL}/api/timetables/published-timetables`);
      
      if (response.data.success) {
        const publishedMap = {};
        response.data.data.forEach(timetable => {
          publishedMap[timetable.batchId] = timetable;
        });
        setPublishedTimetables(publishedMap);
      }
    } catch (error) {
      console.error('Error fetching published timetables:', error);
    }
  };

  const fetchFacultyTimetables = async () => {
    if (!selectedDepartment) return;
    
    try {
      setLoading(prev => ({ ...prev, faculty: true }));
      
      const response = await axiosInstance.get(
        `${API_URL}/api/timetables/faculty-timetables/department/${selectedDepartment}`
      );
      
      if (response.data.success) {
        const facultyRecords = response.data.data || [];
        const summary = response.data.summary || {};
        
        const { groupedFaculty, academicYearStats } = groupFacultyTimetables(facultyRecords);
        
        setFacultyTimetables(facultyRecords);
        setFacultyGroupedData(groupedFaculty);
        setAcademicYearStats({
          ...academicYearStats,
          apiSummary: summary
        });
      }
    } catch (error) {
      console.error('Error fetching faculty timetables:', error);
    } finally {
      setLoading(prev => ({ ...prev, faculty: false }));
    }
  };

  const groupFacultyTimetables = (facultyRecords) => {
    const facultyMap = new Map();
    const academicYearMap = new Map();
    
    facultyRecords.forEach(record => {
      const facultyId = record.facultyId;
      const academicYear = record.academicYear;
      
      if (!academicYearMap.has(academicYear)) {
        academicYearMap.set(academicYear, {
          academicYear,
          recordCount: 0,
          slotCount: 0,
          facultyCount: new Set(),
          totalHours: 0
        });
      }
      
      const yearStats = academicYearMap.get(academicYear);
      yearStats.recordCount++;
      yearStats.slotCount += record.slotCount;
      yearStats.facultyCount.add(facultyId);
      yearStats.totalHours += record.totalWeeklyHours;
      
      if (!facultyMap.has(facultyId)) {
        facultyMap.set(facultyId, {
          facultyId: facultyId,
          facultyName: record.facultyName,
          employeeId: record.employeeId,
          department: record.department,
          timetables: [],
          academicYears: new Map(),
          totalSlots: 0,
          totalWeeklyHours: 0,
          semesters: new Set(),
          batches: new Set(),
          latestUpdate: record.lastUpdated
        });
      }
      
      const facultyData = facultyMap.get(facultyId);
      facultyData.timetables.push(record);
      facultyData.totalSlots += record.slotCount;
      facultyData.totalWeeklyHours += record.totalWeeklyHours;
      facultyData.semesters.add(record.semester);
      facultyData.batches.add(record.batchName);
      
      if (!facultyData.academicYears.has(academicYear)) {
        facultyData.academicYears.set(academicYear, {
          recordCount: 0,
          slotCount: 0,
          totalHours: 0
        });
      }
      
      const facultyYearStats = facultyData.academicYears.get(academicYear);
      facultyYearStats.recordCount++;
      facultyYearStats.slotCount += record.slotCount;
      facultyYearStats.totalHours += record.totalWeeklyHours;
      
      if (new Date(record.lastUpdated) > new Date(facultyData.latestUpdate)) {
        facultyData.latestUpdate = record.lastUpdated;
      }
    });
    
    const groupedFaculty = Array.from(facultyMap.values()).map(faculty => ({
      ...faculty,
      semesterCount: faculty.semesters.size,
      batchCount: faculty.batches.size,
      academicYearCount: faculty.academicYears.size,
      semesters: Array.from(faculty.semesters).sort(),
      batches: Array.from(faculty.batches),
      academicYears: Array.from(faculty.academicYears.entries()).map(([year, stats]) => ({
        academicYear: year,
        ...stats
      })),
      hasMultipleRecords: faculty.timetables.length > 1,
      hasMultipleAcademicYears: faculty.academicYears.size > 1,
      recordCount: faculty.timetables.length
    }));
    
    const academicYearStats = {
      totalRecords: facultyRecords.length,
      totalFaculty: groupedFaculty.length,
      multiRecordFaculty: groupedFaculty.filter(f => f.hasMultipleRecords).length,
      multiYearFaculty: groupedFaculty.filter(f => f.hasMultipleAcademicYears).length,
      years: Array.from(academicYearMap.values()).map(stats => ({
        ...stats,
        facultyCount: stats.facultyCount.size
      })).sort((a, b) => b.academicYear.localeCompare(a.academicYear))
    };
    
    return { groupedFaculty, academicYearStats };
  };

  const fetchFacultyTimetableDetail = async (facultyId) => {
    try {
      setLoadingFacultyDetail(true);
      const response = await axiosInstance.get(
        `${API_URL}/api/timetables/faculty-timetables/${facultyId}`
      );
      
      if (response.data.success) {
        setFacultyDetailData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching faculty timetable detail:', error);
    } finally {
      setLoadingFacultyDetail(false);
    }
  };

  const checkDraftStatus = (timetablesMap) => {
    const hasDrafts = Object.values(timetablesMap).some(
      timetable => timetable && (timetable.status === 'draft' || timetable.status === 'needs_republish')
    );
    setHasDraftChanges(hasDrafts);
  };

  const getFacultyStatus = (facultyId, facultyName) => {
    if (!facultyId) return { isActive: false, status: 'not_assigned' };
    
    if (facultyData[facultyId]) {
      return facultyData[facultyId];
    }
    
    const isInactive = facultyName?.includes('Inactive') || facultyName?.includes('Blocked');
    return {
      isActive: !isInactive,
      status: isInactive ? 'inactive' : 'active',
      fullName: facultyName
    };
  };

  const getCourseColor = (courseCode, isPublished = true, needsRepublish = false) => {
    const colors = [
      '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
      '#fa541c', '#13c2c2', '#eb2f96', '#a0d911', '#2f54eb',
      '#fa8c16', '#a0d911', '#1890ff', '#52c41a', '#faad14'
    ];
    const index = courseCode?.charCodeAt(0) % colors.length || 0;
    
    if (needsRepublish) return '#ff7a45';
    return isPublished ? colors[index] : `${colors[index]}80`;
  };

  const getStatusStats = () => {
    const timetables = Object.values(allBatchesTimetables).filter(t => t);
    const publishedCount = timetables.filter(t => t.status === 'published').length;
    const draftCount = timetables.filter(t => t.status === 'draft').length;
    const needsRepublishCount = timetables.filter(t => t.status === 'needs_republish').length;
    const totalCount = timetables.length;
    const totalSlots = timetables.reduce((sum, t) => sum + (t.timeSlots?.length || 0), 0);

    return { publishedCount, draftCount, needsRepublishCount, totalCount, totalSlots };
  };

  const filteredFacultyGroupedData = facultyGroupedData.filter(faculty => {
    if (facultyFilter === 'withClasses' && faculty.totalSlots === 0) return false;
    if (facultyFilter === 'withoutClasses' && faculty.totalSlots > 0) return false;
    if (facultyFilter === 'multipleRecords' && !faculty.hasMultipleRecords) return false;
    if (facultyFilter === 'multipleYears' && !faculty.hasMultipleAcademicYears) return false;
    
    if (semesterFilter !== 'all' && !faculty.semesters.includes(parseInt(semesterFilter))) return false;
    
    if (academicYearFilter !== 'all') {
      const hasYear = faculty.academicYears.some(year => year.academicYear === academicYearFilter);
      if (!hasYear) return false;
    }
    
    return true;
  });

  const generateMasterTimetableGrid = () => {
    const grid = {};
    
    days.forEach(day => {
      grid[day] = {};
      timeOptions.forEach(time => {
        grid[day][time] = {};
        roomOptions.forEach(room => {
          const allSlots = [];
          
          Object.entries(allBatchesTimetables).forEach(([batchId, timetable]) => {
            if (timetable?.timeSlots) {
              const batchSlots = timetable.timeSlots.filter(slot => {
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

              batchSlots.forEach(slot => {
                const facultyStatus = getFacultyStatus(slot.facultyId, slot.facultyName);
                allSlots.push({
                  ...slot,
                  batchId: batchId,
                  batchName: allBatchesDetails[batchId]?.batchName || 'Unknown Batch',
                  currentSemester: allBatchesDetails[batchId]?.currentSemester || 'N/A',
                  timetableStatus: timetable.status,
                  isPublished: timetable.status === 'published',
                  needsRepublish: timetable.status === 'needs_republish',
                  facultyStatus: facultyStatus
                });
              });
            }
          });

          let filteredSlots = allSlots;
          
          if (searchText) {
            const searchLower = searchText.toLowerCase();
            filteredSlots = filteredSlots.filter(slot => 
              slot.courseName?.toLowerCase().includes(searchLower) ||
              slot.facultyName?.toLowerCase().includes(searchLower) ||
              slot.batchName?.toLowerCase().includes(searchLower) ||
              slot.courseCode?.toLowerCase().includes(searchLower) ||
              slot.sectionName?.toLowerCase().includes(searchLower)
            );
          }
          
          if (selectedRoom !== 'all') {
            filteredSlots = filteredSlots.filter(slot => slot.room === selectedRoom);
          }
          
          if (selectedDay !== 'all') {
            filteredSlots = filteredSlots.filter(slot => slot.day.toUpperCase() === selectedDay);
          }

          grid[day][time][room] = filteredSlots;
        });
      });
    });

    return grid;
  };

  const timetableGrid = generateMasterTimetableGrid();

  const renderMasterTimetableGrid = () => {
    const columns = [
      {
        title: 'DAY',
        dataIndex: 'day',
        key: 'day',
        width: 120,
        fixed: 'left',
        render: (day) => (
          <div style={{ fontWeight: 'bold', textAlign: 'center', fontSize: '12px' }}>
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
          <div style={{ fontWeight: 'bold', textAlign: 'center', fontSize: '12px' }}>
            {time}
          </div>
        )
      },
      ...roomOptions.map(room => ({
        title: (
          <Tooltip title={room}>
            <div style={{ fontWeight: 'bold', fontSize: '11px' }}>
              {room}
            </div>
          </Tooltip>
        ),
        dataIndex: room,
        key: room,
        width: 280,
        render: (slots) => (
          <div style={{ minHeight: '80px' }}>
            {slots && slots.length > 0 ? (
              slots.map((slot, index) => (
                <Tooltip
                  key={`${slot.batchId}-${slot._id || index}`}
                  title={
                    <div>
                      <div><strong>{slot.courseName}</strong></div>
                      <div>Course: {slot.courseCode}</div>
                      <div>Section: {slot.sectionName}</div>
                      <div>
                        Teacher: {slot.facultyName}
                        {slot.facultyStatus && !slot.facultyStatus.isActive && (
                          <Tag color="red" style={{ marginLeft: 4 }}>INACTIVE</Tag>
                        )}
                      </div>
                      <div>Time: {slot.startTime}-{slot.endTime}</div>
                      <div>Type: {slot.classType}</div>
                      <div>Room: {slot.room}</div>
                      <div>Batch: {slot.batchName}</div>
                      <div>Semester: {slot.currentSemester}</div>
                      <div>
                        Status: <Tag color={
                          slot.needsRepublish ? 'orange' : 
                          slot.isPublished ? 'green' : 'orange'
                        }>
                          {slot.needsRepublish ? 'NEEDS REPUBLISH' : 
                           slot.isPublished ? 'PUBLISHED' : 'DRAFT'}
                        </Tag>
                      </div>
                      {slot.facultyStatus && !slot.facultyStatus.isActive && (
                        <div style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                          ⚠️ Faculty is inactive - timetable needs update
                        </div>
                      )}
                    </div>
                  }
                >
                  <Card
                    size="small"
                    style={{ 
                      marginBottom: '4px',
                      backgroundColor: getCourseColor(slot.courseCode, slot.isPublished, slot.needsRepublish),
                      color: 'white',
                      border: slot.needsRepublish ? '2px solid #ff7a45' : 
                             slot.isPublished ? '2px solid #52c41a' : '2px dashed #faad14',
                      cursor: 'pointer',
                      opacity: slot.facultyStatus && !slot.facultyStatus.isActive ? 0.6 : 1
                    }}
                    bodyStyle={{ padding: '6px' }}
                  >
                    <div style={{ fontSize: '10px', lineHeight: '1.2' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '11px' }}>
                        {slot.courseName}
                        {slot.facultyStatus && !slot.facultyStatus.isActive && (
                          <span style={{ color: '#ffccc7', marginLeft: 4 }}>⚠️</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 'bold', fontSize: '10px' }}>
                        Sem {slot.currentSemester} {slot.sectionName}
                      </div>
                      <div style={{ fontSize: '9px', opacity: 0.9 }}>
                        {slot.facultyName} - {slot.classType}
                        {slot.facultyStatus && !slot.facultyStatus.isActive && (
                          <Tag color="red" style={{ marginLeft: 4, fontSize: '7px', padding: '1px 3px' }}>
                            INACTIVE
                          </Tag>
                        )}
                      </div>
                      <div style={{ marginTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Tag 
                          color={slot.needsRepublish ? 'orange' : 
                                 slot.isPublished ? 'green' : 'orange'} 
                          style={{ fontSize: '7px', padding: '1px 3px', lineHeight: '1', margin: 0 }}
                        >
                          {slot.needsRepublish ? 'NEEDS REPUBLISH' : 
                           slot.isPublished ? 'PUBLISHED' : 'DRAFT'}
                        </Tag>
                        <div style={{ fontSize: '8px', fontWeight: 'bold' }}>
                          {slot.batchName}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Tooltip>
              ))
            ) : (
              <div style={{ 
                height: '60px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: '#fafafa',
                borderRadius: '4px',
                color: '#999',
                fontSize: '11px'
              }}>
                No Class
              </div>
            )}
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
      <div>
        <div style={{ marginBottom: 16, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Input
            placeholder="Search courses, teachers, batches..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 300 }}
            allowClear
            size="large"
          />
          <Select
            value={selectedRoom}
            onChange={setSelectedRoom}
            style={{ width: 180 }}
            placeholder="Filter by Room"
            allowClear
            size="large"
          >
            <Option value="all">All Rooms</Option>
            {roomOptions.map(room => (
              <Option key={room} value={room}>{room}</Option>
            ))}
          </Select>
          <Select
            value={selectedDay}
            onChange={setSelectedDay}
            style={{ width: 180 }}
            placeholder="Filter by Day"
            allowClear
            size="large"
          >
            <Option value="all">All Days</Option>
            {days.map(day => (
              <Option key={day} value={day}>{day}</Option>
            ))}
          </Select>
          <Button 
            icon={<SyncOutlined />} 
            onClick={() => {
              fetchAllBatchesTimetables();
              fetchAllFacultyStatus();
              fetchFacultyTimetables();
            }}
            loading={loading.batches || loading.facultyStatus || loading.faculty}
            className="btn submit-btn"
            size="large"
          >
            Refresh All
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          scroll={{ x: 3000, y: 600 }}
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
                    padding: '4px 6px',
                    verticalAlign: 'top'
                  }}
                />
              ),
            },
          }}
          locale={{
            emptyText: searchText || selectedRoom !== 'all' || selectedDay !== 'all' 
              ? 'No time slots found for the selected filters' 
              : 'No time slots available'
          }}
        />
      </div>
    );
  };

  const renderFacultyTimetableGrid = (timeSlots) => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const timeSlotsByDay = {};
    
    days.forEach(day => {
      timeSlotsByDay[day] = timeSlots
        .filter(slot => slot.day === day)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    return (
      <div style={{ marginTop: 16 }}>
        <h4>Weekly Schedule</h4>
        <Row gutter={[16, 16]}>
          {days.map(day => (
            <Col xs={24} sm={12} md={8} lg={6} key={day}>
              <Card 
                size="small" 
                title={day.charAt(0).toUpperCase() + day.slice(1)}
                style={{ height: '100%' }}
              >
                {timeSlotsByDay[day].length > 0 ? (
                  <div>
                    {timeSlotsByDay[day].map((slot, index) => (
                      <Card
                        key={index}
                        size="small"
                        style={{ 
                          marginBottom: 8,
                          backgroundColor: '#f0f8ff',
                          border: '1px solid #d6e4ff'
                        }}
                        bodyStyle={{ padding: '8px' }}
                      >
                        <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                          <div style={{ fontWeight: 'bold' }}>
                            {slot.courseCode} - {slot.courseName}
                          </div>
                          <div>Section: {slot.sectionName}</div>
                          <div>Time: {slot.startTime} - {slot.endTime}</div>
                          <div>Room: {slot.room}</div>
                          <div>Batch: {slot.batchName}</div>
                          <div>Type: {slot.classType}</div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div style={{ 
                    textAlign: 'center', 
                    color: '#999', 
                    fontStyle: 'italic',
                    padding: '20px 0'
                  }}>
                    No classes
                  </div>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  };

  const handleViewFacultyTimetable = (faculty) => {
    setSelectedFaculty(faculty);
    fetchFacultyTimetableDetail(faculty.facultyId);
    setFacultyDetailModal(true);
  };

  const stats = getStatusStats();

  const renderFacultyView = () => {
    const facultyStats = {
      totalFaculty: facultyGroupedData.length,
      totalRecords: facultyTimetables.length,
      totalSlots: facultyGroupedData.reduce((sum, ft) => sum + ft.totalSlots, 0),
      averageSlots: facultyGroupedData.length > 0 
        ? (facultyGroupedData.reduce((sum, ft) => sum + ft.totalSlots, 0) / facultyGroupedData.length).toFixed(1)
        : 0,
      facultyWithClasses: facultyGroupedData.filter(ft => ft.totalSlots > 0).length,
      facultyWithoutClasses: facultyGroupedData.filter(ft => ft.totalSlots === 0).length,
      facultyWithMultipleRecords: facultyGroupedData.filter(ft => ft.hasMultipleRecords).length,
      facultyWithMultipleYears: facultyGroupedData.filter(ft => ft.hasMultipleAcademicYears).length
    };

    return (
      <div>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={6} md={3}>
            <Card size="small" style={{ textAlign: 'center', background: '#f0f8ff' }}>
              <div style={{ padding: '12px' }}>
                <UserOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: '8px' }} />
                <div>
                  <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Unique Faculty</Text>
                  <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                    {facultyStats.totalFaculty}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={6} md={3}>
            <Card size="small" style={{ textAlign: 'center', background: '#f9f0ff' }}>
              <div style={{ padding: '12px' }}>
                <DatabaseOutlined style={{ fontSize: '24px', color: '#722ed1', marginBottom: '8px' }} />
                <div>
                  <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Total Records</Text>
                  <Text strong style={{ fontSize: '18px', color: '#722ed1' }}>
                    {facultyStats.totalRecords}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={6} md={3}>
            <Card size="small" style={{ textAlign: 'center', background: '#e6f7ff' }}>
              <div style={{ padding: '12px' }}>
                <ClusterOutlined style={{ fontSize: '24px', color: '#13c2c2', marginBottom: '8px' }} />
                <div>
                  <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Multi-Record</Text>
                  <Text strong style={{ fontSize: '18px', color: '#13c2c2' }}>
                    {facultyStats.facultyWithMultipleRecords}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={6} md={3}>
            <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
              <div style={{ padding: '12px' }}>
                <ApartmentOutlined style={{ fontSize: '24px', color: '#fa8c16', marginBottom: '8px' }} />
                <div>
                  <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Multi-Year</Text>
                  <Text strong style={{ fontSize: '18px', color: '#fa8c16' }}>
                    {facultyStats.facultyWithMultipleYears}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={6} md={3}>
            <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
              <div style={{ padding: '12px' }}>
                <ScheduleOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: '8px' }} />
                <div>
                  <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>With Classes</Text>
                  <Text strong style={{ fontSize: '18px', color: '#52c41a' }}>
                    {facultyStats.facultyWithClasses}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={6} md={3}>
            <Card size="small" style={{ textAlign: 'center', background: '#fff2f0' }}>
              <div style={{ padding: '12px' }}>
                <ClockCircleOutlined style={{ fontSize: '24px', color: '#ff4d4f', marginBottom: '8px' }} />
                <div>
                  <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Without Classes</Text>
                  <Text strong style={{ fontSize: '18px', color: '#ff4d4f' }}>
                    {facultyStats.facultyWithoutClasses}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={6} md={3}>
            <Card size="small" style={{ textAlign: 'center', background: '#f0f8ff' }}>
              <div style={{ padding: '12px' }}>
                <CalendarOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: '8px' }} />
                <div>
                  <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Academic Years</Text>
                  <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                    {academicYearStats.years?.length || 0}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={6} md={3}>
            <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
              <div style={{ padding: '12px' }}>
                <AppstoreOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: '8px' }} />
                <div>
                  <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Total Slots</Text>
                  <Text strong style={{ fontSize: '18px', color: '#52c41a' }}>
                    {facultyStats.totalSlots}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Faculty Filters */}
        <Card 
          className="mb-4"
          style={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          title={
            <Space>
              <FilterOutlined />
              <Text strong style={{ color: '#262626' }}>Faculty Filters</Text>
            </Space>
          }
          extra={
            <Button 
              icon={<SyncOutlined />} 
              onClick={fetchFacultyTimetables}
              loading={loading.faculty}
              className="btn submit-btn"
            >
              Refresh Faculty Data
            </Button>
          }
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <div className="form-group">
                <label className="form-label">Filter by Status</label>
                <Select
                  value={facultyFilter}
                  onChange={setFacultyFilter}
                  style={{ width: '100%' }}
                  allowClear
                  size="large"
                >
                  <Option value="all">All Faculty</Option>
                  <Option value="withClasses">With Classes</Option>
                  <Option value="withoutClasses">Without Classes</Option>
                  <Option value="multipleRecords">Multiple Records</Option>
                  <Option value="multipleYears">Multiple Years</Option>
                </Select>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div className="form-group">
                <label className="form-label">Filter by Semester</label>
                <Select
                  value={semesterFilter}
                  onChange={setSemesterFilter}
                  style={{ width: '100%' }}
                  allowClear
                  size="large"
                >
                  <Option value="all">All Semesters</Option>
                  <Option value="1">Semester 1</Option>
                  <Option value="2">Semester 2</Option>
                  <Option value="3">Semester 3</Option>
                  <Option value="4">Semester 4</Option>
                  <Option value="5">Semester 5</Option>
                  <Option value="6">Semester 6</Option>
                  <Option value="7">Semester 7</Option>
                  <Option value="8">Semester 8</Option>
                </Select>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div className="form-group">
                <label className="form-label">Filter by Academic Year</label>
                <Select
                  value={academicYearFilter}
                  onChange={setAcademicYearFilter}
                  style={{ width: '100%' }}
                  allowClear
                  size="large"
                >
                  <Option value="all">All Years</Option>
                  {academicYearStats.years?.map(year => (
                    <Option key={year.academicYear} value={year.academicYear}>
                      {year.academicYear}
                    </Option>
                  ))}
                </Select>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div className="form-group">
                <label className="form-label">Results</label>
                <div style={{ padding: '8px 0' }}>
                  <Space>
                    <Tag color="blue">
                      {filteredFacultyGroupedData.length} Faculty
                    </Tag>
                    <Tag color="green">
                      {facultyTimetables.length} Records
                    </Tag>
                  </Space>
                </div>
              </div>
            </Col>
          </Row>
        </Card>

        <Card 
          className="create-event-card"
          style={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          title={
            <Text strong style={{ color: '#262626', fontSize: '18px' }}>
              Faculty Timetables ({filteredFacultyGroupedData.length})
            </Text>
          }
        >
          <List
            loading={loading.faculty}
            dataSource={filteredFacultyGroupedData}
            renderItem={faculty => (
              <List.Item
                actions={[
                  <Button 
                    type="primary"
                    icon={<EyeOutlined />}
                    onClick={() => handleViewFacultyTimetable(faculty)}
                    disabled={faculty.totalSlots === 0}
                    className="btn submit-btn"
                  >
                    View Schedule
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar 
                      icon={<UserOutlined />} 
                      style={{ 
                        backgroundColor: faculty.totalSlots > 0 ? 
                          (faculty.hasMultipleAcademicYears ? '#fa541c' : 
                           faculty.hasMultipleRecords ? '#13c2c2' : '#52c41a') : '#f5222d' 
                      }} 
                    />
                  }
                  title={
                    <Space>
                      <strong>{faculty.facultyName}</strong>
                      {faculty.employeeId && (
                        <Tag color="blue">ID: {faculty.employeeId}</Tag>
                      )}
                      {faculty.totalSlots === 0 && (
                        <Tag color="orange">No Classes</Tag>
                      )}
                      {faculty.hasMultipleRecords && (
                        <Tag color="cyan">
                          <ClusterOutlined /> {faculty.recordCount} Records
                        </Tag>
                      )}
                      {faculty.hasMultipleAcademicYears && (
                        <Tag color="orange">
                          <ApartmentOutlined /> {faculty.academicYearCount} Years
                        </Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <div>
                        <strong>
                          {faculty.semesterCount} Semester(s) • {faculty.batchCount} Batch(es) • {faculty.academicYearCount} Year(s)
                        </strong>
                      </div>
                      <div>
                        <Tag color={faculty.totalSlots > 0 ? "green" : "red"}>
                          {faculty.totalSlots} Total Time Slots
                        </Tag>
                        <Tag color="purple">
                          {faculty.totalWeeklyHours.toFixed(1)} hrs/week
                        </Tag>
                        {faculty.academicYears.slice(0, 2).map((year, index) => (
                          <Tag key={year.academicYear} color={index === 0 ? "blue" : "default"}>
                            {year.academicYear}: {year.slotCount} slots
                          </Tag>
                        ))}
                        {faculty.academicYears.length > 2 && (
                          <Tag>+{faculty.academicYears.length - 2} more years</Tag>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        Last Updated: {new Date(faculty.latestUpdate).toLocaleDateString()}
                        {faculty.hasMultipleRecords && (
                          <span> • {faculty.recordCount} timetable records</span>
                        )}
                      </div>
                      {faculty.batches.length > 0 && (
                        <div style={{ fontSize: '11px', color: '#999' }}>
                          Batches: {faculty.batches.slice(0, 3).join(', ')}
                          {faculty.batches.length > 3 && ` +${faculty.batches.length - 3} more`}
                        </div>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
            locale={{
              emptyText: (
                <Empty
                  description={
                    facultyFilter !== 'all' || semesterFilter !== 'all' || academicYearFilter !== 'all'
                      ? "No faculty timetables match your search criteria" 
                      : "No faculty timetables found"
                  }
                />
              )
            }}
          />
        </Card>

        {/* Faculty Detail Modal */}
        <Modal
          title={
            <Space>
              <UserOutlined />
              {selectedFaculty?.facultyName} - Teaching Schedule
              {selectedFaculty?.employeeId && (
                <Tag color="blue">ID: {selectedFaculty.employeeId}</Tag>
              )}
            </Space>
          }
          open={facultyDetailModal}
          onCancel={() => setFacultyDetailModal(false)}
          footer={[
            <Button key="close" onClick={() => setFacultyDetailModal(false)} className="btn cancel-btn">
              Close
            </Button>
          ]}
          width={1200}
          style={{ top: 20 }}
        >
          {loadingFacultyDetail ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>Loading faculty schedules...</div>
            </div>
          ) : facultyDetailData ? (
            <div>
              <Descriptions 
                bordered 
                size="small" 
                column={3}
                style={{ marginBottom: 16 }}
              >
                <Descriptions.Item label="Faculty Name">
                  {facultyDetailData.faculty.name}
                </Descriptions.Item>
                <Descriptions.Item label="Employee ID">
                  {facultyDetailData.faculty.employeeId || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Department">
                  {facultyDetailData.faculty.department}
                </Descriptions.Item>
                <Descriptions.Item label="Active Semesters">
                  {facultyDetailData.timetables.length}
                </Descriptions.Item>
                <Descriptions.Item label="Total Weekly Hours">
                  <strong>
                    {facultyDetailData.timetables.reduce((sum, t) => sum + t.totalWeeklyHours, 0).toFixed(1)} hours
                  </strong>
                </Descriptions.Item>
                <Descriptions.Item label="Total Time Slots">
                  <strong>
                    {facultyDetailData.timetables.reduce((sum, t) => sum + t.slotCount, 0)}
                  </strong>
                </Descriptions.Item>
              </Descriptions>

              <Collapse defaultActiveKey={Array.from({length: facultyDetailData.timetables.length}, (_, i) => i.toString())}>
                {facultyDetailData.timetables.map((timetable, index) => (
                  <Panel 
                    header={
                      <Space>
                        <strong>Semester {timetable.semester}</strong>
                        <Tag color="blue">{timetable.academicYear}</Tag>
                        <Tag color="green">{timetable.slotCount} classes</Tag>
                        <Tag color="purple">{timetable.totalWeeklyHours} hrs/week</Tag>
                      </Space>
                    } 
                    key={index}
                  >
                    {renderFacultyTimetableGrid(timetable.timeSlots)}
                    
                    <Divider />
                    <Row gutter={16}>
                      <Col span={8}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                            {timetable.slotCount}
                          </div>
                          <div style={{ fontSize: '14px', color: '#666' }}>Total Classes</div>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                            {timetable.totalWeeklyHours}
                          </div>
                          <div style={{ fontSize: '14px', color: '#666' }}>Weekly Hours</div>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fa8c16' }}>
                            {new Date(timetable.lastUpdated).toLocaleDateString()}
                          </div>
                          <div style={{ fontSize: '14px', color: '#666' }}>Last Updated</div>
                        </div>
                      </Col>
                    </Row>
                  </Panel>
                ))}
              </Collapse>

              {facultyDetailData.timetables.length === 0 && (
                <Empty
                  description="This faculty member doesn't have any teaching assignments in the current semester."
                />
              )}
            </div>
          ) : (
            <Empty description="Could not load faculty timetable details." />
          )}
        </Modal>
      </div>
    );
  };

  // Batch Summary Functions
  const renderBatchSummary = () => {
    return (
      <Row gutter={[16, 16]}>
        {Object.entries(allBatchesTimetables).map(([batchId, timetable]) => {
          const batch = allBatchesDetails[batchId];
          if (!batch || !timetable) return null;

          const slotCount = timetable.timeSlots?.length || 0;
          const published = timetable.status === 'published';
          const needsRepublish = timetable.status === 'needs_republish';
          const isDraft = timetable.status === 'draft';

          const inactiveFacultySlots = timetable.timeSlots?.filter(slot => {
            const facultyStatus = getFacultyStatus(slot.facultyId, slot.facultyName);
            return !facultyStatus.isActive;
          }).length || 0;

          return (
            <Col xs={24} sm={12} md={8} lg={6} key={batchId}>
              <Card 
                size="small"
                title={
                  <Space>
                    <TeamOutlined />
                    {batch.batchName}
                  </Space>
                }
                extra={
                  <Tag color={
                    needsRepublish ? 'orange' : 
                    published ? 'green' : 'orange'
                  }>
                    {needsRepublish ? 'NEEDS REPUBLISH' : 
                     published ? 'PUBLISHED' : 'DRAFT'}
                  </Tag>
                }
              >
                <div style={{ fontSize: '12px' }}>
                  <div><strong>Semester:</strong> {batch.currentSemester}</div>
                  <div><strong>Time Slots:</strong> {slotCount}</div>
                  {inactiveFacultySlots > 0 && (
                    <div style={{ color: '#ff4d4f' }}>
                      <strong>Inactive Faculty:</strong> {inactiveFacultySlots} slots
                    </div>
                  )}
                  <div><strong>Last Updated:</strong> {new Date(timetable.updatedAt).toLocaleDateString()}</div>
                  {timetable.lastPublishedAt && (
                    <div><strong>Published:</strong> {new Date(timetable.lastPublishedAt).toLocaleDateString()}</div>
                  )}
                  
                  <div style={{ marginTop: '12px' }}>
                    <Progress 
                      percent={
                        needsRepublish ? 75 : 
                        published ? 100 : 50
                      } 
                      size="small" 
                      status={
                        needsRepublish ? 'exception' :
                        published ? 'success' : 'active'
                      }
                      format={() => 
                        needsRepublish ? 'Needs Republish' : 
                        published ? 'Published' : 'Draft'
                      }
                    />
                  </div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>
    );
  };

  return (
    <div className="container mt-5" style={{ minHeight: '100vh' }}>
      <div className="d-flex justify-content-between align-items-center mb-5">
        <div>
          <h2 className="Department-Timetable-title" >
            Department Timetable Management
          </h2>
        </div>
        <Button 
          icon={<SyncOutlined />} 
          onClick={() => {
            fetchAllBatchesTimetables();
            fetchFacultyTimetables();
          }}
          loading={loading.batches || loading.faculty}
          className="btn submit-btn"
        >
          Refresh Data
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6} md={3}>
          <Card size="small" style={{ textAlign: 'center', background: '#f0f8ff' }}>
            <div style={{ padding: '12px' }}>
              <TeamOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Total Batches</Text>
                <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                  {stats.totalCount}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={3}>
          <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
            <div style={{ padding: '12px' }}>
              <CheckCircleOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Published</Text>
                <Text strong style={{ fontSize: '18px', color: '#52c41a' }}>
                  {stats.publishedCount}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={3}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
            <div style={{ padding: '12px' }}>
              <ClockCircleOutlined style={{ fontSize: '24px', color: '#fa8c16', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Draft</Text>
                <Text strong style={{ fontSize: '18px', color: '#fa8c16' }}>
                  {stats.draftCount}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={3}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff2f0' }}>
            <div style={{ padding: '12px' }}>
              <HistoryOutlined style={{ fontSize: '24px', color: '#ff4d4f', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Needs Republish</Text>
                <Text strong style={{ fontSize: '18px', color: '#ff4d4f' }}>
                  {stats.needsRepublishCount}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={3}>
          <Card size="small" style={{ textAlign: 'center', background: '#f0f8ff' }}>
            <div style={{ padding: '12px' }}>
              <AppstoreOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Total Slots</Text>
                <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                  {stats.totalSlots}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={3}>
          <Card size="small" style={{ textAlign: 'center', background: '#f9f0ff' }}>
            <div style={{ padding: '12px' }}>
              <DatabaseOutlined style={{ fontSize: '24px', color: '#722ed1', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Faculty Records</Text>
                <Text strong style={{ fontSize: '18px', color: '#722ed1' }}>
                  {facultyTimetables.length}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={3}>
          <Card size="small" style={{ textAlign: 'center', background: '#e6f7ff' }}>
            <div style={{ padding: '12px' }}>
              <UserOutlined style={{ fontSize: '24px', color: '#13c2c2', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Unique Faculty</Text>
                <Text strong style={{ fontSize: '18px', color: '#13c2c2' }}>
                  {facultyGroupedData.length}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6} md={3}>
          <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
            <div style={{ padding: '12px' }}>
              <CalendarOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: '8px' }} />
              <div>
                <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>Academic Years</Text>
                <Text strong style={{ fontSize: '18px', color: '#52c41a' }}>
                  {academicYearStats.years?.length || 0}
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
            <Text strong style={{ color: '#262626' }}>Department Selection</Text>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <div className="form-group">
              <label className="form-label">Degree Level</label>
              <Select
                placeholder="Select Degree Level"
                value={selectedDegree}
                onChange={setSelectedDegree}
                style={{ width: '100%' }}
                allowClear
                size="large"
                loading={loading.degree}
              >
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
                value={selectedDepartment}
                onChange={setSelectedDepartment}
                style={{ width: '100%' }}
                allowClear
                size="large"
                loading={loading.department}
                disabled={!selectedDegree}
              >
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
              <label className="form-label">Quick Stats</label>
              <div style={{ padding: '8px 0' }}>
                <Space>
                  <Tag color="blue">{stats.totalCount} Batches</Tag>
                  <Tag color="green">{stats.publishedCount} Published</Tag>
                  <Tag color="orange">{stats.draftCount + stats.needsRepublishCount} Pending</Tag>
                </Space>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {selectedDepartment && (
        <Card 
          className="create-event-card"
          style={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        >
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            items={[
              {
                key: 'master',
                label: (
                  <Space>
                    <AppstoreOutlined />
                    Master Timetable
                    {stats.needsRepublishCount > 0 && (
                      <Badge count={stats.needsRepublishCount} style={{ backgroundColor: '#ff7a45' }} />
                    )}
                  </Space>
                ),
                children: renderMasterTimetableGrid()
              },
              {
                key: 'faculty',
                label: (
                  <Space>
                    <UserOutlined />
                    Faculty View
                    <Badge count={facultyGroupedData.length} />
                  </Space>
                ),
                children: renderFacultyView()
              },
              {
                key: 'batches',
                label: (
                  <Space>
                    <TeamOutlined />
                    Batch Summary
                  </Space>
                ),
                children: renderBatchSummary()
              }
            ]}
          />
        </Card>
      )}

      {!selectedDepartment && (
        <Card 
          className="create-event-card"
          style={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', textAlign: 'center', padding: '40px' }}
        >
          <Empty
            description="Please select a degree level and department to view timetables"
          />
        </Card>
      )}
    </div>
  );
};

export default AllBatchesTimetable;