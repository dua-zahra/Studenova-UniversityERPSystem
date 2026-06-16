import React, { useEffect, useState } from "react";
import {
  Card, Select, Button, Table, Input, message, Row, Col, Typography, Space, Tag
} from "antd";
import { TeamOutlined, EditOutlined, SaveOutlined, CalendarOutlined } from "@ant-design/icons";
import axios from "axios";
import "../../../assets/style.css";
const { Title, Text } = Typography;
const { Option } = Select;

const ManageResults = () => {
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
  const [resultsData, setResultsData] = useState({});
  const [batchDetails, setBatchDetails] = useState(null);
  const [loading, setLoading] = useState({
    degree: false, department: false, batch: false, results: false,
    batchDetails: false, table: false, saving: false
  });
  const [isEditing, setIsEditing] = useState(false);
  const [assessmentDetails, setAssessmentDetails] = useState({});

  const backendURL = "http://localhost:65000/api";

  useEffect(() => {
    const fetchDegrees = async () => {
      setLoading(prev => ({ ...prev, degree: true }));
      try {
        const res = await axios.get(`${backendURL}/degree-levels`);
        const data = Array.isArray(res.data) ? res.data : res.data.degreeLevels || [];
        setDegreeLevels(data.map(dl => (typeof dl === "string" ? { _id: dl, name: dl } : dl)));
      } catch {
        message.error("Failed to fetch degree levels");
      } finally { setLoading(prev => ({ ...prev, degree: false })); }
    };
    fetchDegrees();
  }, []);

  useEffect(() => {
    if (!selectedDegree) { setDepartments([]); setSelectedDepartment(null); return; }
    const fetchDepartments = async () => {
      setLoading(prev => ({ ...prev, department: true }));
      try {
        const res = await axios.get(`${backendURL}/departments/by-degree`, {
          params: { degreeLevel: selectedDegree }
        });
        setDepartments(Array.isArray(res.data) ? res.data : res.data.departments || []);
      } catch {
        message.error("Failed to fetch departments");
      } finally { setLoading(prev => ({ ...prev, department: false })); }
    };
    fetchDepartments();
  }, [selectedDegree]);

  useEffect(() => {
    if (!selectedDegree || !selectedDepartment) { setBatches([]); setSelectedBatch(null); return; }
    const fetchActiveBatches = async () => {
      setLoading(prev => ({ ...prev, batch: true }));
      try {
        const res = await axios.get(`${backendURL}/teacher-assignment/batches/active`, {
          params: { degreeLevel: selectedDegree, department: selectedDepartment }
        });
        const data = Array.isArray(res.data) ? res.data : res.data.batches || res.data.data || [];
        if (!data.length) message.warning("No active batches found for this department");
        setBatches(data);
      } catch {
        message.error("Failed to fetch active batches"); setBatches([]);
      } finally { setLoading(prev => ({ ...prev, batch: false })); }
    };
    fetchActiveBatches();
  }, [selectedDegree, selectedDepartment]);

  const fetchSemesters = async () => {
    if (!selectedDegree || !selectedDepartment || !selectedBatch) return;
    setLoading(prev => ({ ...prev, results: true, batchDetails: true }));
    try {
      const res = await axios.get(`${backendURL}/course-entries`, {
        params: { degreeLevel: selectedDegree, department: selectedDepartment }
      });
      
      const allSemesters = res.data?.semesters || [];
      const batchRes = await axios.get(`${backendURL}/batches/${selectedBatch}`);
      const batchData = batchRes.data?.data || batchRes.data;
      const currentSemester = batchData?.currentSemester || 1;
      
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
    } finally { setLoading(prev => ({ ...prev, results: false, batchDetails: false })); }
  };

  const fetchResultsData = async (courseCode, sectionName) => {
    if (!selectedBatch || selectedSemesterIndex === null || !sectionName || !courseCode) return;

    setLoading(prev => ({ ...prev, table: true }));
    setIsEditing(false);

    try {
      const semesterNumber = Number(semestersData[selectedSemesterIndex]?.semesterNumber);
      const batchObj = batches.find(b => b._id === selectedBatch);
      const batchName = batchObj?.batchName || selectedBatch;

      setSelectedCourse(courseCode);
      setSelectedSection(sectionName);

      const res = await axios.get(`${backendURL}/results/by-course-section-with-teacher`, {
        params: { batchName, semester: semesterNumber, courseCode, sectionName }
      });

      const studentsData = res.data.students || [];
      if (!studentsData.length) {
        setResultsData({ empty: true });
        setAssessmentDetails({});
        message.info("No results recorded for this course-section yet");
      } else {
        const students = studentsData.map(s => ({
          key: s.studentId,
          studentId: s.studentId,
          studentName: s.studentName,
          resultsRecords: s.assessments?.map(a => ({ 
            name: a.name, 
            obtainedMarks: a.obtainedMarks,
            totalMarks: a.totalMarks,
            weightage: a.weightage
          })) || []
        }));

        const details = {};
        students.forEach(s => {
          s.resultsRecords?.forEach(r => {
            if (!details[r.name]) {
              details[r.name] = {
                totalMarks: r.totalMarks,
                weightage: r.weightage
              };
            }
          });
        });

        setAssessmentDetails(details);
        setResultsData({ students });
        message.success("Results data loaded successfully");
      }
    } catch (err) {
      console.error(err);
      message.error("Failed to fetch results data");
    } finally { setLoading(prev => ({ ...prev, table: false })); }
  };

  const toggleEdit = () => setIsEditing(!isEditing);

  const saveResults = async () => {
    if (!selectedBatch || selectedSemesterIndex === null || !selectedCourse || !selectedSection) {
      message.error("Please select batch, semester, course, and section"); return;
    }

    setLoading(prev => ({ ...prev, saving: true }));

    try {
      const semesterNumber = Number(semestersData[selectedSemesterIndex]?.semesterNumber);
      const batchObj = batches.find(b => b._id === selectedBatch);
      const batchName = batchObj?.batchName || selectedBatch;

      const payload = {
        batchName,
        semester: semesterNumber,
        courseCode: selectedCourse,
        courseName: selectedCourse,
        sectionName: selectedSection,
        students: resultsData.students.map(s => ({
          studentId: s.studentId,
          studentName: s.studentName,
          resultsRecords: s.resultsRecords.map(r => ({
            name: r.name,
            obtainedMarks: r.obtainedMarks,
            totalMarks: r.totalMarks,
            weightage: r.weightage
          }))
        }))
      };

      const res = await axios.put(`${backendURL}/results/update`, payload);

      if (res.data?.success) {
        message.success("Results updated successfully");
        setIsEditing(false);
        fetchResultsData(selectedCourse, selectedSection);
      } else {
        message.error(res.data?.message || "Failed to save results");
      }
    } catch (err) {
      console.error(err);
      message.error("Failed to save results");
    } finally { setLoading(prev => ({ ...prev, saving: false })); }
  };

  const generateResultsColumns = () => {
    const students = resultsData.students || [];
    if (!students.length) return [];

    const nameColumns = Object.keys(assessmentDetails).sort().map(name => {
      const assessment = assessmentDetails[name];
      return {
        title: (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: "bold", fontSize: "14px" }}>{name}</div>
            <div style={{ fontSize: "12px", color: "#666" }}>
              Marks: {assessment.totalMarks} | Weight: {assessment.weightage}%
            </div>
          </div>
        ),
        key: name,
        align: "center",
        width: 150,
        render: (_, record) => {
          const rec = record.resultsRecords.find(r => r.name === name);
          const marks = rec?.obtainedMarks || 0;
          if (!isEditing) return (
            <div>
              <div style={{ fontWeight: "500" }}>{marks}</div>
              <div style={{ fontSize: "11px", color: "#666" }}>
                / {assessment.totalMarks}
              </div>
            </div>
          );
          return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
              <Input
                type="number"
                value={marks}
                onChange={e => {
                  const updatedStudents = [...resultsData.students];
                  const student = updatedStudents.find(s => s.studentId === record.studentId);
                  if (student) {
                    const recordItem = student.resultsRecords.find(r => r.name === name);
                    if (recordItem) {
                      recordItem.obtainedMarks = Number(e.target.value);
                    } else {
                      student.resultsRecords.push({ 
                        name, 
                        obtainedMarks: Number(e.target.value),
                        totalMarks: assessment.totalMarks,
                        weightage: assessment.weightage
                      });
                    }
                    setResultsData({ students: updatedStudents });
                  }
                }}
                style={{ width: 70, textAlign: "center" }}
                min={0}
                max={assessment.totalMarks}
              />
              <div style={{ fontSize: "10px", color: "#999" }}>
                / {assessment.totalMarks}
              </div>
            </div>
          );
        }
      };
    });

    return [
      { 
        title: "Student ID", 
        dataIndex: "studentId", 
        key: "studentId", 
        fixed: "left", 
        width: 120,
        render: (text) => <Text strong>{text}</Text>
      },
      { 
        title: "Student Name", 
        dataIndex: "studentName", 
        key: "studentName", 
        fixed: "left", 
        width: 150,
        render: (text) => <Text strong>{text}</Text>
      },
      ...nameColumns,
      {
        title: (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: "bold", fontSize: "14px" }}>Total</div>
            <div style={{ fontSize: "12px", color: "#666" }}>Marks</div>
          </div>
        ),
        key: "total",
        align: "center",
        width: 100,
        fixed: "right",
        render: (_, record) => {
          const total = record.resultsRecords?.reduce((sum, r) => sum + (r.obtainedMarks || 0), 0) || 0;
          const maxTotal = Object.values(assessmentDetails).reduce((sum, a) => sum + a.totalMarks, 0);
          return (
            <div>
              <div style={{ fontWeight: "bold", color: "#1890ff" }}>{total}</div>
              <div style={{ fontSize: "11px", color: "#666" }}>/ {maxTotal}</div>
            </div>
          );
        }
      },
      {
        title: (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: "bold", fontSize: "14px" }}>Percentage</div>
            <div style={{ fontSize: "12px", color: "#666" }}>%</div>
          </div>
        ),
        key: "percentage",
        align: "center",
        width: 100,
        fixed: "right",
        render: (_, record) => {
          const totalObtained = record.resultsRecords?.reduce((sum, r) => sum + (r.obtainedMarks || 0), 0) || 0;
          const maxTotal = Object.values(assessmentDetails).reduce((sum, a) => sum + a.totalMarks, 0);
          const percentage = maxTotal > 0 ? ((totalObtained / maxTotal) * 100).toFixed(1) : 0;
          return (
            <div style={{ fontWeight: "bold", color: percentage >= 50 ? "#52c41a" : "#ff4d4f" }}>
              {percentage}%
            </div>
          );
        }
      }
    ];
  };

  const renderTableSummary = () => {
    if (Object.keys(assessmentDetails).length === 0) return null;

    return (
      <Table.Summary>
        <Table.Summary.Row style={{ background: "#fafafa" }}>
          <Table.Summary.Cell index={0} colSpan={2}>
            <Text strong>Assessment Summary</Text>
          </Table.Summary.Cell>
          {Object.keys(assessmentDetails).sort().map((name, index) => {
            const assessment = assessmentDetails[name];
            return (
              <Table.Summary.Cell index={index + 2} key={name}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "12px" }}>Max: {assessment.totalMarks}</div>
                  <div style={{ fontSize: "12px" }}>Weight: {assessment.weightage}%</div>
                </div>
              </Table.Summary.Cell>
            );
          })}
          <Table.Summary.Cell index={999} colSpan={2}></Table.Summary.Cell>
        </Table.Summary.Row>
      </Table.Summary>
    );
  };

  return (
     <div className="Timetable-Management container mt-5">
      
        <h2 className="Timetable-Management-title ">
          Manage Results
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
              loading={loading.results || loading.batchDetails}
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

      {/* Courses Section - No border */}
      {selectedSemesterIndex !== null && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 16
          }}>
            <Title level={4} style={{ margin: 0 }}>Courses</Title>
            <Text>Select a course to view results</Text>
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
                    fetchResultsData(course.courseCode, selectedSection);
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

      {/* Sections Section - No border */}
      {sectionsData.length > 0 && selectedSemesterIndex !== null && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 16
          }}>
            <Title level={4} style={{ margin: 0 }}>Sections</Title>
            <Text>Select a section to view results</Text>
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
                    fetchResultsData(selectedCourse, section.name);
                  }}
                >
                  {section.name}
                </Button>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* Edit/Save Controls - No border */}
      {resultsData.students && resultsData.students.length > 0 && (
        <div style={{ marginBottom: 24, textAlign: "right" }}>
          <Space>
            {isEditing ? (
              <Button 
                type="primary" 
                icon={<SaveOutlined />} 
                loading={loading.saving} 
                onClick={saveResults}
                style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
              >
                Save Results
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
                Edit Results
              </Button>
            )}
          </Space>
        </div>
      )}

      {/* Results Table - With border only for the table */}
      <div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 16
        }}>
          <Title level={4} style={{ margin: 0 }}>Results Records</Title>
          {selectedCourse && selectedSection && (
            <Text strong>
              Showing: {selectedCourse} - {selectedSection}
            </Text>
          )}
        </div>
        
        {resultsData.empty ? (
          <div style={{ 
            textAlign: "center", 
            padding: 40, 
            border: "1px solid #e8e8e8",
            borderRadius: 6,
            background: "#fafafa"
          }}>
            <Text type="secondary">
              No results records found for the selected course and section
            </Text>
          </div>
        ) : resultsData.students ? (
          <Table
            columns={generateResultsColumns()}
            dataSource={resultsData.students}
            bordered
            scroll={{ x: "max-content" }}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            summary={renderTableSummary}
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
              Select a semester, course, and section to view results records
            </Text>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageResults;