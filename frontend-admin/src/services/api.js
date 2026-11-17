import axiosClient from '../api/axiosClient';

/**
 * Live 5-Tier Municipal Architecture API Client
 * Purged of all mock data, directly calling live Node.js + MongoDB backend.
 */
export const civicApi = {
  // ===========================================================================
  // 1. Authoritative Identity & Universal Profile
  // ===========================================================================
  async getMe(customToken = null) {
    const headers = {};
    if (customToken) {
      headers.Authorization = `Bearer ${customToken}`;
    }
    const res = await axiosClient.get('/api/auth/me', { headers });
    return res.data;
  },

  async getProfile() {
    const res = await axiosClient.get('/api/users/profile');
    return res.data;
  },

  async updateProfile(payload) {
    let res;
    if (payload instanceof FormData) {
      res = await axiosClient.patch('/api/users/profile', payload);
    } else {
      res = await axiosClient.patch('/api/users/profile', payload);
    }
    return res.data;
  },

  // ===========================================================================
  // 2. Master Wards CRUD
  // ===========================================================================
  async getWards(params = {}) {
    const res = await axiosClient.get('/api/master/wards', { params });
    return res.data;
  },

  async createWard({ name, code, description }) {
    const res = await axiosClient.post('/api/master/wards', { name, code, description });
    return res.data;
  },

  async updateWard(id, data) {
    const res = await axiosClient.patch(`/api/master/wards/${id}`, data);
    return res.data;
  },

  async deleteWard(id) {
    const res = await axiosClient.delete(`/api/master/wards/${id}`);
    return res.data;
  },

  // ===========================================================================
  // 3. Master Departments CRUD
  // ===========================================================================
  async getDepartments(params = {}) {
    const res = await axiosClient.get('/api/master/departments', { params });
    return res.data;
  },

  async createDepartment({ name, code, slaHours, description }) {
    const res = await axiosClient.post('/api/master/departments', { name, code, slaHours, description });
    return res.data;
  },

  async updateDepartment(id, data) {
    const res = await axiosClient.patch(`/api/master/departments/${id}`, data);
    return res.data;
  },

  async deleteDepartment(id) {
    const res = await axiosClient.delete(`/api/master/departments/${id}`);
    return res.data;
  },

  // ===========================================================================
  // 4. Staff & Hierarchy Personnel Management
  // ===========================================================================
  async getStaff(params = {}) {
    const res = await axiosClient.get('/api/staff', { params });
    return res.data;
  },

  async createStaff(payload) {
    const res = await axiosClient.post('/api/staff', payload);
    return res.data;
  },

  async updateStaff(id, payload) {
    const res = await axiosClient.patch(`/api/staff/${id}`, payload);
    return res.data;
  },

  async revokeStaff(id) {
    const res = await axiosClient.patch(`/api/staff/${id}/revoke`);
    return res.data;
  },

  async getStaffHistory(id) {
    const res = await axiosClient.get(`/api/staff/${id}/history`);
    return res.data;
  },

  // ===========================================================================
  // 5. Hierarchy Workflow Operations
  // ===========================================================================
  async getWorkflowQueue(params = {}) {
    const res = await axiosClient.get('/api/workflow/queue', { params });
    return res.data;
  },

  async forwardToWard(id, wardId) {
    const res = await axiosClient.patch(`/api/workflow/forward-to-ward/${id}`, { wardId });
    return res.data;
  },

  async assignToField(id, { fieldOfficerId, departmentId }) {
    const res = await axiosClient.patch(`/api/workflow/assign-to-field/${id}`, { fieldOfficerId, departmentId });
    return res.data;
  },

  async reassignOfficer(id, { newFieldOfficerId, reason }) {
    const res = await axiosClient.patch(`/api/workflow/reassign/${id}`, { newFieldOfficerId, reason });
    return res.data;
  },

  async startWork(id, { proofImage, officialRemark } = {}) {
    let res;
    if (proofImage instanceof File || proofImage instanceof Blob) {
      const formData = new FormData();
      if (officialRemark) formData.append('officialRemark', officialRemark.trim());
      formData.append('proofImage', proofImage);
      res = await axiosClient.patch(`/api/workflow/start-work/${id}`, formData);
    } else {
      res = await axiosClient.patch(`/api/workflow/start-work/${id}`, { officialRemark });
    }
    return res.data;
  },

  async resolveWork(id, { proofImage, officialRemark }) {
    const formData = new FormData();
    if (officialRemark) formData.append('officialRemark', officialRemark.trim());
    formData.append('proofImage', proofImage);
    const res = await axiosClient.patch(`/api/workflow/resolve/${id}`, formData);
    return res.data;
  },

  async returnUpward(id, { reason }) {
    const res = await axiosClient.post(`/api/workflow/return-upward/${id}`, { reason });
    return res.data;
  },

  async updateSeverity(id, { severity, remark = '' }) {
    const res = await axiosClient.patch(`/api/workflow/severity/${id}`, { severity, remark });
    return res.data;
  },

  async getSystemAnalytics() {
    const res = await axiosClient.get('/api/workflow/analytics');
    return res.data;
  },

  async getComplaintAuditTrail(id) {
    const res = await axiosClient.get(`/api/workflow/audit-trail/${id}`);
    return res.data;
  },

  // ===========================================================================
  // 6. Complaints & Resolved Archive (Backwards-Compatible)
  // ===========================================================================
  async getComplaints(params = {}) {
    const queryParams = { ...params };
    const res = await axiosClient.get('/api/admin/complaints', { params: queryParams });
    return {
      success: true,
      data: res.data.data || res.data.complaints || [],
      total: res.data.total ?? (res.data.data?.length || 0),
      count: res.data.count ?? (res.data.data?.length || 0),
      page: res.data.page || 1,
      totalPages: res.data.totalPages || 1,
    };
  },

  async getResolvedComplaints(params = {}) {
    const queryParams = { ...params };
    const res = await axiosClient.get('/api/complaints/resolved', { params: queryParams });
    return {
      success: true,
      complaints: res.data.complaints || res.data.data || [],
      groupedByArea: res.data.groupedByArea || {},
      total: res.data.total ?? (res.data.complaints?.length || 0),
      count: res.data.count ?? (res.data.complaints?.length || 0),
      page: res.data.page || 1,
      totalPages: res.data.totalPages || 1,
    };
  },

  async getStats(params = {}) {
    const res = await axiosClient.get('/api/admin/stats', { params });
    return res.data;
  },

  async getDistinctAreas() {
    const res = await axiosClient.get('/api/admin/areas');
    return {
      success: true,
      areas: res.data.areas || [],
      count: res.data.count || 0,
    };
  },
};

export default civicApi;
