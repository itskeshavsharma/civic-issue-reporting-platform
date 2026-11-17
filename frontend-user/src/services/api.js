import axiosClient from '../api/axiosClient';
import { API_BASE_URL, getImageUrl } from '../config/api';

/**
 * Re-export unified axiosClient
 */
export const apiClient = axiosClient;

/**
 * Stage 1: Fast AI Issue Inspection
 * Sends image to backend -> forwards to FastAPI Florence-2 + FLAN-T5.
 *
 * @param {File|Blob} imageFile - Uploaded image binary
 * @returns {Promise<{success: boolean, data: {final_issue: {en: string, hi: string}, bounding_box: number[], dimensions: object}}>}
 */
export const previewComplaint = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await apiClient.post('/complaints/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

/**
 * Stage 2: Final Verification, Deduplication & MongoDB Persistence
 *
 * @param {Object} params
 * @param {File|Blob} params.image - Uploaded image binary
 * @param {string} params.final_text - Confirmed or citizen-edited description
 * @param {boolean} params.was_edited - Whether citizen edited AI description
 * @param {number} params.latitude - Geolocation latitude
 * @param {number} params.longitude - Geolocation longitude
 * @param {string} params.areaName - Neighborhood / area
 * @param {string} params.city - City / district
 * @param {string} [params.road] - Road or street name
 * @param {string} [params.suburb] - Suburb name
 * @param {string} [params.state] - State name
 * @param {string} [params.fcmToken] - Device FCM Push Registration Token
 * @returns {Promise<{success: boolean, is_duplicate: boolean, complaint: object, similarity_score?: number}>}
 */
export const submitComplaint = async ({
  image,
  final_text,
  was_edited = false,
  latitude,
  longitude,
  areaName,
  city,
  road = '',
  suburb = '',
  state = '',
  fcmToken = '',
}) => {
  const token = fcmToken || localStorage.getItem('fcmToken') || '';

  const formData = new FormData();
  formData.append('image', image);
  formData.append('final_text', final_text);
  formData.append('was_edited', String(Boolean(was_edited)));
  formData.append('latitude', String(latitude));
  formData.append('longitude', String(longitude));
  formData.append('areaName', areaName);
  formData.append('city', city);
  if (road) formData.append('road', road);
  if (suburb) formData.append('suburb', suburb);
  if (state) formData.append('state', state);
  if (token) formData.append('fcmToken', token);

  const response = await apiClient.post('/complaints/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

/**
 * Fetch complaints belonging to logged-in user with status filter & counters.
 *
 * @param {string} [status] - Optional filter ('Pending', 'Under Working', 'Resolved')
 * @returns {Promise<{success: boolean, pendingCount: number, workingCount: number, resolvedCount: number, totalCount: number, data: Array}>}
 */
export const getUserComplaints = async (status = '') => {
  const params = {};
  if (status && status !== 'all') {
    params.status = status;
  }
  try {
    const response = await apiClient.get('/complaints/my-complaints', { params });
    return response.data;
  } catch (err) {
    // Fallback to /complaints/my
    const response = await apiClient.get('/complaints/my', { params });
    return response.data;
  }
};

/**
 * Fetch area complaints filtered by coordinate radius or city/area name.
 *
 * @param {Object} [params]
 * @param {string} [params.city]
 * @param {string} [params.areaName]
 * @param {number} [params.latitude]
 * @param {number} [params.longitude]
 * @param {number} [params.radius=50000]
 * @param {string} [params.status]
 * @returns {Promise<{success: boolean, count: number, complaints: Array}>}
 */
export const getAreaComplaints = async (params = {}) => {
  try {
    const response = await apiClient.get('/complaints/nearby', { params });
    return response.data;
  } catch (err) {
    // Fallback to /complaints/area
    const response = await apiClient.get('/complaints/area', { params });
    return response.data;
  }
};

/**
 * Fetch Area-Wise Resolved Complaints Archive
 *
 * @param {Object} [params]
 * @param {string} [params.areaName]
 * @param {string} [params.search]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=100]
 * @returns {Promise<{success: boolean, total: number, count: number, complaints: Array, groupedByArea: Object}>}
 */
export const getResolvedComplaints = async (params = {}) => {
  const queryParams = { ...params };
  if (queryParams.area && !queryParams.areaName) {
    queryParams.areaName = queryParams.area;
    delete queryParams.area;
  }
  const response = await apiClient.get('/complaints/resolved', { params: queryParams });
  return response.data;
};

/**
 * Fetch user profile activity statistics.
 *
 * @returns {Promise<{success: boolean, total: number, pending: number, underWorking: number, resolved: number}>}
 */
export const getUserStats = async () => {
  const response = await apiClient.get('/complaints/stats');
  return response.data;
};

/**
 * Citizen Confirm & Close or Reopen Issue
 *
 * @param {string} id - Complaint MongoDB ID
 * @param {Object} payload - { action: 'confirm' } or { action: 'reopen', reason: string }
 * @returns {Promise<{success: boolean, message: string, complaint: object}>}
 */
export const citizenAction = async (id, payload) => {
  const response = await apiClient.patch(`/workflow/citizen-action/${id}`, payload);
  return response.data;
};

/**
 * Fetch Universal User Profile
 *
 * @returns {Promise<{success: boolean, user: object}>}
 */
export const getProfile = async () => {
  const response = await apiClient.get('/users/profile');
  return response.data;
};

/**
 * Update Universal User Profile
 *
 * @param {FormData|object} payload
 * @returns {Promise<{success: boolean, message: string, user: object}>}
 */
export const updateProfile = async (payload) => {
  const response = await apiClient.patch('/users/profile', payload);
  return response.data;
};

/**
 * Health check endpoint for backend orchestrator.
 */
export const checkBackendHealth = async () => {
  const response = await apiClient.get('/health', { baseURL: API_BASE_URL, timeout: 10000 });
  return response.data;
};

export { getImageUrl, API_BASE_URL };
export default apiClient;
