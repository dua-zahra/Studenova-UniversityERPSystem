import React, { useEffect, useState } from "react";
import axios from "axios";
import { Table, InputNumber, Button, Spin, Modal, Input, message, Popconfirm, Tag } from "antd";
import "antd/dist/reset.css";
import { addDays, isAfter } from "date-fns";
import API_URL from '../../config';

function FacultyResultsPage() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [components, setComponents] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentComponent, setCurrentComponent] = useState(null);
  const [canEdit, setCanEdit] = useState(true);
  const [savedResults, setSavedResults] = useState(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const facultyUser = JSON.parse(localStorage.getItem("user") || "{}");
        const facultyEmail = facultyUser?.universityEmail || facultyUser?.email;
        if (!facultyEmail) {
          message.error("Logged-in faculty email not found");
          setLoadingCourses(false);
          return;
        }

        const response = await axios.get(
          `${API_URL}/faculty-courses/courses`,
          { params: { universityEmail: facultyEmail } }
        );

        let activeCourses = (response.data.courses || []).filter(
          (c) => c.teachingStatus === "in-progress" && c.isActive
        );

        setCourses(activeCourses);

        for (const course of activeCourses) {
          try {
            const res = await axios.get(
              `${API_URL}/students/by-course/${encodeURIComponent(course.courseCode)}`,
              { params: { section: course.sectionName, batchId: course.batchId } }
            );
            const count = (res.data.students || []).length;
            setCourses((prev) =>
              prev.map((c) =>
                c.courseCode === course.courseCode && c.sectionName === course.sectionName
                  ? { ...c, totalStudents: count }
                  : c
              )
            );
          } catch {}
        }
      } catch (err) {
        console.error(err);
        message.error("Failed to load courses");
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchCourses();
  }, []);

  const fetchStudents = async (course) => {
    try {
      setSelectedCourse(course);
      setLoadingStudents(true);

      if (course.semesterEndDate) {
        const weekAfterEnd = addDays(new Date(course.semesterEndDate), 7);
        setCanEdit(!isAfter(new Date(), weekAfterEnd));
      } else {
        setCanEdit(true);
      }

      const resStudents = await axios.get(
        `${API_URL}/students/by-course/${encodeURIComponent(course.courseCode)}`,
        { params: { section: course.sectionName, batchId: course.batchId } }
      );

      let fetchedStudents = (resStudents.data.students || []).map((s) => ({
        studentId: s.studentId,
        fullName: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
        resultsRecords: [],
      }));

      let existingComponents = [];
      let savedResultsData = null;

      try {
        const resResults = await axios.get(`${API_URL}/results/by-course-section-with-teacher`, {
          params: {
            batchName: course.batchName,
            courseCode: course.courseCode,
            sectionName: course.sectionName,
          },
        });

        savedResultsData = resResults.data;
        setSavedResults(savedResultsData);

        if (savedResultsData?.students?.length > 0) {
          const assessmentMap = new Map();

          savedResultsData.students.forEach((student) => {
            student.assessments?.forEach((assessment) => {
              const key = `${assessment.name}-${assessment.totalMarks}-${assessment.weightage}`;
              if (!assessmentMap.has(key)) {
                assessmentMap.set(key, {
                  key,
                  name: assessment.name,
                  totalMarks: assessment.totalMarks,
                  weightage: assessment.weightage,
                });
              }
            });
          });

          existingComponents = Array.from(assessmentMap.values());

          fetchedStudents = fetchedStudents.map((student) => {
            const savedStudent = savedResultsData.students.find(
              (s) => s.studentId === student.studentId
            );
            if (!savedStudent) return student;

            return {
              ...student,
              resultsRecords:
                savedStudent.assessments?.map((assessment) => ({
                  name: assessment.name,
                  obtainedMarks: assessment.obtainedMarks || 0,
                  totalMarks: assessment.totalMarks,
                  weightage: assessment.weightage,
                })) || [],
            };
          });
        }

        setComponents(existingComponents);
      } catch (err) {
        console.log("No existing results found");
        setSavedResults(null);
      }

      setStudents(fetchedStudents);
    } catch (err) {
      console.error(err);
      message.error("Failed to fetch students or results");
      setStudents([]);
      setComponents([]);
      setSavedResults(null);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleMarksChange = (studentId, compKey, value) => {
    if (!canEdit) return;
    if (isNaN(value) || value < 0) value = 0;

    setStudents((prev) =>
      prev.map((s) => {
        if (s.studentId !== studentId) return s;

        const comp = components.find((c) => c.key === compKey);
        if (!comp) return s;

        const val = Math.min(value, comp.totalMarks || 0);

        const existingRecordIndex = s.resultsRecords.findIndex(
          (r) =>
            r.name === comp.name &&
            r.totalMarks === comp.totalMarks &&
            r.weightage === comp.weightage
        );

        if (existingRecordIndex > -1) {
          const updatedRecords = [...s.resultsRecords];
          updatedRecords[existingRecordIndex] = {
            ...updatedRecords[existingRecordIndex],
            obtainedMarks: val,
          };
          return { ...s, resultsRecords: updatedRecords };
        } else {
          return {
            ...s,
            resultsRecords: [
              ...s.resultsRecords,
              {
                name: comp.name,
                obtainedMarks: val,
                totalMarks: comp.totalMarks,
                weightage: comp.weightage,
              },
            ],
          };
        }
      })
    );
  };

  const openComponentModal = (comp = null) => {
    if (!canEdit) return;
    setCurrentComponent(
      comp
        ? { ...comp }
        : {
            name: "",
            totalMarks: 10,
            weightage: 0,
            key: `dynamic-${Date.now()}`,
          }
    );
    setModalVisible(true);
  };


  const handleModalSave = () => {
    if (!currentComponent?.name || currentComponent.name.trim() === "") {
      message.error("Assessment name is required");
      return;
    }
    if (currentComponent.weightage <= 0) {
      message.error("Weightage must be greater than 0");
      return;
    }

    const compKey = `${currentComponent.name}-${currentComponent.totalMarks}-${currentComponent.weightage}`;

    setComponents((prev) => {
      const exists = prev.find((c) => c.key === compKey);
      if (exists) return prev;
      return [...prev, { ...currentComponent, key: compKey }];
    });

    setStudents((prevStudents) =>
      prevStudents.map((stu) => {
        const alreadyExists = stu.resultsRecords.some(
          (r) =>
            r.name === currentComponent.name &&
            r.totalMarks === currentComponent.totalMarks &&
            r.weightage === currentComponent.weightage
        );

        if (alreadyExists) return stu;

        return {
          ...stu,
          resultsRecords: [
            ...stu.resultsRecords,
            {
              name: currentComponent.name,
              obtainedMarks: 0,
              totalMarks: currentComponent.totalMarks,
              weightage: currentComponent.weightage,
            },
          ],
        };
      })
    );

    setModalVisible(false);
  };

  const handleRemoveComponent = (compKey) => {
    if (!canEdit) return;
    const compToRemove = components.find((c) => c.key === compKey);

    setComponents((prev) => prev.filter((c) => c.key !== compKey));

    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        resultsRecords: s.resultsRecords.filter(
          (r) =>
            !(
              r.name === compToRemove.name &&
              r.totalMarks === compToRemove.totalMarks &&
              r.weightage === compToRemove.weightage
            )
        ),
      }))
    );
  };

  const handleSaveResults = async () => {
    if (!selectedCourse) return;
    if (components.length === 0) {
      message.warning("Please add at least one assessment before saving results");
      return;
    }

    try {
      const semesterNumber = selectedCourse.semester || 1;
      const batchName = selectedCourse.batchName;
      const courseCode = selectedCourse.courseCode;
      const sectionName = selectedCourse.sectionName;

      const studentsPayload = students.map((student) => {
        return {
          studentId: student.studentId,
          studentName: student.fullName,
          resultsRecords: student.resultsRecords.map((record) => ({
            name: record.name,
            obtainedMarks: record.obtainedMarks,
            totalMarks: record.totalMarks,
            weightage: record.weightage,
          })),
        };
      });

      const payload = {
        batchName,
        semester: semesterNumber,
        courseCode,
        courseName: selectedCourse.courseName,
        sectionName,
        students: studentsPayload,
        department: selectedCourse.department 
      };

      const response = await axios.put(`${API_URL}/results/update`, payload);

      if (response.data.success) {
        message.success(" Results updated successfully");
        fetchStudents(selectedCourse);
      } else {
        message.error(response.data.message || "Failed to update results");
      }
    } catch (err) {
      console.error("Error updating results:", err);
      if (err.response) {
        message.error(`Backend error: ${err.response.data.message || err.response.statusText}`);
      } else {
        message.error("Failed to update results - Network error");
      }
    }
  };

  const handleDeleteResults = async () => {
    if (!selectedCourse) return;
    try {
      const response = await axios.post(`${API_URL}/results/delete`, {
        courseCode: selectedCourse.courseCode,
        batchName: selectedCourse.batchName,
        sectionName: selectedCourse.sectionName,
      });

      if (response.data.success) {
        message.success(response.data.message);
        setStudents([]);
        setComponents([]);
        setSavedResults(null);
        setSelectedCourse(null);
      } else {
        message.warning(response.data.message || "No results to delete");
      }
    } catch (err) {
      console.error(err);
      message.error("Failed to delete results");
    }
  };

  const calculateTotalPercentage = (student) => {
    let totalWeightedPercentage = 0;
    let totalWeightage = 0;

    student.resultsRecords.forEach((record) => {
      if (record.totalMarks > 0 && record.weightage > 0) {
        const percentage = (record.obtainedMarks / record.totalMarks) * record.weightage;
        totalWeightedPercentage += percentage;
        totalWeightage += record.weightage;
      }
    });

    if (totalWeightage > 0 && totalWeightage !== 100) {
      totalWeightedPercentage = (totalWeightedPercentage / totalWeightage) * 100;
    }

    return Math.min(Math.max(totalWeightedPercentage, 0), 100);
  };

  const generateColumns = () => {
    const baseColumns = [
      {
        title: "Student ID",
        dataIndex: "studentId",
        key: "studentId",
        fixed: "left",
        width: 120,
      },
      {
        title: "Full Name",
        dataIndex: "fullName",
        key: "fullName",
        fixed: "left",
        width: 150,
      },
    ];

    const assessmentColumns = components.map((comp) => ({
      title: (
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              cursor: canEdit ? "pointer" : "default",
              fontWeight: "bold",
            }}
            onClick={() => openComponentModal(comp)}
          >
            {comp.name}
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>
            Marks: {comp.totalMarks} | Weight: {comp.weightage}%
          </div>
          {canEdit && (
            <Popconfirm
              title="Are you sure you want to remove this assessment?"
              onConfirm={() => handleRemoveComponent(comp.key)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="link" danger size="small">
                Remove
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
      key: comp.key,
      align: "center",
      width: 150,
      render: (_, record) => {
        const assessmentRecord = record.resultsRecords.find(
          (r) =>
            r.name === comp.name &&
            r.totalMarks === comp.totalMarks &&
            r.weightage === comp.weightage
        );

        if (!assessmentRecord)
          return <span style={{ color: "#ccc" }}>N/A</span>;

        return (
          <InputNumber
            value={assessmentRecord.obtainedMarks}
            min={0}
            max={comp.totalMarks}
            disabled={!canEdit}
            onChange={(v) =>
              handleMarksChange(record.studentId, comp.key, Number(v))
            }
            style={{ width: "80px" }}
          />
        );
      },
    }));

    const totalColumn = {
      title: (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: "bold" }}>Total</div>
          <div style={{ fontSize: "12px", color: "#666" }}>Percentage</div>
        </div>
      ),
      key: "total",
      align: "center",
      fixed: "right",
      width: 120,
      render: (_, record) => {
        const percentage = calculateTotalPercentage(record);

        return (
          <div>
            <div
              style={{
                fontWeight: "bold",
                color: percentage >= 50 ? "#52c41a" : "#ff4d4f",
              }}
            >
              {percentage.toFixed(1)}%
            </div>
            <div style={{ fontSize: "11px", color: "#666" }}>
              {percentage.toFixed(0)}/100
            </div>
          </div>
        );
      },
    };

    return [...baseColumns, ...assessmentColumns, totalColumn];
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Faculty Results Management</h2>

      {savedResults && (
        <div style={{ marginBottom: 16 }}>
          <Tag color="green">Results Saved</Tag>
          <span style={{ marginLeft: 8 }}>
            Department: {savedResults.department || "N/A"}
          </span>
          <span style={{ marginLeft: 16 }}>
            Last updated: {new Date().toLocaleDateString()}
          </span>
        </div>
      )}

      {loadingCourses ? (
        <Spin size="large" />
      ) : courses.length === 0 ? (
        <p>No active courses assigned.</p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "20px",
              marginBottom: 20,
            }}
          >
            {courses.map((course, idx) => (
              <div
                key={`${course.courseCode}-${course.sectionName}-${idx}`}
                style={{
                  borderLeft: "5px solid #8a7aa8",
                  padding: "15px",
                  borderRadius: "8px",
                  boxShadow: "0px 2px 8px rgba(0,0,0,0.1)",
                  cursor: "pointer",
                  backgroundColor:
                    selectedCourse?.courseCode === course.courseCode &&
                    selectedCourse?.sectionName === course.sectionName
                      ? "#f0eaf5"
                      : "#fff",
                  transition: "all 0.3s",
                }}
                onClick={() => fetchStudents(course)}
              >
                <h4 style={{ color: "#8a7aa8", margin: 0 }}>{course.courseCode}</h4>
                <h3 style={{ margin: "8px 0", color: "#333" }}>{course.courseName}</h3>
                <p style={{ margin: "4px 0", fontSize: "14px" }}>
                  <b>Batch:</b> {course.batchName} | <b>Section:</b>{" "}
                  {course.sectionName}
                </p>
                <p style={{ margin: "4px 0", fontSize: "14px" }}>
                  <b>Credits:</b> {course.creditHrs} | <b>Semester:</b>{" "}
                  {course.semester}
                </p>
                <p style={{ margin: "4px 0", fontSize: "14px" }}>
                  <b>Department:</b> {course.department}
                </p>
                <p style={{ margin: "4px 0", fontSize: "14px" }}>
                  <b>Total Students:</b> {course.totalStudents || 0}
                </p>
              </div>
            ))}
          </div>

          {selectedCourse && (
            <div style={{ marginTop: 30 }}>
              {loadingStudents ? (
                <Spin size="large" />
              ) : students.length === 0 ? (
                <p>No students found for this course.</p>
              ) : (
                <>
                  <div
                    style={{
                      marginBottom: 15,
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <Button
                      type="primary"
                      style={{
                        backgroundColor: "#8a7aa8",
                        borderColor: "#8a7aa8",
                      }}
                      onClick={() => openComponentModal()}
                      disabled={!canEdit}
                    >
                      Add Assessment
                    </Button>

                    <div style={{ flex: 1 }}>
                      {!canEdit && (
                        <Tag color="orange">
                          Editing disabled - Semester ended
                        </Tag>
                      )}
                    </div>

                    <Button
                      type="primary"
                      style={{
                        backgroundColor: "#8a7aa8",
                        borderColor: "#8a7aa8",
                      }}
                      onClick={handleSaveResults}
                      disabled={!canEdit}
                    >
                      Save Results
                    </Button>

                    <Popconfirm
                      title="Are you sure you want to delete all results for this course?"
                      onConfirm={handleDeleteResults}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button danger disabled={!canEdit || !savedResults}>
                        Delete All Results
                      </Button>
                    </Popconfirm>

                    <Button
                      style={{
                        backgroundColor: "#8a7aa8",
                        borderColor: "#8a7aa8",
                        color: "#fff",
                      }}
                      onClick={() => setSelectedCourse(null)}
                    >
                      Back to Courses
                    </Button>
                  </div>

                  <Table
                    dataSource={students}
                    columns={generateColumns()}
                    rowKey="studentId"
                    scroll={{ x: "max-content" }}
                    bordered
                    pagination={{ pageSize: 10 }}
                  />
                </>
              )}
            </div>
          )}
        </>
      )}

      <Modal
        title={currentComponent?.key ? "Edit Assessment" : "Add Assessment"}
        open={modalVisible}
        onOk={handleModalSave}
        onCancel={() => setModalVisible(false)}
        okText="Save"
        cancelText="Cancel"
      >
        <div style={{ marginBottom: 15 }}>
          <label style={{ fontWeight: 500, display: "block", marginBottom: 5 }}>
            Assessment Name:
          </label>
          <Input
            placeholder="e.g., Midterm, Assignment 1, Final Exam"
            value={currentComponent?.name}
            onChange={(e) =>
              setCurrentComponent({ ...currentComponent, name: e.target.value })
            }
          />
        </div>
        <div style={{ marginBottom: 15 }}>
          <label style={{ fontWeight: 500, display: "block", marginBottom: 5 }}>
            Total Marks:
          </label>
          <InputNumber
            min={1}
            max={100}
            value={currentComponent?.totalMarks}
            onChange={(v) =>
              setCurrentComponent({ ...currentComponent, totalMarks: v })
            }
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <label style={{ fontWeight: 500, display: "block", marginBottom: 5 }}>
            Weightage (%):
          </label>
          <InputNumber
            min={1}
            max={100}
            value={currentComponent?.weightage}
            onChange={(v) =>
              setCurrentComponent({ ...currentComponent, weightage: v })
            }
            style={{ width: "100%" }}
          />
        </div>
      </Modal>
    </div>
  );
}

export default FacultyResultsPage;