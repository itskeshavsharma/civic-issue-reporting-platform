import axios from 'axios';
import { auth } from '../config/firebase';

const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000'
).replace(/\/+$/, '');

export const axiosClient = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 60000, // 60s for AI inference / multimodal
});

// Request Interceptor: Attach live Firebase Bearer Token
axiosClient.interceptors.request.use(
  async (config) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (err) {
      console.warn('[AxiosClient User] Could not retrieve Firebase ID token:', err.message);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Normalizes errors
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected network error occurred.';
    console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}:`, errorMsg);
    return Promise.reject(error);
  }
);

export default axiosClient;
