import axios from 'axios';
import { auth } from '../config/firebase';

const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000'
).replace(/\/+$/, '');

export const axiosClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// Request Interceptor: Attach live Firebase Bearer Token
axiosClient.interceptors.request.use(
  async (config) => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        if (idToken) {
          config.headers.Authorization = `Bearer ${idToken}`;
        }
      } else {
        const storedToken = sessionStorage.getItem('civic_officer_token');
        if (storedToken) {
          config.headers.Authorization = `Bearer ${storedToken}`;
        }
      }
    } catch (tokenErr) {
      console.warn('[AxiosClient] Failed to retrieve Firebase ID token:', tokenErr.message);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Normalizes errors
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected network error occurred.';
    console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}:`, message);
    return Promise.reject(error);
  }
);

export default axiosClient;
