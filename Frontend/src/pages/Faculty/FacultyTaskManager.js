import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Button, Select, Input } from "antd";
import { UploadOutlined } from "@ant-design/icons";

const { TextArea } = Input;
const { Option } = Select;

const FacultyTaskManager = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [assignmentFile, setAssignmentFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const facultyUser = JSON.parse(localStorage.getItem("user") || "{}");
        const facultyEmail = facultyUser?.universityEmail || facultyUser?.email;

        const response = await axios.get(
          "http://localhost:65000/api/faculty-courses/courses",
          { params: { universityEmail: facultyEmail } }
        );

        if (response.data.success) {
          const activeCourses = response.data.courses.filter(
            (c) => c.teachingStatus === "in-progress" && c.isActive
          );
          setCourses(activeCourses);
        } else {
          toast.error(response.data.message || "Failed to load courses");
        }
      } catch (err) {
        toast.error("Error fetching courses: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  const handleFileChange = (file) => {
    setAssignmentFile(file.file || file);
    return false; 
  };

  const handleRemoveFile = () => setAssignmentFile(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedCourse) {
      toast.error("Please select a course");
      return;
    }
    if (!taskTitle.trim()) {
      toast.error("Task title cannot be empty");
      return;
    }
    if (!taskDescription.trim()) {
      toast.error("Task description cannot be empty");
      return;
    }

    setIsSubmitting(true);

    try {
      const [codeNamePart, batchPart, sectionPart, semPart] =
        selectedCourse.split(" | ");
      const [courseCode, ...courseNameArr] = codeNamePart.split(" - ");
      const courseName = courseNameArr.join(" - ");
      const batchName = batchPart?.replace("Batch: ", "").trim();
      const sectionName = sectionPart?.replace("Section: ", "").trim();
      const semester = semPart?.replace("Sem ", "").trim();

      const facultyUser = JSON.parse(localStorage.getItem("user") || "{}");
      const facultyName =
        (facultyUser.firstName && facultyUser.lastName
          ? `${facultyUser.firstName} ${facultyUser.lastName}`
          : facultyUser.fullName || facultyUser.name || facultyUser.username) || "Faculty";

      const formData = new FormData();
      formData.append("facultyName", facultyName);
      formData.append("courseCode", courseCode);
      formData.append("courseName", courseName);
      formData.append("batchName", batchName);
      formData.append("sectionName", sectionName);
      formData.append("semester", semester);
      formData.append("taskTitle", taskTitle);
      formData.append("taskDescription", taskDescription);
      if (assignmentFile) formData.append("assignmentFile", assignmentFile);

      const res = await axios.post(
        "http://localhost:65000/api/faculty-tasks",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      if (res.data.success) {
        toast.success("Task assigned successfully!");
        setTaskTitle("");
        setTaskDescription("");
        setAssignmentFile(null);
        setSelectedCourse("");
      } else {
        toast.error(res.data.message || "Failed to assign task");
      }
    } catch (err) {
      toast.error("Error submitting task: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTaskTitle("");
    setTaskDescription("");
    setAssignmentFile(null);
    setSelectedCourse("");
  };

  if (loading)
    return (
      <div className="add-batch container mt-5">
        <div className="d-flex justify-content-center align-items-center" style={{ height: '300px' }}>
          <h3>Loading courses...</h3>
        </div>
      </div>
    );

  return (
    <div className="add-batch container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="add-batch-title mb-0">
          Assign Task / Assignment
        </h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-row-grid">
          <div className="form-group">
            <label>Select Course</label>
            <Select
              placeholder="Select a course"
              value={selectedCourse}
              onChange={setSelectedCourse}
              allowClear
              className="form-control-select"
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {courses.map((course) => (
                <Option
                  key={course._id}
                  value={`${course.courseCode} - ${course.courseName} | Batch: ${course.batchName} | Section: ${course.sectionName} | Sem ${course.semester}`}
                >
                  {course.courseCode} - {course.courseName} | Batch:{" "}
                  {course.batchName} | Section: {course.sectionName} | Sem{" "}
                  {course.semester}
                </Option>
              ))}
            </Select>
          </div>
        </div>
        
        <div className="form-row-grid">
          <div className="form-group">
            <label>Task Title</label>
            <Input
              placeholder="Enter task title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="form-control"
              required
            />
          </div>
        </div>
        
        <div className="form-row-grid">
          <div className="form-group">
            <label>Task Description</label>
            <TextArea
              placeholder="Enter task description"
              rows={4}
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="form-control"
              required
            />
          </div>
        </div>
        
        <div className="form-row-grid">
          <div className="form-group">
            <label>Upload Assignment File (optional)</label>
            <div className="upload-section">
              <div className="upload-area">
                <input
                  type="file"
                  id="file-upload"
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      setAssignmentFile(e.target.files[0]);
                    }
                  }}
                  className="file-input"
                />
                <label htmlFor="file-upload" className="upload-label">
                  <UploadOutlined style={{ marginRight: '8px' }} />
                  Select File
                </label>
                {assignmentFile && (
                  <div className="file-info">
                    <span>{assignmentFile.name}</span>
                    <button 
                      type="button" 
                      className="remove-file-btn"
                      onClick={handleRemoveFile}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="d-flex justify-content-end align-items-center gap-2 mt-4">
          <Button 
            type="primary"
            htmlType="submit"
            disabled={isSubmitting}
            loading={isSubmitting}
            className="save-button"
          >
            Assign Task
          </Button>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </form>

      <ToastContainer position="top-right" />
      
      <style jsx>{`
        .form-control-select .ant-select-selector {
          height: 38px !important;
          border-radius: 4px !important;
          border: 1px solid #d9d9d9 !important;
        }
        
        .upload-section {
          margin-top: 8px;
        }
        
        .upload-area {
          border: 2px dashed #d9d9d9;
          border-radius: 4px;
          padding: 20px;
          text-align: center;
          background: #fafafa;
        }
        
        .file-input {
          display: none;
        }
        
        .upload-label {
          display: inline-flex;
          align-items: center;
          padding: 8px 16px;
          background: #1890ff;
          color: white;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.3s;
        }
        
        .upload-label:hover {
          background: #40a9ff;
        }
        
        .file-info {
          margin-top: 10px;
          padding: 8px;
          background: #f0f0f0;
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .remove-file-btn {
          background: #ff4d4f;
          color: white;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .remove-file-btn:hover {
          background: #ff7875;
        }
      `}</style>
    </div>
  );
};

export default FacultyTaskManager;