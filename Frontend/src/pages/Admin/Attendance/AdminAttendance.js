import React, { useEffect, useState } from "react";
import {
  Card, Select, Button, Table, message,
  Row, Col, Typography, Badge, Space, Tag
} from "antd";
import { TeamOutlined, EditOutlined, SaveOutlined, CalendarOutlined } from "@ant-design/icons";
import axios from "axios";
import moment from "moment";
import "../../../assets/style.css";
import API_URL from '../../../config';
const { Title, Text } = Typography;
const { Option } = Select;

const ManageAttendance = () => {
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedDegree, setSelectedDegree] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [semestersData, setSemestersData] = useState([]);
  const [selectedSemesterIndex, setSelectedSemesterIndex] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [sectionsData, setSectionsData] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [attendanceData, setAttendanceData] = useState({});
  const [batchDetails, setBatchDetails] = useState(null);
  const [loading, setLoading] = useState({
    degree: false,
    department: false,
    batch: false,
    attendance: false,
    batchDetails: false,
    table: false,
    saving: false
  });
  const [isEditing, setIsEditing] = useState(false);

  // `${API_URL}/api` = "http://localhost:65000/api";
const backendURL = `${API_URL}/api`;

  useEffect(() => {
    const fetchDegrees = async () => {
      setLoading(prev => ({ ...prev, degree: true }));
      try {
        const res = await axios.get(`${backendURL}/degree-levels`);
        const data = Array.isArray(res.data) ? res.data : res.data.degreeLevels || [];
        setDegreeLevels(data.map(dl => (typeof dl === "string" ? { _id: dl, name: dl } : dl)));
        message.success("Degree levels loaded successfully");
      } catch {
        message.error("Failed to fetch degree levels");
      } finally {
        setLoading(prev => ({ ...prev, degree: false }));
      }
    };
    fetchDegrees();
  }, []);

  useEffect(() => {
    if (!selectedDegree) {
      setDepartments([]);
      setSelectedDepartment(null);
      return;
    }
    const fetchDepartments = async () => {
      setLoading(prev => ({ ...prev, department: true }));
      try {
        const res = await axios.get(`${backendURL}/departments/by-degree`, {
          params: { degreeLevel: selectedDegree }
        });
        setDepartments(Array.isArray(res.data) ? res.data : res.data.departments || []);
        message.success("Departments loaded successfully");
      } catch {
        message.error("Failed to fetch departments");
      } finally {
        setLoading(prev => ({ ...prev, department: false }));
      }
    };
    fetchDepartments();
  }, [selectedDegree]);

  useEffect(() => {
    if (!selectedDegree || !selectedDepartment) {
      setBatches([]);
      setSelectedBatch(null);
      return;
    }
    const fetchActiveBatches = async () => {
      setLoading(prev => ({ ...prev, batch: true }));
      try {
        const res = await axios.get(`${backendURL}/teacher-assignment/batches/active`, {
          params: { degreeLevel: selectedDegree, department: selectedDepartment }
        });
        const data = Array.isArray(res.data) ? res.data : res.data.batches || res.data.data || [];
        if (!data.length) message.warning("No active batches found for this department");
        else message.success("Batches loaded successfully");
        setBatches(data);
      } catch {
        message.error("Failed to fetch active batches");
        setBatches([]);
      } finally {
        setLoading(prev => ({ ...prev, batch: false }));
      }
    };
    fetchActiveBatches();
  }, [selectedDegree, selectedDepartment]);

  // ---------------- Fetch Semesters & Sections ----------------
  const fetchSemesters = async () => {
    if (!selectedDegree || !selectedDepartment || !selectedBatch) return;
    setLoading(prev => ({ ...prev, attendance: true, batchDetails: true }));
    try {
      const res = await axios.get(`${backendURL}/course-entries`, {
        params: { degreeLevel: selectedDegree, department: selectedDepartment }
      });
      
      const allSemesters = res.data?.semesters || [];
      const batchRes = await axios.get(`${backendURL}/batches/${selectedBatch}`);
      const batchData = batchRes.data?.data || batchRes.data;
      const currentSemester = batchData?.currentSemester || 1;
      
      // Show all semesters but mark future ones as disabled
      const semestersWithStatus = allSemesters.map(sem => ({
        ...sem,
        isFuture: sem.semesterNumber > currentSemester,
        isCurrent: sem.semesterNumber === currentSemester
      }));
      
      setSemestersData(semestersWithStatus);
      setSelectedSemesterIndex(null);
      setBatchDetails(batchData);
      setSectionsData(batchData?.sections || []);
      setSelectedSection(batchData?.sections?.[0]?.name || null);
      
      message.success("Semesters and batch details loaded successfully");
    } catch (err) {
      console.error(err);
      message.error("Failed to fetch semesters or batch details");
    } finally {
      setLoading(prev => ({ ...prev, attendance: false, batchDetails: false }));
    }
  };

  // ---------------- Fetch Attendance Table ----------------
  const fetchAttendanceData = async (courseCode, sectionName) => {
    if (!selectedBatch || selectedSemesterIndex === null || !sectionName) return;
    setLoading(prev => ({ ...prev, table: true }));
    setIsEditing(false);
    try {
      const semesterNumber = semestersData[selectedSemesterIndex]?.semesterNumber;
      const res = await axios.get(`${backendURL}/attendance/by-course-section`, {
        params: { batchId: selectedBatch, semester: semesterNumber, courseCode, sectionName }
      });

      if (!res.data || !res.data.students?.length) {
        setAttendanceData({ empty: true });
        message.info("No attendance marked for this course-section yet");
      } else {
        const students = res.data.students.map(s => ({
          ...s,
          key: s.studentId,
          attendanceRecords: s.attendanceRecords?.map(r => ({
            date: r.date,
            status: r.status
          })) || [],
          percentage: s.percentage || 0
        }));
        setAttendanceData({ students });
        message.success("Attendance data loaded successfully");
      }
      setSelectedCourse(courseCode);
      setSelectedSection(sectionName);
    } catch (err) {
      console.error(err);
      message.error("Failed to fetch attendance data");
    } finally {
      setLoading(prev => ({ ...prev, table: false }));
    }
  };

  // ---------------- Handle Edit / Save ----------------
  const toggleEdit = () => setIsEditing(!isEditing);

  const saveAttendance = async () => {
    if (!selectedBatch || selectedSemesterIndex === null || !selectedCourse || !selectedSection) {
      message.error("Please select batch, semester, course, and section");
      return;
    }

    setLoading(prev => ({ ...prev, saving: true }));

    try {
      const semesterNumber = semestersData[selectedSemesterIndex]?.semesterNumber;

      const payload = {
        batchId: selectedBatch,
        semester: semesterNumber,
        courseCode: selectedCourse,
        courseName: selectedCourse,
        sectionName: selectedSection,
        students: attendanceData.students.map(s => ({
          studentId: s.studentId,
          studentName: s.studentName,
          attendanceRecords: s.attendanceRecords.map(r => ({
            date: r.date,
            status: r.status
          }))
        }))
      };

      const res = await axios.post(`${backendURL}/attendance/attendance/update`, payload);

      if (res.data?.success) {
        message.success("Attendance updated successfully");
        setIsEditing(false);
        fetchAttendanceData(selectedCourse, selectedSection);
      } else {
        message.error(res.data?.message || "Failed to save attendance");
      }
    } catch (err) {
      console.error(err);
      message.error("Failed to save attendance");
    } finally {
      setLoading(prev => ({ ...prev, saving: false }));
    }
  };

  const generateAttendanceColumns = () => {
    const students = attendanceData.students || [];
    if (!students.length) return [];

    const allDates = new Set();
    students.forEach(s =>
      s.attendanceRecords?.forEach(r => allDates.add(moment(r.date).format("YYYY-MM-DD")))
    );

    const dateColumns = Array.from(allDates).sort().map(date => ({
      title: moment(date).format("MMM DD"),
      key: date,
      align: "center",
      render: (_, record) => {
        const rec = record.attendanceRecords.find(r => moment(r.date).format("YYYY-MM-DD") === date);
        const status = rec?.status || "Absent";
        if (!isEditing) {
          return (
            <Badge
              count={status === "Present" ? "P" : "A"}
              style={{ backgroundColor: status === "Present" ? "#52c41a" : "#ff4d4f" }}
            />
          );
        } else {
          return (
            <Select
              value={status}
              onChange={val => {
                const updatedStudents = [...attendanceData.students];
                const student = updatedStudents.find(s => s.studentId === record.studentId);
                if (student) {
                  const recordItem = student.attendanceRecords.find(r => moment(r.date).format("YYYY-MM-DD") === date);
                  if (recordItem) recordItem.status = val;
                  else student.attendanceRecords.push({ date, status: val });
                  setAttendanceData({ students: updatedStudents });
                }
              }}
              style={{ width: 70 }}
            >
              <Option value="Present">Present</Option>
              <Option value="Absent">Absent</Option>
            </Select>
          );
        }
      }
    }));

    return [
      { title: "Student ID", dataIndex: "studentId", key: "studentId", fixed: "left", width: 120 },
      { title: "Student Name", dataIndex: "studentName", key: "studentName", fixed: "left", width: 150 },
      ...dateColumns,
      {
        title: "Attendance %",
        dataIndex: "percentage",
        key: "percentage",
        align: "center",
        render: perc => <span style={{ color: perc < 50 ? "red" : "inherit" }}>{perc}%</span>
      }
    ];
  };

  return (
    <div className="Timetable-Management container mt-5">
      
        <h2 className="Timetable-Management-title ">
          Manage Attendance
        </h2>
  
      <div style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} sm={8} md={6}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Degree Level</Text>
            <Select
              placeholder="Select Degree"
              value={selectedDegree}
              onChange={value => { 
                setSelectedDegree(value); 
                setSelectedDepartment(null); 
                setSelectedBatch(null); 
                setSectionsData([]); 
                setSelectedSection(null); 
              }}
              style={{ width: "100%" }}
              loading={loading.degree}
              allowClear
            >
              {degreeLevels.map(dl => <Option key={dl._id} value={dl.name}>{dl.name}</Option>)}
            </Select>
          </Col>
          
          <Col xs={24} sm={8} md={6}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Department</Text>
            <Select
              placeholder="Select Department"
              value={selectedDepartment}
              onChange={value => { 
                setSelectedDepartment(value); 
                setSelectedBatch(null); 
                setSectionsData([]); 
                setSelectedSection(null); 
              }}
              style={{ width: "100%" }}
              loading={loading.department}
              disabled={!selectedDegree}
              allowClear
            >
              {departments.map(d => <Option key={d._id} value={d.departmentName || d.name}>{d.departmentName || d.name}</Option>)}
            </Select>
          </Col>
          
          <Col xs={24} sm={8} md={6}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Batch</Text>
            <Select
              placeholder="Select Batch"
              value={selectedBatch}
              onChange={setSelectedBatch}
              style={{ width: "100%" }}
              loading={loading.batch}
              disabled={!selectedDepartment}
              allowClear
            >
              {batches.map(b => <Option key={b._id} value={b._id}>{b.batchName}</Option>)}
            </Select>
          </Col>
          
          <Col xs={24} sm={24} md={6} style={{ display: "flex", alignItems: "flex-end" }}>
            <Button
              type="primary"
              block
              style={{
                backgroundColor: "#957bab",
                borderColor: "#957bab",
                fontWeight: "600",
                height: 40
              }}
              loading={loading.attendance || loading.batchDetails}
              onClick={fetchSemesters}
              disabled={!selectedBatch}
              icon={<CalendarOutlined />}
            >
              Load Semesters
            </Button>
          </Col>
        </Row>
      </div>

      {/* Batch Details - No border */}
      {batchDetails && (
        <div style={{ 
          marginBottom: 16, 
          padding: 16, 
          background: "#fafafa",
          borderRadius: 6
        }}>
          <Row gutter={16}>
            <Col span={6}>
              <Text strong>Batch: </Text>
              {batchDetails.batchName}
            </Col>
            <Col span={6}>
              <Text strong>Current Semester: </Text>
              <Tag color="blue">Semester {batchDetails.currentSemester}</Tag>
            </Col>
            <Col span={6}>
              <Text strong>Degree: </Text>
              {selectedDegree}
            </Col>
            <Col span={6}>
              <Text strong>Department: </Text>
              {selectedDepartment}
            </Col>
          </Row>
        </div>
      )}

      {/* Semesters Section - No border card */}
      {semestersData.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 16
          }}>
            <Title level={4} style={{ margin: 0 }}>Available Semesters</Title>
            <Text type="secondary">Future semesters are disabled</Text>
          </div>
          <Row gutter={[8, 8]}>
            {semestersData.map((sem, idx) => (
              <Col key={idx}>
                <Button
                  type={selectedSemesterIndex === idx ? "primary" : "default"}
                  style={{
                    backgroundColor: selectedSemesterIndex === idx ? "#957bab" : 
                                    sem.isFuture ? "#f5f5f5" : undefined,
                    borderColor: selectedSemesterIndex === idx ? "#957bab" : 
                                sem.isFuture ? "#d9d9d9" : undefined,
                    color: sem.isFuture ? "#bfbfbf" : undefined,
                  }}
                  onClick={() => !sem.isFuture && setSelectedSemesterIndex(idx)}
                  disabled={sem.isFuture}
                  icon={sem.isCurrent && <CalendarOutlined />}
                >
                  Semester {sem.semesterNumber}
                  {sem.isCurrent && <Tag color="green" style={{ marginLeft: 8 }}>Current</Tag>}
                  {sem.isFuture && <Tag color="default" style={{ marginLeft: 8 }}>Future</Tag>}
                </Button>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {selectedSemesterIndex !== null && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 16
          }}>
            <Title level={4} style={{ margin: 0 }}>Courses</Title>
            <Text>Select a course to view attendance</Text>
          </div>
          <Row gutter={[12, 12]}>
            {semestersData[selectedSemesterIndex].courses.map((course, idx) => (
              <Col key={idx} xs={24} sm={12} md={8} lg={6}>
                <div
                  style={{
                    height: 100,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    border: selectedCourse === course.courseCode ? "2px solid #957bab" : "1px solid #e8e8e8",
                    background: selectedCourse === course.courseCode ? "#f9f0ff" : "#fff",
                    borderRadius: 6,
                    padding: 12,
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.3s"
                  }}
                  onClick={() => {
                    if (!selectedSection) { 
                      message.warning("Please select a section first"); 
                      return; 
                    }
                    fetchAttendanceData(course.courseCode, selectedSection);
                  }}
                >
                  <Text strong style={{ color: "#2c3e50" }}>
                    {course.courseCode}
                  </Text>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                    {course.courseName}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {sectionsData.length > 0 && selectedSemesterIndex !== null && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 16
          }}>
            <Title level={4} style={{ margin: 0 }}>Sections</Title>
            <Text>Select a section to view attendance</Text>
          </div>
          <Row gutter={[8, 8]}>
            {sectionsData.map((section, idx) => (
              <Col key={idx}>
                <Button
                  type={selectedSection === section.name ? "primary" : "default"}
                  style={{
                    backgroundColor: selectedSection === section.name ? "#957bab" : undefined,
                    borderColor: selectedSection === section.name ? "#957bab" : undefined,
                  }}
                  onClick={() => {
                    if (!selectedCourse) { 
                      message.warning("Please select a course first"); 
                      return; 
                    }
                    fetchAttendanceData(selectedCourse, section.name);
                  }}
                >
                  {section.name}
                </Button>
              </Col>
            ))}
          </Row>
        </div>
      )}

      
      {attendanceData.students && attendanceData.students.length > 0 && (
        <div style={{ marginBottom: 24, textAlign: "right" }}>
          <Space>
            {isEditing ? (
              <Button 
                type="primary" 
                icon={<SaveOutlined />} 
                loading={loading.saving} 
                onClick={saveAttendance}
                style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
              >
                Save Attendance
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={toggleEdit}
                style={{
                  backgroundColor: "#957bab",
                  borderColor: "#957bab",
                }}
              >
                Edit Attendance
              </Button>
            )}
          </Space>
        </div>
      )}

      {/* Attendance Table - With border only for the table */}
      <div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 16
        }}>
          <Title level={4} style={{ margin: 0 }}>Attendance Records</Title>
          {selectedCourse && selectedSection && (
            <Text strong>
              Showing: {selectedCourse} - {selectedSection}
            </Text>
          )}
        </div>
        
        {attendanceData.empty ? (
          <div style={{ 
            textAlign: "center", 
            padding: 40, 
            border: "1px solid #e8e8e8",
            borderRadius: 6,
            background: "#fafafa"
          }}>
            <Text type="secondary">
              No attendance records found for the selected course and section
            </Text>
          </div>
        ) : attendanceData.students ? (
          <Table
            columns={generateAttendanceColumns()}
            dataSource={attendanceData.students}
            bordered
            scroll={{ x: "max-content" }}
            pagination={{ pageSize: 10 }}
            loading={loading.table}
          />
        ) : (
          <div style={{ 
            textAlign: "center", 
            padding: 40, 
            border: "1px solid #e8e8e8",
            borderRadius: 6,
            background: "#fafafa"
          }}>
            <Text type="secondary">
              Select a semester, course, and section to view attendance records
            </Text>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageAttendance;