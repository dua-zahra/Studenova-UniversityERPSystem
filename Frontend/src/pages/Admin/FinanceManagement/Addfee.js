import React, { useState, useEffect } from 'react';
import axiosInstance  from '../../../axiosConfig';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import API_URL from '../../../config';

import { 
  Card, Table, Button, Spin, Typography, Row, Col, Input, Form,
  Divider, Statistic, Tag, Space, Tabs, Modal,
  Select, InputNumber, Tooltip
} from 'antd';
import { 
  SaveOutlined, CalculatorOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
  SyncOutlined, EyeOutlined, InfoCircleOutlined,
  EditOutlined, PercentageOutlined, CopyOutlined,
  LockOutlined
} from '@ant-design/icons';
import "../../../assets/style.css";

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

const Addfee = () => {
  const [degreeLevel, setDegreeLevel] = useState('');
  const [department, setDepartment] = useState('');
  const [batch, setBatch] = useState('');
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [courseFees, setCourseFees] = useState({});
  const [assignedFees, setAssignedFees] = useState({});
  const [existingFeeStructure, setExistingFeeStructure] = useState(null);
  const [semesterBreakdown, setSemesterBreakdown] = useState([]);
  const [degreeTotal, setDegreeTotal] = useState(0);
  const [activeSemester, setActiveSemester] = useState('1');
  const [maxSemesters, setMaxSemesters] = useState(8);
  const [studentFeesModalVisible, setStudentFeesModalVisible] = useState(false);
  const [studentFeesData, setStudentFeesData] = useState([]);
  const [generationResults, setGenerationResults] = useState(null);
  const [currentBatchInfo, setCurrentBatchInfo] = useState(null);
  const [isFeeStructureSaved, setIsFeeStructureSaved] = useState(false);

  const [masterBaseFee, setMasterBaseFee] = useState({
    tuitionFee: 0,
    miscellaneousFee: 0,
    examFee: 0,
    libraryFee: 0,
    labFee: 0,
    totalBaseFee: 0
  });

  const [semesterBaseFees, setSemesterBaseFees] = useState({});

  const [degreeTotals, setDegreeTotals] = useState({
    totalBaseFeeAllSemesters: 0,
    totalCourseFeeAllSemesters: 0,
    totalDegreeFee: 0
  });

  useEffect(() => {
    fetchDegreeLevels();
  }, []);

  useEffect(() => {
    if (degreeLevel) {
      fetchDepartments();
      setDepartment('');
      setBatch('');
      setBatches([]);
      setMaxSemesters(getMaxSemesters(degreeLevel));
      resetMasterBaseFee();
    }
  }, [degreeLevel]);

  useEffect(() => {
    if (degreeLevel && department) {
      fetchBatches();
      fetchAssignedFees();
      fetchCoursesForAllSemesters();
    }
  }, [degreeLevel, department]);

  useEffect(() => {
    if (degreeLevel && department && batch) {
      fetchExistingFeeStructure();
      fetchCurrentBatchInfo();
    } else {
      resetMasterBaseFee();
      setSemesterBaseFees({});
      setCurrentBatchInfo(null);
      setIsFeeStructureSaved(false);
    }
  }, [batch]);

  const fetchCurrentBatchInfo = async () => {
    if (!batch) return;
    
    try {
      const response = await axiosInstance.get(`${API_URL}/api/batches`);
      if (response.data.success) {
        const batchInfo = response.data.data.find(batchItem => 
          batchItem.batchName === batch &&
          batchItem.departmentName && 
          batchItem.departmentName.toLowerCase() === department.toLowerCase() &&
          batchItem.degreeLevel &&
          batchItem.degreeLevel.toLowerCase() === degreeLevel.toLowerCase()
        );
        setCurrentBatchInfo(batchInfo);
      }
    } catch (error) {
      console.error('Error fetching batch info:', error);
    }
  };

  const getMaxSemesters = (level) => {
    const config = {
      'Undergraduate': 8,
      'Graduate': 6,
      'PhD': 8
    };
    return config[level] || 8;
  };

  const resetMasterBaseFee = () => {
    setMasterBaseFee({
      tuitionFee: 0,
      miscellaneousFee: 0,
      examFee: 0,
      libraryFee: 0,
      labFee: 0,
      totalBaseFee: 0
    });
  };

  const calculateTotalBaseFee = (baseFeeConfig) => {
    return (Number(baseFeeConfig.tuitionFee) || 0) +
           (Number(baseFeeConfig.miscellaneousFee) || 0) +
           (Number(baseFeeConfig.examFee) || 0) +
           (Number(baseFeeConfig.libraryFee) || 0) +
           (Number(baseFeeConfig.labFee) || 0);
  };

  const isSemesterDisabled = (semester) => {
    if (!currentBatchInfo || !currentBatchInfo.currentSemester) return false;
    if (!isFeeStructureSaved && !existingFeeStructure) return false;
    
    return semester <= currentBatchInfo.currentSemester;
  };

  const updateMasterBaseFee = (field, value) => {
    if (isFeeStructureSaved || existingFeeStructure) {
      toast.warning('Fee structure is already saved. Cannot modify master base fee.');
      return;
    }

    const newMasterBaseFee = {
      ...masterBaseFee,
      [field]: value === '' ? 0 : Number(value)
    };
    
    newMasterBaseFee.totalBaseFee = calculateTotalBaseFee(newMasterBaseFee);
    
    setMasterBaseFee(newMasterBaseFee);
  };

  const applyToAllSemesters = () => {
    if (isFeeStructureSaved || existingFeeStructure) {
      toast.warning('Fee structure is already saved. Cannot modify semester configurations.');
      return;
    }

    const newSemesterBaseFees = { ...semesterBaseFees };
    
    for (let i = 1; i <= maxSemesters; i++) {
      delete newSemesterBaseFees[i];
    }
    
    setSemesterBaseFees(newSemesterBaseFees);
    toast.success('Master base fee applied to all semesters! Customizations removed.');
  };

  const handleSemesterBaseFeeChange = (semester, field, value) => {
    if (isSemesterDisabled(semester)) {
      toast.warning(`Cannot modify fees for Semester ${semester} as it is current or past semester.`);
      return;
    }

    const currentSemesterFee = semesterBaseFees[semester] || { ...masterBaseFee };
    
    const updatedSemesterFee = {
      ...currentSemesterFee,
      [field]: value === '' ? 0 : Number(value)
    };
    
    updatedSemesterFee.totalBaseFee = calculateTotalBaseFee(updatedSemesterFee);
    
    setSemesterBaseFees(prev => ({
      ...prev,
      [semester]: updatedSemesterFee
    }));
  };

  const applyPercentageAdjustment = (semester, percentage) => {
    if (isSemesterDisabled(semester)) {
      toast.warning(`Cannot modify fees for Semester ${semester} as it is current or past semester.`);
      return;
    }

    if (!percentage || percentage === 0) return;
    
    const currentSemesterFee = semesterBaseFees[semester] || { ...masterBaseFee };
    const adjustmentFactor = 1 + (percentage / 100);
    
    const adjustedFees = {
      tuitionFee: Math.round(currentSemesterFee.tuitionFee * adjustmentFactor),
      miscellaneousFee: Math.round(currentSemesterFee.miscellaneousFee * adjustmentFactor),
      examFee: Math.round(currentSemesterFee.examFee * adjustmentFactor),
      libraryFee: Math.round(currentSemesterFee.libraryFee * adjustmentFactor),
      labFee: Math.round(currentSemesterFee.labFee * adjustmentFactor),
      totalBaseFee: 0 
    };
    
    adjustedFees.totalBaseFee = calculateTotalBaseFee(adjustedFees);
    
    setSemesterBaseFees(prev => ({
      ...prev,
      [semester]: adjustedFees
    }));
    
    toast.success(`Applied ${percentage > 0 ? '+' : ''}${percentage}% adjustment to Semester ${semester}`);
  };

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

  const fetchAssignedFees = async () => {
    try {
      const response = await axiosInstance.get(`${API_URL}/api/fees/assigned-course-fees`, {
        params: { degreeLevel, department: department.trim() }
      });
      
      if (response.data.success) {
        setAssignedFees(response.data.data);
      } else {
        setAssignedFees({});
      }
    } catch (error) {
      console.error('Error fetching assigned fees:', error);
      setAssignedFees({});
    }
  };

  const fetchCoursesForAllSemesters = async () => {
    try {
      setLoading(true);
      
      const semesters = Array.from({ length: maxSemesters }, (_, i) => i + 1);
      const allCourses = {};

      for (const semester of semesters) {
        try {
          const response = await axiosInstance.get(`${API_URL}/api/fees/courses-for-fees`, {
            params: { 
              degreeLevel, 
              department: department.trim(),
              semester 
            }
          });
          
          if (response.data.success) {
            allCourses[semester] = response.data.data.map(course => ({
              ...course,
              assignedFee: assignedFees[semester]?.[course.courseCode] || ''
            }));
          } else {
            allCourses[semester] = [];
          }
        } catch (error) {
          console.error(`Error fetching courses for semester ${semester}:`, error);
          allCourses[semester] = [];
        }
      }

      setCourseFees(allCourses);
    } catch (error) {
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingFeeStructure = async () => {
    if (!degreeLevel || !department || !batch) return;

    try {
      setLoading(true);
      const response = await axiosInstance.get(`${API_URL}/api/fees/structure`, {
        params: { degreeLevel, department: department.trim(), batch }
      });

      if (response.data.success && response.data.data) {
        const feeStructure = response.data.data;
        setExistingFeeStructure(feeStructure);
        setIsFeeStructureSaved(true);
        
        if (feeStructure.masterBaseFee) {
          setMasterBaseFee(feeStructure.masterBaseFee);
        }
        
        if (feeStructure.semesterBaseFees && feeStructure.semesterBaseFees instanceof Map) {
          const customFees = {};
          feeStructure.semesterBaseFees.forEach((value, key) => {
            customFees[key] = value;
          });
          setSemesterBaseFees(customFees);
        } else if (feeStructure.semesterBaseFees && typeof feeStructure.semesterBaseFees === 'object') {
          setSemesterBaseFees(feeStructure.semesterBaseFees);
        } else {
          setSemesterBaseFees({});
        }
        
        setSemesterBreakdown(feeStructure.semesterBreakdown || []);
        setDegreeTotal(feeStructure.degreeTotal || 0);
        
        calculateDegreeTotals(feeStructure.semesterBreakdown || []);
      } else {
        setExistingFeeStructure(null);
        setIsFeeStructureSaved(false);
        resetMasterBaseFee();
        setSemesterBaseFees({});
        setSemesterBreakdown([]);
        setDegreeTotal(0);
        setDegreeTotals({
          totalBaseFeeAllSemesters: 0,
          totalCourseFeeAllSemesters: 0,
          totalDegreeFee: 0
        });
      }
    } catch (error) {
      console.error('Error fetching fee structure:', error);
      setExistingFeeStructure(null);
      setIsFeeStructureSaved(false);
      resetMasterBaseFee();
      setSemesterBaseFees({});
      setSemesterBreakdown([]);
      setDegreeTotal(0);
      setDegreeTotals({
        totalBaseFeeAllSemesters: 0,
        totalCourseFeeAllSemesters: 0,
        totalDegreeFee: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateDegreeTotals = (breakdown) => {
    const totals = breakdown.reduce((acc, semester) => {
      acc.totalBaseFeeAllSemesters += semester.baseFee || 0;
      acc.totalCourseFeeAllSemesters += semester.courseFee || 0;
      acc.totalDegreeFee += semester.semesterTotal || 0;
      return acc;
    }, {
      totalBaseFeeAllSemesters: 0,
      totalCourseFeeAllSemesters: 0,
      totalDegreeFee: 0
    });

    setDegreeTotals(totals);
  };

  const calculateFeeBreakdown = () => {
    if (!degreeLevel || !department || !batch) {
      toast.error('Please select degree level, department, and batch');
      return;
    }

    const batchInfo = batches.find(b => b.batchName === batch);
    if (!batchInfo) {
      toast.error('Batch information not found');
      return;
    }

    const breakdown = [];
    let totalDegreeFee = 0;
    let totalBaseFeeAllSemesters = 0;
    let totalCourseFeeAllSemesters = 0;

    for (let semester = 1; semester <= batchInfo.totalSemesters; semester++) {
      const semesterBaseFee = semesterBaseFees[semester]?.totalBaseFee || masterBaseFee.totalBaseFee;
      
      let courseFee = 0;
      if (assignedFees[semester]) {
        courseFee = Object.values(assignedFees[semester]).reduce((sum, fee) => sum + Number(fee), 0);
      }

      const semesterTotal = semesterBaseFee + courseFee;
      totalDegreeFee += semesterTotal;
      totalBaseFeeAllSemesters += semesterBaseFee;
      totalCourseFeeAllSemesters += courseFee;

      const courseCount = assignedFees[semester] ? Object.keys(assignedFees[semester]).length : 0;
      const credits = courseCount * 3; 

      breakdown.push({
        semester,
        credits,
        courses: courseCount,
        baseFee: semesterBaseFee,
        courseFee,
        semesterTotal
      });
    }

    setSemesterBreakdown(breakdown);
    setDegreeTotal(totalDegreeFee);
    setDegreeTotals({
      totalBaseFeeAllSemesters,
      totalCourseFeeAllSemesters,
      totalDegreeFee
    });

    toast.success('Fee breakdown calculated successfully!');
  };

  const saveFeeStructure = async () => {
    if (!degreeLevel || !department || !batch) {
      toast.error('Please select degree level, department, and batch');
      return;
    }

    if (masterBaseFee.totalBaseFee === 0) {
      toast.error('Please configure master base fee for this batch');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        degreeLevel,
        department: department.trim(),
        batch,
        masterBaseFee,
        semesterBaseFees: Object.keys(semesterBaseFees).length > 0 ? semesterBaseFees : undefined
      };

      const response = await axiosInstance.post(`${API_URL}/api/fees/structure`, payload);
      
      if (response.data.success) {
        toast.success(response.data.message);
        
        setExistingFeeStructure(response.data.data.feeStructure);
        setSemesterBreakdown(response.data.data.feeStructure.semesterBreakdown || []);
        setDegreeTotal(response.data.data.feeStructure.degreeTotal || 0);
        setIsFeeStructureSaved(true);
        calculateDegreeTotals(response.data.data.feeStructure.semesterBreakdown || []);
        
        if (response.data.data.studentFeeGeneration) {
          setGenerationResults(response.data.data.studentFeeGeneration);
          showAutomaticStudentFeeResults(response.data.data.studentFeeGeneration);
          
          setTimeout(() => {
            viewStudentFees();
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error saving fee structure:', error);
      const errorMessage = error.response?.data?.message || 'Failed to save fee structure';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const showAutomaticStudentFeeResults = (results) => {
    Modal.info({
      title: 'Automatic Student Fee Update',
      width: 800,
      content: (
        <div>
          <div style={{ padding: '16px', backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '6px', marginBottom: '16px' }}>
            <Text strong style={{ color: '#52c41a' }}>Student fees automatically updated!</Text>
            <div style={{ color: '#52c41a' }}>
              Fee structure was saved and student fees were automatically {results.updated > 0 ? 'updated' : 'created'} for {results.total} students.
            </div>
          </div>
          
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Statistic title="Total Students" value={results.total} />
            </Col>
            <Col span={6}>
              <Statistic 
                title={results.updated > 0 ? "Updated" : "Created"} 
                value={results.updated > 0 ? results.updated : results.created} 
                valueStyle={{ color: results.updated > 0 ? '#1890ff' : '#52c41a' }} 
              />
            </Col>
            <Col span={6}>
              <Statistic title="Errors" value={results.errors} valueStyle={{ color: '#cf1322' }} />
            </Col>
          </Row>
          
          {results.details && results.details.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text strong>Update Details:</Text>
              <div style={{ maxHeight: 200, overflow: 'auto', marginTop: 8 }}>
                {results.details.map((detail, index) => (
                  <div key={index} style={{ 
                    padding: '4px 8px', 
                    marginBottom: 4,
                    backgroundColor: detail.status === 'error' ? '#fff2f0' : 
                                   detail.status === 'created' ? '#f6ffed' : '#f0f5ff',
                    border: '1px solid #d9d9d9',
                    borderRadius: 4
                  }}>
                    <Text type={detail.status === 'error' ? 'danger' : 'success'}>
                      {detail.studentId}: {detail.message}
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
      onOk() {},
    });
  };

  const viewStudentFees = async () => {
    if (!degreeLevel || !department || !batch) {
      toast.error('Please select degree level, department, and batch');
      return;
    }

    try {
      setLoading(true);
      const response = await axiosInstance.get(`${API_URL}/api/fees/students-for-batch`, {
        params: { degreeLevel, department: department.trim(), batch }
      });

      if (response.data.success) {
        setStudentFeesData(response.data.data.students);
        setStudentFeesModalVisible(true);
      } else {
        toast.error('Failed to fetch student fees');
      }
    } catch (error) {
      console.error('Error fetching student fees:', error);
      toast.error('Failed to fetch student fees');
    } finally {
      setLoading(false);
    }
  };

  const generateStudentFeeRecords = async () => {
    if (!degreeLevel || !department || !batch) {
      toast.error('Please select degree level, department, and batch');
      return;
    }

    setSaving(true);
    try {
      const response = await axiosInstance.post(`${API_URL}/api/fees/generate-student-records`, {
        degreeLevel,
        department: department.trim(),
        batch
      });

      if (response.data.success) {
        toast.success(response.data.message);
        setGenerationResults(response.data.data);
        
        viewStudentFees();
      }
    } catch (error) {
      console.error('Error generating student fee records:', error);
      toast.error(error.response?.data?.message || 'Failed to generate student fee records');
    } finally {
      setSaving(false);
    }
  };

  const generateCourseColumns = (semester) => {
    return [
      {
        title: 'Course Information',
        dataIndex: 'courseName',
        key: 'courseName',
        fixed: 'left',
        width: 300,
        render: (text, record) => (
          <div>
            <div style={{ display: 'flex', fontSize: '15px', alignItems: 'center' }}>
              <strong>{record.courseName}</strong>
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              <div>Code: {record.courseCode}</div>
              <div>Type: {record.type}</div>
            </div>
          </div>
        )
      },
      {
        title: 'Credits',
        dataIndex: 'creditHrs',
        key: 'creditHrs',
        width: 100,
        align: 'center',
        render: (credits) => (
          <Tag color="#957bab" style={{ fontSize: '14px', padding: '4px 8px' }}>
            {credits} Cr
          </Tag>
        )
      },
      {
        title: 'Assigned Fee (Rs.)',
        dataIndex: 'assignedFee',
        key: 'assignedFee',
        width: 200,
        render: (currentFee, record) => {
          const previouslyAssigned = assignedFees[semester]?.[record.courseCode] || '';
          const hasPreviousFee = previouslyAssigned !== '';
          const displayFee = currentFee || (hasPreviousFee ? previouslyAssigned : '');
          
          return (
            <div className="input-group" style={{ width: '150px' }}>
              <span className="input-group-text">Rs. </span>
              <input
                type="number"
                className="form-control"
                value={displayFee}
                readOnly
                style={{ textAlign: 'right', backgroundColor: '#f5f5f5' }}
              />
            </div>
          );
        }
      },
      {
        title: 'Status',
        key: 'status',
        width: 120,
        align: 'center',
        render: (_, record) => {
          const previouslyAssigned = assignedFees[semester]?.[record.courseCode] || '';
          const hasPreviousFee = previouslyAssigned !== '';
          const hasCurrentFee = record.assignedFee && record.assignedFee > 0;
          
          if (hasPreviousFee || hasCurrentFee) {
            return (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                Assigned
              </Tag>
            );
          }
          
          return (
            <Tag color="orange" icon={<ExclamationCircleOutlined />}>
              Pending
            </Tag>
          );
        }
      }
    ];
  };

  const semesterColumns = [
    {
      title: 'Semester',
      dataIndex: 'semester',
      key: 'semester',
      align: 'center',
      render: (semester) => <Tag color="blue">Semester {semester}</Tag>
    },
    {
      title: 'Credits',
      dataIndex: 'credits',
      key: 'credits',
      align: 'center',
      render: (credits) => <Text strong>{credits}</Text>
    },
    {
      title: 'Courses',
      dataIndex: 'courses',
      key: 'courses',
      align: 'center',
      render: (courses) => <Text>{courses}</Text>
    },
    {
      title: 'Base Fee (Rs.)',
      dataIndex: 'baseFee',
      key: 'baseFee',
      align: 'right',
      render: (fee) => <Text>Rs. {fee?.toLocaleString()}</Text>
    },
    {
      title: 'Course Fee (Rs.)',
      dataIndex: 'courseFee',
      key: 'courseFee',
      align: 'right',
      render: (fee) => <Text>Rs. {fee?.toLocaleString()}</Text>
    },
    {
      title: 'Semester Total (Rs.)',
      dataIndex: 'semesterTotal',
      key: 'semesterTotal',
      align: 'right',
      render: (total) => <Text strong type="success">Rs. {total?.toLocaleString()}</Text>
    }
  ];

  const studentFeeColumns = [
    {
      title: 'Student ID',
      dataIndex: 'studentId',
      key: 'studentId',
      render: (id) => <Text strong>{id}</Text>
    },
    {
      title: 'Name',
      key: 'name',
      render: (_, record) => (
        <Text>{record.firstName} {record.lastName}</Text>
      )
    },
    {
      title: 'Current Semester',
      dataIndex: 'currentSemester',
      key: 'currentSemester',
      align: 'center',
      render: (semester) => <Tag color="blue">Sem {semester}</Tag>
    },
    {
      title: 'Scholarship',
      dataIndex: 'scholarshipPercentage',
      key: 'scholarshipPercentage',
      align: 'center',
      render: (percentage) => (
        percentage > 0 ? (
          <Tag color="green">{percentage}%</Tag>
        ) : (
          <Tag color="default">0%</Tag>
        )
      )
    },
    {
      title: 'Fee Record',
      key: 'feeRecord',
      align: 'center',
      render: (_, record) => (
        record.feeRecord.hasFeeRecord ? (
          <div>
            <Tag color="green">Generated</Tag>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              <Text type="success">Paid: Rs. {record.feeRecord.totalPaid?.toLocaleString()}</Text>
              <br />
              <Text type="danger">Due: Rs. {record.feeRecord.totalDue?.toLocaleString()}</Text>
            </div>
          </div>
        ) : (
          <Tag color="orange">Not Generated</Tag>
        )
      )
    }
  ];

  const currentCourses = courseFees[activeSemester] || [];
  const assignedCount = currentCourses.filter(c => {
    const previouslyAssigned = assignedFees[activeSemester]?.[c.courseCode] || '';
    return (c.assignedFee && c.assignedFee > 0) || previouslyAssigned !== '';
  }).length;
  const totalCount = currentCourses.length;

  const BaseFeeConfigurationCard = ({ semester }) => {
    const semesterFee = semesterBaseFees[semester];
    const isCustom = !!semesterFee;
    const displayFee = semesterFee || masterBaseFee;
    const disabled = isSemesterDisabled(semester);
    
    return (
      <Card 
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              Semester {semester} - Base Fee Configuration
              {disabled && (
                <Tag color="red" icon={<LockOutlined />} style={{ marginLeft: '8px' }}>
                  Locked
                </Tag>
              )}
            </span>
            {isCustom && (
              <Tag color="orange" icon={<EditOutlined />}>
                Customized
              </Tag>
            )}
          </div>
        }
        className="mb-3"
        extra={
          <Space>
            <Tooltip title={disabled ? "Cannot modify current or past semesters" : "Apply percentage adjustment"}>
              <Select
                placeholder="± %"
                style={{ width: 100 }}
                onChange={(value) => applyPercentageAdjustment(semester, value)}
                allowClear
                disabled={disabled}
              >
                <Option value={10}>+10%</Option>
                <Option value={20}>+20%</Option>
                <Option value={30}>+30%</Option>
                <Option value={-10}>-10%</Option>
                <Option value={-20}>-20%</Option>
                <Option value={-30}>-30%</Option>
              </Select>
            </Tooltip>
            {isCustom && !disabled && (
              <Tooltip title="Remove customization (use master fee)">
                <Button 
                  icon={<CopyOutlined />} 
                  size="small"
                  danger
                  onClick={() => {
                    const newSemesterBaseFees = { ...semesterBaseFees };
                    delete newSemesterBaseFees[semester];
                    setSemesterBaseFees(newSemesterBaseFees);
                    toast.info(`Semester ${semester} reset to master configuration`);
                  }}
                >
                  Reset
                </Button>
              </Tooltip>
            )}
          </Space>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tuition Fee</label>
            <div className="input-group">
              <span className="input-group-text">Rs.</span>
              <Input
                type="number"
                className="form-control"
                value={displayFee.tuitionFee || ''}
                onChange={(e) => handleSemesterBaseFeeChange(semester, 'tuitionFee', e.target.value)}
                min="0"
                step="100"
                style={{ textAlign: 'right' }}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Miscellaneous Fee</label>
            <div className="input-group">
              <span className="input-group-text">Rs.</span>
              <Input
                type="number"
                className="form-control"
                value={displayFee.miscellaneousFee || ''}
                onChange={(e) => handleSemesterBaseFeeChange(semester, 'miscellaneousFee', e.target.value)}
                min="0"
                step="100"
                style={{ textAlign: 'right' }}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Exam Fee</label>
            <div className="input-group">
              <span className="input-group-text">Rs.</span>
              <Input
                type="number"
                className="form-control"
                value={displayFee.examFee || ''}
                onChange={(e) => handleSemesterBaseFeeChange(semester, 'examFee', e.target.value)}
                min="0"
                step="100"
                style={{ textAlign: 'right' }}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Library Fee</label>
            <div className="input-group">
              <span className="input-group-text">Rs.</span>
              <Input
                type="number"
                className="form-control"
                value={displayFee.libraryFee || ''}
                onChange={(e) => handleSemesterBaseFeeChange(semester, 'libraryFee', e.target.value)}
                min="0"
                step="100"
                style={{ textAlign: 'right' }}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Lab Fee</label>
            <div className="input-group">
              <span className="input-group-text">Rs.</span>
              <Input
                type="number"
                className="form-control"
                value={displayFee.labFee || ''}
                onChange={(e) => handleSemesterBaseFeeChange(semester, 'labFee', e.target.value)}
                min="0"
                step="100"
                style={{ textAlign: 'right' }}
                disabled={disabled}
              />
            </div>
          </div>
        </div>

        <Divider />
        
        <div className="form-row">
          <div className="form-group" style={{ width: '100%' }}>
            <div className="total-base-fee">
              <Statistic
                title={`Semester ${semester} Total Base Fee`}
                value={displayFee.totalBaseFee || 0}
                prefix="Rs."
                valueStyle={{ 
                  color: isCustom ? '#fa8c16' : '#3f8600' 
                }}
              />
              {isCustom ? (
                <Text type="warning" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                  Customized for this semester (Master: Rs. {masterBaseFee.totalBaseFee?.toLocaleString()})
                </Text>
              ) : (
                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                  Using master base fee configuration
                </Text>
              )}
              {disabled && (
                <Text type="danger" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                  This semester is locked and cannot be modified
                </Text>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const MasterBaseFeeConfiguration = () => {
    const disabled = isFeeStructureSaved || existingFeeStructure;
    
    return (
      <Card 
        title={`Master Base Fee Configuration - ${batch}`}
        className="mb-4"
        extra={
          <Button 
            type="primary" 
            icon={<CopyOutlined />}
            onClick={applyToAllSemesters}
            disabled={disabled || Object.keys(semesterBaseFees).length === 0}
          >
            Apply Master to All Semesters
          </Button>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tuition Fee</label>
            <div className="input-group">
              <span className="input-group-text">Rs.</span>
              <Input
                type="number"
                className="form-control"
                value={masterBaseFee.tuitionFee || ''}
                onChange={(e) => updateMasterBaseFee('tuitionFee', e.target.value)}
                min="0"
                step="100"
                style={{ textAlign: 'right' }}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Miscellaneous Fee</label>
            <div className="input-group">
              <span className="input-group-text">Rs.</span>
              <Input
                type="number"
                className="form-control"
                value={masterBaseFee.miscellaneousFee || ''}
                onChange={(e) => updateMasterBaseFee('miscellaneousFee', e.target.value)}
                min="0"
                step="100"
                style={{ textAlign: 'right' }}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Exam Fee</label>
            <div className="input-group">
              <span className="input-group-text">Rs.</span>
              <Input
                type="number"
                className="form-control"
                value={masterBaseFee.examFee || ''}
                onChange={(e) => updateMasterBaseFee('examFee', e.target.value)}
                min="0"
                step="100"
                style={{ textAlign: 'right' }}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Library Fee</label>
            <div className="input-group">
              <span className="input-group-text">Rs.</span>
              <Input
                type="number"
                className="form-control"
                value={masterBaseFee.libraryFee || ''}
                onChange={(e) => updateMasterBaseFee('libraryFee', e.target.value)}
                min="0"
                step="100"
                style={{ textAlign: 'right' }}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Lab Fee</label>
            <div className="input-group">
              <span className="input-group-text">Rs.</span>
              <Input
                type="number"
                className="form-control"
                value={masterBaseFee.labFee || ''}
                onChange={(e) => updateMasterBaseFee('labFee', e.target.value)}
                min="0"
                step="100"
                style={{ textAlign: 'right' }}
                disabled={disabled}
              />
            </div>
          </div>
        </div>

        <Divider />
        
        <div className="form-row">
          <div className="form-group" style={{ width: '100%' }}>
            <div className="total-base-fee">
              <Statistic
                title="Master Total Base Fee"
                value={masterBaseFee.totalBaseFee || 0}
                prefix="Rs."
                valueStyle={{ color: '#1890ff' }}
              />
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                This amount will be applied to all semesters of {batch} unless customized per semester
              </Text>
              {disabled && (
                <Text type="danger" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                  Master base fee is locked and cannot be modified.
                </Text>
              )}
            </div>
          </div>
        </div>

        {Object.keys(semesterBaseFees).length > 0 && (
          <div style={{ padding: '12px', backgroundColor: '#fff7e6', border: '1px solid #ffd591', borderRadius: '6px', marginTop: '16px' }}>
            <Text type="warning">
              {Object.keys(semesterBaseFees).length} semester(s) have custom fees that differ from the master configuration.
            </Text>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="course-fee container mt-5">
      <ToastContainer 
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      
      <h2 className="course-fee-title">Fee Structure Management</h2>
      
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
                {batchItem.currentSemester && ` - Semester ${batchItem.currentSemester}`}
              </option>
            ))}
          </select>
       
        </div>
      </div>

      <div style={{ display: degreeLevel && department && batch ? 'block' : 'block' }}>
       

        <MasterBaseFeeConfiguration />
        
        <Card 
          title="Semester-wise Base Fee Configuration" 
          className="mb-4 Assign-fee-card"
          style={{ borderRadius: '8px', border: 'none' }}
          extra={
            existingFeeStructure ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                Existing Structure 
              </Tag>
            ) : (
              <Tag color="blue" icon={<InfoCircleOutlined />}>
                New Structure
              </Tag>
            )
          }
        >
          {!(degreeLevel && department && batch) ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Text type="secondary">
                Select a batch to configure semester-wise base fees
              </Text>
            </div>
          ) : (
            <Tabs 
              activeKey={activeSemester} 
              onChange={setActiveSemester}
              type="card"
              className="custom-tabs"
            >
              {Array.from({ length: maxSemesters }, (_, i) => i + 1).map(semester => (
                <TabPane 
                  tab={
                    <span>
                      Semester {semester}
                      {semesterBaseFees[semester] && (
                        <Tag color="orange" size="small" style={{ marginLeft: '8px' }}>
                          Custom
                        </Tag>
                      )}
                      {isSemesterDisabled(semester) && (
                        <LockOutlined style={{ marginLeft: '8px', color: '#ff4d4f' }} />
                      )}
                    </span>
                  }
                  key={semester.toString()}
                >
                  <BaseFeeConfigurationCard semester={semester} />
                </TabPane>
              ))}
            </Tabs>
          )}
        </Card>

        <Card 
          className="Assign-fee-card" 
          style={{ borderRadius: '8px', border: 'none' }}
        >
          {!(degreeLevel && department && batch) ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Text type="secondary">
                Select a batch to view and manage course fee assignments
              </Text>
            </div>
          ) : (
            <Tabs 
              activeKey={activeSemester} 
              onChange={setActiveSemester}
              type="card"
              className="custom-tabs"
            >
              {Array.from({ length: maxSemesters }, (_, i) => i + 1).map(semester => (
                <TabPane 
                  tab={`Semester ${semester}`}
                  key={semester.toString()}
                >
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                      <Spin size="large" />
                      <div>Loading courses for semester {semester}...</div>
                    </div>
                  ) : (
                    <div>
                      <Table
                        columns={generateCourseColumns(semester)}
                        dataSource={courseFees[semester] || []}
                        bordered
                        scroll={{ x: true }}
                        pagination={false}
                        loading={false}
                        title={() => (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong>Semester {semester} - Course Fee Assignments</Text>
                            <Tag color="#957bab" style={{padding:'5px'}}>
                              {assignedCount}/{totalCount} courses assigned
                            </Tag>
                          </div>
                        )}
                        rowKey="courseCode"
                        locale={{
                          emptyText: (
                            <div style={{ textAlign: 'center', padding: '20px' }}>
                              No courses found for this semester
                            </div>
                          )
                        }}
                      />
                    </div>
                  )}
                </TabPane>
              ))}
            </Tabs>
          )}
        </Card>

        {degreeLevel && department && batch && (
          <>
            <Card 
              className="Assign-fee-card mb-4" 
              style={{ borderRadius: '8px', border: 'none' }}
            >
              <div className="form-row">
                <div className="form-group">
                  <Button 
                    type="primary" 
                    icon={<CalculatorOutlined />}
                    onClick={calculateFeeBreakdown}
                    disabled={masterBaseFee.totalBaseFee === 0}
                    className='fee-btn'
                  >
                    Calculate Fee Breakdown
                  </Button>
                </div>
                <div className="form-group">
                  <Button 
                    type="primary" 
                    icon={<EyeOutlined />}
                    onClick={viewStudentFees}
                    className='fee-btn'
                  >
                    View Student Fees
                  </Button>
                </div>
                
                <div className="form-group">
                  <Button 
                    type="primary" 
                    icon={<SyncOutlined />}
                    onClick={generateStudentFeeRecords}
                    loading={saving}
                    className='fee-btn'
                  >
                    Generate Student Fees
                  </Button>
                </div>
              </div>
            </Card>

            {semesterBreakdown.length > 0 && (
              <Card 
                className="Assign-fee-card mb-4" 
                style={{ borderRadius: '8px', border: 'none' }}
              >
                <div className="form-row">
                  <div className="form-group">
                    <Statistic
                      title={ 
                        <div style={{
                        fontSize: '14px',
                        fontWeight: '600',      
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        color: '#262626',
                        letterSpacing: '0.5px'
                      }}>
                      Total Base Fee (All Semesters)
                   </div>}
                      value={degreeTotals.totalBaseFeeAllSemesters}
                      prefix="Rs."
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </div>
                  
                  <div className="form-group">
                    <Statistic
                      title={ 
                        <div style={{
                        fontSize: '14px',
                        fontWeight: '600',      
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        color: '#262626',
                        letterSpacing: '0.5px'
                      }}>
                      Total Course Fee (All Semesters)
                   </div>}
                      value={degreeTotals.totalCourseFeeAllSemesters}
                      prefix="Rs."
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </div>
                  
                  <div className="form-group">
                    <Statistic
                      title={ 
                        <div style={{
                        fontSize: '14px',
                        fontWeight: '600',      
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        color: '#262626',
                        letterSpacing: '0.5px'

                      }}>
                      Total Degree Fee 
                   </div>}
                      value={degreeTotals.totalDegreeFee}
                      prefix="Rs."
                      valueStyle={{ color: '#faad14' }}
                    />
                  </div>
                </div>

                <Title level={4}>Semester-wise Breakdown</Title>
                <Table
                  columns={semesterColumns}
                  dataSource={semesterBreakdown}
                  pagination={false}
                  bordered
                  summary={() => (
                    <Table.Summary>
                      <Table.Summary.Row style={{ backgroundColor: '#fafafa' }}>
                        <Table.Summary.Cell index={0} colSpan={3}>
                          <Text strong>Grand Total - {batch}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1}>
                          <Text strong>Rs. {degreeTotals.totalBaseFeeAllSemesters.toLocaleString()}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2}>
                          <Text strong>Rs. {degreeTotals.totalCourseFeeAllSemesters.toLocaleString()}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3}>
                          <Text strong type="success">
                            Rs. {degreeTotals.totalDegreeFee.toLocaleString()}
                          </Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
              </Card>
            )}
          </>
        )}
      </div>

      {degreeLevel && department && batch && (
        <div className="save-button-container">
          <Button 
            type="primary" 
            onClick={saveFeeStructure}
            icon={<SaveOutlined />}
            loading={saving}
            disabled={masterBaseFee.totalBaseFee === 0}
            className="save-button"
            size="large"
          >
            {saving ? 'Saving...' : existingFeeStructure ? 'Update Fees' : 'Save Fees'}
          </Button>
        </div>
      )}

      <Modal
        title={`Student Fees - ${batch}`}
        visible={studentFeesModalVisible}
        onCancel={() => setStudentFeesModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setStudentFeesModalVisible(false)}>
            Close
          </Button>
        ]}
        width={1000}
      >
        <Table
          columns={studentFeeColumns}
          dataSource={studentFeesData}
          pagination={{ pageSize: 10 }}
          loading={loading}
          rowKey="studentId"
          scroll={{ x: 800 }}
        />
        
        {studentFeesData.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text strong>Summary:</Text>
            <div style={{ marginTop: 8 }}>
              <Text>Total Students: {studentFeesData.length}</Text>             
            </div>
          </div>
        )}
      </Modal>

      
    </div>
  );
};

export default Addfee;