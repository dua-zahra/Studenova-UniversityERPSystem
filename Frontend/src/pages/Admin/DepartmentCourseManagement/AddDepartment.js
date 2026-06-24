import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../axiosConfig';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Button } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import "../../../assets/style.css";
import API_URL from '../../../config';

const AddDepartment = ({ onClose }) => {
  const [degreeLevel, setDegreeLevel] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [departmentCode, setDepartmentCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [isLoadingDegreeLevels, setIsLoadingDegreeLevels] = useState(true);

  useEffect(() => {
    const fetchDegreeLevels = async () => {
      try {
        const response = await axiosInstance.get(`${API_URL}/api/degree-levels`);
        setDegreeLevels(response.data);
      } catch (error) {
        toast.error('Failed to load degree levels', { toastId: 'fetch-degree-error' });
      } finally {
        setIsLoadingDegreeLevels(false);
      }
    };

    fetchDegreeLevels();
  }, []);

  const handleDepartmentNameChange = (e) => {
    const input = e.target.value;
    if (/^[A-Za-z\s]*$/.test(input)) {
      setDepartmentName(input);
    } else {
      toast.error('Please input valid characters', { toastId: 'invalid-name' });
    }
  };

  const handleDepartmentCodeChange = (e) => {
    const input = e.target.value.toUpperCase();
    if (/^[A-Z]*$/.test(input)) {
      setDepartmentCode(input);
    } else {
      toast.error('Please input valid characters', { toastId: 'invalid-code' });
    }
  };

  const validateFields = () => {
    if (!degreeLevel || !departmentName.trim() || !departmentCode.trim()) {
      toast.error('All fields are required', { toastId: 'required-error' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateFields()) return;

    try {
      setLoading(true);
      const payload = {
        degreeLevel,
        departmentName: departmentName.trim(),
        departmentCode: departmentCode.trim()
      };

      const res = await axiosInstance.post(`${API_URL}/api/departments`, payload);

      if (res.data.success) {
        toast.success('Department created successfully', {
          toastId: 'success-toast',
          onClose: () => {
            setDegreeLevel('');
            setDepartmentName('');
            setDepartmentCode('');
            if (onClose) onClose();
          }
        });
      } else {
        toast.error(res.data.message || 'Failed to create department', {
          toastId: 'fail-toast'
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Server error', {
        toastId: 'server-error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setDegreeLevel('');
    setDepartmentName('');
    setDepartmentCode('');
    if (onClose) onClose();
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="add-department container mt-5">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="add-department-title mb-0">Add Department</h2>
        </div>

        <div className="form-row-grid">
          <div className="form-group">
            <label >Degree Level</label>
            <select
              value={degreeLevel}
              onChange={(e) => setDegreeLevel(e.target.value)}
             
              required
              disabled={isLoadingDegreeLevels}
            >
              <option value="">Select Degree Level</option>
              {degreeLevels.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Department Name</label>
            <input
              type="text"
              className="form-control"
              value={departmentName}
              onChange={handleDepartmentNameChange}
              placeholder="e.g. Computer Science"
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Department Code</label>
          <input
            type="text"
            className="form-control"
            value={departmentCode}
            onChange={handleDepartmentCodeChange}
            placeholder="e.g. CS"
            required
            disabled={loading}
          />
        </div>

        <div className="d-flex justify-content-end align-items-center gap-2 mt-4">
          <Button 
            type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
            className="btn btn-primary"
            disabled={loading || isLoadingDegreeLevels}
          >
            {loading ? 'Creating...' : 'Save Department'}
          </Button>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
        theme="colored"
      />
    </>
  );
};

export default AddDepartment;
