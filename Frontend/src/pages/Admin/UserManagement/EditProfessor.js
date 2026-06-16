import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Button } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { FaTimes } from 'react-icons/fa';
import "../../../assets/style.css";

const EditProfessor = ({ toggleEditMode, id, refreshFacultyList }) => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    universityEmail: "",
    username: "",
    employeeId: "",
    role: "faculty",
    designation: "",
    degreeLevel: "", 
    department: "",
    gender: "",
    mobile: "",
    joiningDate: "",
    birthDate: "",
    address: "",
    education: "",
    photo: null,
    photoUrl: "",
    resume: null,
    resumeUrl: "",
    degree: null,
    degreeUrl: "",
    specialization: "",
    experienceYears: "",
    previousInstitutions: "",
    facultyType: "",
    password: "",
    salary: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [facultyDepartments, setFacultyDepartments] = useState([]);

  useEffect(() => {
    const fetchDegreeLevels = async () => {
      try {
        const response = await axios.get('http://localhost:65000/api/degree-levels');
        setDegreeLevels(response.data);
      } catch (error) {
        toast.error("Failed to fetch degree levels");
        console.error("Degree levels fetch error:", error);
      }
    };
    fetchDegreeLevels();

    if (id) fetchProfessor();
  }, [id]);

  const fetchProfessor = async () => {
    try {
      const res = await axios.get(`http://localhost:65000/api/faculty/${id}`);
      const data = res.data;
      const fmtDate = d => d ? new Date(d).toISOString().split('T')[0] : "";

      setFormData({
        ...data,
        password: "",
        joiningDate: fmtDate(data.joiningDate),
        birthDate: fmtDate(data.birthDate),
        photoUrl: data.photo,
        resumeUrl: data.resume,
        degreeUrl: data.degree,
      });

      if (data.degreeLevel) {
        const depts = await fetchDepartments(data.degreeLevel);
        setFacultyDepartments(depts);
      }
    } catch (err) {
      toast.error("Failed to load professor data");
      console.error(err);
    }
  };

  const fetchDepartments = async (degreeLevel) => {
    try {
      const res = await axios.get('http://localhost:65000/api/departments/by-degree', {
        params: { degreeLevel }
      });
      return res.data.departments || [];
    } catch (error) {
      toast.error("Failed to fetch departments");
      console.error("Department fetch error:", error);
      return [];
    }
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    let newValue = value;

    if (["firstName", "lastName", "designation", "specialization", "education", "facultyType"].includes(name)) {
      newValue = value.replace(/[^a-zA-Z\s]/g, "");
    }

    if (["mobile", "experienceYears", "salary"].includes(name)) {
      newValue = value.replace(/\D/g, "");
    }

    if (["address", "previousInstitutions"].includes(name)) {
      newValue = value.replace(/[^a-zA-Z0-9\s,.-]/g, "");
    }

    if (name === "mobile" && newValue.length > 11) return;

    const newFormData = {
      ...formData,
      [name]: files ? files[0] : newValue,
    };

    if (name === "degreeLevel") {
      newFormData.department = "";
      setFacultyDepartments([]);
      if (value) {
        fetchDepartments(value).then(depts => setFacultyDepartments(depts));
      }
    }

    setFormData(newFormData);
  };

  const validateForm = () => {
    if (formData.mobile && formData.mobile.length !== 11) {
      toast.error("Mobile number must be 11 digits");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Invalid email");
      return false;
    }
    const required = [
      'firstName','lastName','email','gender',
      'mobile','designation','degreeLevel','department','facultyType'
    ];
    for (const f of required) {
      if (!formData[f]) {
        toast.error(`Please fill ${f}`);
        return false;
      }
    }
    return true;
  };

 const handleSubmit = async (e) => {
  e.preventDefault();
  if (!validateForm()) return;
  setIsLoading(true);

  const payload = new FormData();
  
  for (const key in formData) {
    if (key === "assignedCourses") continue;
    if (key === "password" && formData[key] === "") continue;
    
    if (formData[key] instanceof File) {
      payload.append(key, formData[key]);
    } else if (formData[key] != null) {
      payload.append(key, formData[key]);
    }
  }

  try {
    await axios.put(
      `http://localhost:65000/api/faculty/${id}`,
      payload,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    toast.success("Professor updated successfully!");
    refreshFacultyList?.();
    toggleEditMode(false);
  } catch (err) {
    toast.error(err.response?.data?.message || "Failed to update");
    console.error(err);
  } finally {
    setIsLoading(false);
  }
};

  return (
    <div className="add-professor container mt-5">
      <div className="d-flex justify-content-between align-items-center">
        <h2 className="add-professor-title">Edit Professor</h2>
        <button
          className="btn btn-secondary"
          onClick={() => toggleEditMode(false)}
        >
          Back
        </button>
      </div>
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        
        {/* University Details Section */}
        <div className="mb-4">
          <h3 className="mb-3">University Details</h3>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label>Employee ID</label>
              <input
                type="text"
                name="employeeId"
                value={formData.employeeId}
                className="form-control"
                readOnly
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>University Email</label>
              <input
                type="email"
                name="universityEmail"
                value={formData.universityEmail}
                className="form-control"
                readOnly
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                className="form-control"
                readOnly
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Password (Leave blank to keep current password)</label>
              <input 
                type="password" 
                name="password" 
                value={formData.password} 
                className="form-control" 
                onChange={handleChange} 
                placeholder="Enter new password to change"
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Role</label>
              <input
                type="text"
                name="role"
                value={formData.role}
                className="form-control"
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Personal Details Section */}
        <div className="mb-4">
          <h3 className="mb-3">Personal Details</h3>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label>First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                className="form-control"
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                className="form-control"
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                className="form-control"
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Gender</label>
              <select
                name="gender"
                value={formData.gender}
                className="form-control"
                onChange={handleChange}
                required
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div className="col-md-6 mb-3">
              <label>Phone Number</label>
              <input
                type="text"
                name="mobile"
                value={formData.mobile}
                className="form-control"
                onChange={handleChange}
                maxLength="11"
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Birth Date</label>
              <input
                type="date"
                name="birthDate"
                value={formData.birthDate}
                className="form-control"
                onChange={handleChange}
              />
            </div>
            <div className="col-md-12 mb-3">
              <label>Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                className="form-control"
                onChange={handleChange}
              />
            </div>
            <div className="col-md-12 mb-3">
              <label>Photo</label>
              {formData.photoUrl && (
                <div className="mb-3">
                  <div>
                    <img
                      src={`http://localhost:65000/uploads/${formData.photoUrl}`}
                      alt="Current"
                      style={{
                        width: "150px",
                        height: "150px",
                        objectFit: "cover",
                        borderRadius: "10px",
                        border: "1px solid #ddd",
                        marginTop: "10px",
                      }}
                    />
                  </div>
                </div>
              )}
              <input
                type="file"
                name="photo"
                className="form-control"
                onChange={handleChange}
                accept="image/*"
              />
            </div>
          </div>
        </div>

        {/* Faculty Info Section */}
        <div className="mb-4">
          <h3 className="mb-3">Faculty Info</h3>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label>Designation</label>
              <input
                type="text"
                name="designation"
                value={formData.designation}
                className="form-control"
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Degree Level</label>
              <select
                name="degreeLevel"
                className="form-control"
                value={formData.degreeLevel}
                onChange={handleChange}
                required
              >
                <option value="">Select Degree Level</option>
                {degreeLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div className="col-md-6 mb-3">
              <label>Department</label>
              <select
                name="department"
                className="form-control"
                value={formData.department}
                onChange={handleChange}
                disabled={!formData.degreeLevel}
                required
              >
                <option value="">Select Department</option>
                {facultyDepartments.length > 0 ? (
                  facultyDepartments.map(dept => (
                    <option key={dept._id} value={dept.departmentName}>
                      {dept.departmentName}
                    </option>
                  ))
                ) : formData.degreeLevel ? (
                  <option value="" disabled>Loading departments...</option>
                ) : null}
              </select>
            </div>
            <div className="col-md-6 mb-3">
              <label>Joining Date</label>
              <input
                type="date"
                name="joiningDate"
                value={formData.joiningDate}
                className="form-control"
                onChange={handleChange}
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Faculty Type</label>
              <input
                type="text"
                name="facultyType"
                value={formData.facultyType}
                className="form-control"
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Salary</label>
              <input
                type="number"
                name="salary"
                value={formData.salary}
                className="form-control"
                onChange={handleChange}
              />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label d-block mb-1">Resume</label>
              <div className="d-flex align-items-center gap-3">
                {formData.resumeUrl ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      window.open(
                        `http://localhost:65000/uploads/${formData.resumeUrl}`,
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }
                  >
                    View Current Resume
                  </button>
                ) : (
                  <span className="text-muted small">No resume uploaded</span>
                )}
                <input
                  type="file"
                  name="resume"
                  className="form-control form-control-sm"
                  style={{ maxWidth: '300px' }}
                  onChange={handleChange}
                  accept=".pdf,.doc,.docx"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Academic Details Section */}
        <div className="mb-4">
          <h3 className="mb-3">Academic Details</h3>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label>Education</label>
              <input
                type="text"
                name="education"
                value={formData.education}
                className="form-control"
                onChange={handleChange}
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Specialization</label>
              <input
                type="text"
                name="specialization"
                value={formData.specialization}
                className="form-control"
                onChange={handleChange}
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Experience Years</label>
              <input
                type="text"
                name="experienceYears"
                value={formData.experienceYears}
                className="form-control"
                onChange={handleChange}
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Previous Institutions</label>
              <input
                type="text"
                name="previousInstitutions"
                value={formData.previousInstitutions}
                className="form-control"
                onChange={handleChange}
              />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label d-block mb-1">Degree Certificate</label>
              <div className="d-flex align-items-center gap-3">
                {formData.degreeUrl ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      window.open(
                        `http://localhost:65000/uploads/${formData.degreeUrl}`,
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }
                  >
                    View Current Certificate
                  </button>
                ) : (
                  <span className="text-muted small">No certificate uploaded</span>
                )}
                <input
                  type="file"
                  name="degree"
                  className="form-control form-control-sm"
                  style={{ maxWidth: '300px' }}
                  onChange={handleChange}
                  accept=".pdf,.doc,.docx"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex gap-3 mb-4">
          <Button
            htmlType="submit"
            type="primary"
            icon={<SaveOutlined />}
            className="btn btn-primary"
            disabled={isLoading}
          >
            {isLoading ? 'Updating...' : 'Update Professor'}
          </Button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => toggleEditMode(false)}
          >
            Cancel
          </button>
        </div>
      </form>
      <ToastContainer />
    </div>
  );
};

export default EditProfessor;