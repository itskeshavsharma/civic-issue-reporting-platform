/**
 * Centralized API & Server Configuration
 * ========================================
 * SINGLE POINT OF CONFIGURATION FOR FRONTEND DEPLOYMENT:
 * During deployment, only change `VITE_API_URL` in `frontend-user/.env`.
 * No other code changes are needed!
 */

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000'
).replace(/\/+$/, '');

export const API_ENDPOINTS = {
  HEALTH: `${API_BASE_URL}/health`,
  COMPLAINTS: {
    PREVIEW: `${API_BASE_URL}/api/complaints/preview`,
    SUBMIT: `${API_BASE_URL}/api/complaints/submit`,
    MY: `${API_BASE_URL}/api/complaints/my`,
    AREA: `${API_BASE_URL}/api/complaints/area`,
    STATS: `${API_BASE_URL}/api/complaints/stats`,
  },
};

/**
 * Resolves an image URL. If the image is stored locally on the backend
 * (e.g. /uploads/...), prepends the API_BASE_URL. If it's already an absolute
 * URL (Unsplash, Cloudinary, S3, blob:, data:), returns it unchanged.
 *
 * @param {string} url - Image path or URL
 * @returns {string} - Fully qualified image URL
 */
export const getImageUrl = (url) => {
  if (!url) return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${API_BASE_URL}${cleanPath}`;
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  getImageUrl,
};
