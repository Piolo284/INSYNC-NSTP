import { api, downloadFile } from './client';

export const gradesApi = {
  list: (params) => api.get('/grades', params),
  getForStudent: (studentId) => api.get(`/grades/${studentId}`),
  recalculate: (payload) => api.post('/grades', payload || {}),
  update: (id, payload) => api.put(`/grades/${id}`, payload),
  exportReport: (params, filename) => downloadFile('/grades/report/export', params, filename),
};
