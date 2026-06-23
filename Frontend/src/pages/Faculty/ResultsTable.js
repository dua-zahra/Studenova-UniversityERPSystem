import React, { useEffect, useState } from "react";
import axios from "axios";
import { Table, InputNumber, Button, Spin, Modal, Input, message } from "antd";
import "antd/dist/reset.css";
import API_URL from '../../config';

const ResultsTable = ({ courseId, batchId, sectionName }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [components, setComponents] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentComponent, setCurrentComponent] = useState(null);

  const defaultComponents = [
    { key: "quizzes", name: "Quiz", totalFields: 4, totalMarks: 10, weightage: 10 },
    { key: "assignments", name: "Assignment", totalFields: 4, totalMarks: 10, weightage: 10 },
    { key: "mid", name: "Mid", totalFields: 1, totalMarks: 30, weightage: 30 },
    { key: "presentation", name: "Presentation", totalFields: 1, totalMarks: 10, weightage: 10 },
    { key: "final", name: "Final", totalFields: 1, totalMarks: 40, weightage: 40 },
  ];

  useEffect(() => {
    setComponents(defaultComponents);
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_URL}/results/${batchId}/course-students`,
        { params: { courseCode: courseId, sectionName } }
      );

      setStudents(res.data.students || []);
    } catch (err) {
      console.error(err);
      message.error("Failed to fetch students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [batchId, courseId, sectionName]);

  // Handle marks change safely
  const handleMarksChange = (studentId, compKey, index, value) => {
    if (isNaN(value) || value < 0) value = 0;

    setStudents((prev) =>
      prev.map((s) => {
        if (s.studentId !== studentId) return s;

        let comp = s.assessments[compKey];
        if (!comp) {
          comp = index !== null
            ? Array(1).fill({ obtainedMarks: 0, totalMarks: 10, weightage: 0 })
            : { obtainedMarks: 0, totalMarks: 10, weightage: 0 };
          s.assessments[compKey] = comp;
        }

        if (Array.isArray(comp)) {
          if (!comp[index]) comp[index] = { obtainedMarks: 0, totalMarks: 10, weightage: 0 };
          if (value > comp[index].totalMarks) value = comp[index].totalMarks;
          comp[index] = { ...comp[index], obtainedMarks: value };
        } else {
          if (value > comp.totalMarks) value = comp.totalMarks;
          s.assessments[compKey] = { ...comp, obtainedMarks: value };
        }

        return { ...s };
      })
    );
  };

  // Modal open/close
  const openModal = (comp = null) => {
    if (comp) setCurrentComponent({ ...comp });
    else setCurrentComponent({ key: `dynamic-${Date.now()}`, name: "", totalFields: 1, totalMarks: 10, weightage: 10 });
    setModalVisible(true);
  };

  const handleModalSave = () => {
    const sumWeightage = components.reduce((sum, c) => {
      if (c.key === currentComponent.key) return sum + currentComponent.weightage;
      return sum + c.weightage;
    }, 0);

    if (sumWeightage > 100) {
      message.error("Total weightage cannot exceed 100%");
      return;
    }

    setComponents((prev) => {
      const exists = prev.find((c) => c.key === currentComponent.key);
      if (exists) return prev.map((c) => (c.key === currentComponent.key ? { ...currentComponent } : c));
      else return [...prev, currentComponent];
    });

    setStudents((prev) =>
      prev.map((s) => {
        if (!s.assessments[currentComponent.key]) {
          s.assessments[currentComponent.key] =
            currentComponent.totalFields === 1
              ? { obtainedMarks: 0, totalMarks: currentComponent.totalMarks, weightage: currentComponent.weightage }
              : Array(currentComponent.totalFields)
                  .fill(0)
                  .map(() => ({ obtainedMarks: 0, totalMarks: currentComponent.totalMarks, weightage: currentComponent.weightage }));
        }
        return { ...s };
      })
    );

    setModalVisible(false);
  };

  const handleRemoveComponent = (compKey) => {
    setComponents((prev) => prev.filter((c) => c.key !== compKey));
    setStudents((prev) =>
      prev.map((s) => {
        delete s.assessments[compKey];
        return { ...s };
      })
    );
  };

  // Columns
  const columns = [
    { title: "Student ID", dataIndex: "studentId", key: "studentId", fixed: "left" },
    { title: "Full Name", dataIndex: "fullName", key: "fullName", fixed: "left" },
  ];

  components.forEach((comp) => {
    if (comp.totalFields === 1) {
      columns.push({
        title: (
          <div>
            <span onClick={() => openModal(comp)} style={{ cursor: "pointer" }}>
              {comp.name || "Untitled"} ({comp.weightage}%)
            </span>
            <Button type="link" onClick={() => handleRemoveComponent(comp.key)}>Remove</Button>
          </div>
        ),
        key: comp.key,
        render: (_, record) => {
          const data = record.assessments?.[comp.key] || { obtainedMarks: 0, totalMarks: comp.totalMarks };
          return (
            <InputNumber
              value={data.obtainedMarks ?? 0}
              min={0}
              max={data.totalMarks ?? comp.totalMarks}
              onChange={(v) => handleMarksChange(record.studentId, comp.key, null, Number(v))}
            />
          );
        },
      });
    } else {
      for (let i = 0; i < comp.totalFields; i++) {
        columns.push({
          title: (
            <div>
              <span onClick={() => openModal(comp)} style={{ cursor: "pointer" }}>
                {comp.name || "Untitled"} {i + 1} ({comp.weightage}%)
              </span>
              <Button type="link" onClick={() => handleRemoveComponent(comp.key)}>Remove</Button>
            </div>
          ),
          key: `${comp.key}-${i}`,
          render: (_, record) => {
            const data = record.assessments?.[comp.key]?.[i] || { obtainedMarks: 0, totalMarks: comp.totalMarks };
            return (
              <InputNumber
                value={data.obtainedMarks ?? 0}
                min={0}
                max={data.totalMarks ?? comp.totalMarks}
                onChange={(v) => handleMarksChange(record.studentId, comp.key, i, Number(v))}
              />
            );
          },
        });
      }
    }
  });

  // Total marks column (weighted)
  columns.push({
    title: "Total Marks (100)",
    key: "total",
    render: (_, record) => {
      let totalWeighted = 0;
      components.forEach((comp) => {
        const data = record.assessments?.[comp.key];
        if (!data) return;

        let sumObtained = 0;
        let sumTotal = 0;

        if (Array.isArray(data)) {
          data.forEach((item) => {
            sumObtained += item?.obtainedMarks ?? 0;
            sumTotal += item?.totalMarks ?? comp.totalMarks;
          });
        } else {
          sumObtained = data?.obtainedMarks ?? 0;
          sumTotal = data?.totalMarks ?? comp.totalMarks;
        }

        if (sumTotal > 0) totalWeighted += (sumObtained / sumTotal) * comp.weightage;
      });
      return `${Math.round(totalWeighted * 100) / 100}/100`;
    },
  });

  // Save results to backend
  const handleSave = async () => {
    const totalWeightage = components.reduce((sum, c) => sum + c.weightage, 0);
    if (totalWeightage !== 100) {
      message.error(`Total weightage is ${totalWeightage}%. Must be 100% to save.`);
      return;
    }

    try {
      await axios.post(`${API_URL}/results/save-results`, {
        results: students,
        components,
        batchId,
        courseId
      });
      message.success("Results saved successfully");
      fetchStudents(); // Refresh table with saved data
    } catch (err) {
      console.error(err);
      message.error("Failed to save results");
    }
  };

  return (
    <div className="p-4">
      {loading ? (
        <Spin size="large" />
      ) : (
        <>
          <Button type="primary" style={{ marginBottom: 10 }} onClick={() => openModal()}>
            Add Component
          </Button>
          <Table
            dataSource={students}
            columns={columns}
            rowKey="studentId"
            scroll={{ x: "max-content" }}
            bordered
          />
          <Button type="primary" className="mt-4" onClick={handleSave}>
            Save Results
          </Button>

          <Modal
            title="Edit/Add Component"
            visible={modalVisible}
            onOk={handleModalSave}
            onCancel={() => setModalVisible(false)}
          >
            <div>
              <label>Name: </label>
              <Input
                value={currentComponent?.name}
                onChange={(e) =>
                  setCurrentComponent({ ...currentComponent, name: e.target.value })
                }
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Total Marks: </label>
              <InputNumber
                min={1}
                value={currentComponent?.totalMarks}
                onChange={(v) =>
                  setCurrentComponent({ ...currentComponent, totalMarks: v })
                }
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Weightage %: </label>
              <InputNumber
                min={0}
                max={100}
                value={currentComponent?.weightage}
                onChange={(v) =>
                  setCurrentComponent({ ...currentComponent, weightage: v })
                }
              />
            </div>
          </Modal>
        </>
      )}
    </div>
  );
};

export default ResultsTable;
