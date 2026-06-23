import React, { useState, useEffect } from "react";
import axiosInstance  from '../../../axiosConfig';
import { FaTimes } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Button } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import "../../../assets/style.css";
import API_URL from '../../../config';

const initialFormState = {
  firstName: "",
  lastName: "",
  email: "",
  designation: "",
  degreeLevel: "", 
  department: "",
  gender: "",
  mobile: "",
  specialization: "",
  experienceYears: "",
  previousInstitutions: "",
  joiningDate: "",
  birthDate: "",
  address: "",
  education: "",
  facultyType: "",
  salary: "",
  resume: null,
  degree: null,
  photo: null,
};

const AddProfessor = ({ onClose }) => {
  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [facultyDepartments, setFacultyDepartments] = useState([]);

  useEffect(() => {
    const fetchDegreeLevels = async () => {
      try {
        const response = await axiosInstance.get(`${API_URL}/api/degree-levels`);
        setDegreeLevels(response.data);
      } catch (error) {
        toast.error("Failed to fetch degree levels");
        console.error("Degree levels fetch error:", error);
      }
    };
    fetchDegreeLevels();
  }, []);

  useEffect(() => {
    const fetchFacultyDepartments = async () => {
      if (formData.degreeLevel) {
        try {
          const response = await axiosInstance.get(`${API_URL}/api/departments/by-degree`, {
            params: { degreeLevel: formData.degreeLevel }
          });
          setFacultyDepartments(response.data.departments || []);
        } catch (error) {
          toast.error("Failed to fetch departments");
          console.error("Department fetch error:", error);
        }
      } else {
        setFacultyDepartments([]);
      }
    };
    fetchFacultyDepartments();
  }, [formData.degreeLevel]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    let newValue = value;

    if (["firstName", "lastName"].includes(name)) {
      newValue = value.replace(/[^a-zA-Z\s]/g, "");
    } else if (name === "mobile") {
      newValue = value.replace(/\D/g, "");
    } else if (["specialization", "education", "facultyType", "designation"].includes(name)) {
      newValue = value.replace(/[^a-zA-Z\s]/g, "");
    } else if (["experienceYears", "salary"].includes(name)) {
      newValue = value.replace(/[^0-9]/g, "");
    } else if (["previousInstitutions", "address"].includes(name)) {
      newValue = value.replace(/[^a-zA-Z0-9\s,.-]/g, "");
    }

    setFormData({
      ...formData,
      [name]: files ? files[0] : newValue,
    });
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhone = (phone) => phone.length === 11 && /^\d+$/.test(phone);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.mobile) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (!validateEmail(formData.email)) {
      toast.error("Invalid email address.");
      return;
    }

    if (!validatePhone(formData.mobile)) {
      toast.error("Invalid 11-digit mobile number.");
      return;
    }

    if (!formData.degreeLevel || !formData.department) {
      toast.error("Please select degree level and department in Faculty Information");
      return;
    }

    const formPayload = new FormData();
    for (const key in formData) {
      if (formData[key] instanceof File) {
        formPayload.append(key, formData[key]);
      } else if (formData[key]) {
        formPayload.append(key, formData[key]);
      }
    }

    try {
      setLoading(true);
      await axiosInstance.post(`${API_URL}/api/faculty`, formPayload);
      toast.success("Professor added successfully!");
      setFormData(initialFormState);
    } catch (error) {
      toast.error(error.response?.data?.message || "Error adding professor.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData(initialFormState);
    if (onClose) onClose();
  };

  return (
    <div className="add-professor container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="add-professor-title mb-0">Add Professor</h2>
        {onClose && (
          <button className="close-btn" onClick={handleCancel}>
            <FaTimes className="me-2" /> Close
          </button>
        )}
      </div>   
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        <h4 className="mb-3">Personal Information</h4>
        <div className="row">
          <div className="col-md-6 mb-3">
            <label>First Name</label>
            <input 
              type="text" 
              className="form-control" 
              name="firstName" 
              value={formData.firstName} 
              onChange={handleChange} 
              required 
            />
          </div>
          <div className="col-md-6 mb-3">
            <label>Last Name</label>
            <input 
              type="text" 
              className="form-control" 
              name="lastName" 
              value={formData.lastName} 
              onChange={handleChange} 
              required 
            />
          </div>
          <div className="col-md-6 mb-3">
            <label>Email</label>
            <input 
              type="email" 
              className="form-control" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              required 
            />
          </div>
          <div className="col-md-6 mb-3">
            <label>Phone Number</label>
            <input 
              type="text" 
              className="form-control" 
              name="mobile" 
              value={formData.mobile} 
              onChange={handleChange} 
              maxLength="11"
              required 
            />
          </div>
          <div className="col-md-6 mb-3">
            <label>Gender</label>
            <select 
              name="gender" 
              className="form-control" 
              value={formData.gender} 
              onChange={handleChange} 
              required
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="col-md-6 mb-3">
            <label>Birth Date</label>
            <input 
              type="date" 
              className="form-control" 
              name="birthDate" 
              value={formData.birthDate} 
              onChange={handleChange} 
            />
          </div>
          <div className="col-md-6 mb-3">
            <label>Upload Photo</label>
            <input 
              type="file" 
              className="form-control" 
              name="photo" 
              accept="image/*" 
              onChange={handleChange} 
            />
          </div>
          <div className="col-md-6 mb-3">
            <label>Address</label>
            <input 
              type="text" 
              className="form-control" 
              name="address" 
              value={formData.address} 
              onChange={handleChange} 
            />
          </div>
        </div>

        <h4 className="mb-3">Academic Information</h4>
        <div className="row">
          <div className="col-md-6 mb-3">
            <label>Education</label>
            <input 
              type="text" 
              className="form-control" 
              name="education" 
              value={formData.education} 
              onChange={handleChange} 
            />
          </div>
          <div className="col-md-6 mb-3">
            <label>Previous Institutions</label>
            <input 
              type="text" 
              className="form-control" 
              name="previousInstitutions" 
              value={formData.previousInstitutions} 
              onChange={handleChange} 
            />
          </div>
          <div className="col-md-6 mb-3">
            <label>Specialization</label>
            <input 
              type="text" 
              className="form-control" 
              name="specialization" 
              value={formData.specialization} 
              onChange={handleChange} 
            />
          </div>
          <div className="col-md-6 mb-3">
            <label>Years of Experience</label>
            <input 
              type="text" 
              className="form-control" 
              name="experienceYears" 
              value={formData.experienceYears} 
              onChange={handleChange} 
            />
          </div>
          <div className="col-md-6 mb-3">
            <label>Degree Certificate</label>
            <input 
              type="file" 
              className="form-control" 
              name="degree" 
              onChange={handleChange} 
              accept=".pdf,.doc,.docx" 
            />
          </div>
        </div>

        <h4 className="mb-3">Faculty Information</h4>
        <div className="row">
          <div className="col-md-6 mb-3">
            <label>Designation</label>
            <select
              name="designation"
              className="form-control"
              value={formData.designation}
              onChange={handleChange}
              required
            >
              <option value="">Select Designation</option>
              <option value="Professor">Professor</option>
              <option value="Associate Professor">Associate Professor</option>
              <option value="Assistant Professor">Assistant Professor</option>
              <option value="Lecturer">Lecturer</option>
              <option value="HOD" style={{ fontWeight: 'bold' }}>
                Head of Department (HOD)
              </option>
              <option value="Dean">Dean</option>
            </select>
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
              {degreeLevels.map((level) => (
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
                facultyDepartments.map((dept) => (
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
              className="form-control" 
              name="joiningDate" 
              value={formData.joiningDate} 
              onChange={handleChange} 
            />
          </div>
          <div className="col-md-6 mb-3">
            <label>Faculty Type</label>
            <input 
              type="text" 
              className="form-control" 
              name="facultyType" 
              value={formData.facultyType} 
              onChange={handleChange} 
              required 
            />
          </div>
          <div className="col-md-6 mb-3">
            <label>Salary</label>
            <input 
              type="number" 
              className="form-control" 
              name="salary" 
              value={formData.salary} 
              onChange={handleChange} 
              required 
            />
          </div>
          <div className="col-md-6 mb-3">
            <label>Resume</label>
            <input 
              type="file" 
              className="form-control" 
              name="resume" 
              onChange={handleChange} 
              accept=".pdf,.doc,.docx" 
            />
          </div>
        </div>

        <div className="d-flex justify-content-end align-items-center gap-2 mt-4">
          <Button 
             htmlType="submit"
              type="primary"
              icon={<SaveOutlined />}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Save Professor'}
          </Button>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </form>

      <ToastContainer />
    </div>
  );
};

export default AddProfessor;