import axios from 'axios';
import API_URL from './config';
import { DEMO_MODE } from './config';
import { toast } from 'react-toastify';

const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

axiosInstance.interceptors.request.use(
  (config) => {
    if (DEMO_MODE) {
      const writeMethods = ['post', 'put', 'delete', 'patch'];
      const method = config.method?.toLowerCase();
      
      if (writeMethods.includes(method)) {
        toast.warning('🔍 Demo Mode - Data modification is disabled');
        return Promise.reject({
          response: {
            status: 403,
            data: { message: 'Demo mode - modifications are disabled' }
          }
        });
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default axiosInstance;