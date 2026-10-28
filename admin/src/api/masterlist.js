import { api } from './client';

export const masterlistApi = {
  /** params: { search, page, limit } */
  list: (params) => api.get('/master-enrollment', params),
  create: (payload) => api.post('/master-enrollment', payload),
  update: (id, payload) => api.put(`/master-enrollment/${id}`, payload),
  /** Upload + validate a new Master List. Nothing changes until confirmImport. */
  previewImport: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/master-enrollment/import/preview', fd, { isMultipart: true });
  },
  confirmImport: (importId) => api.post(`/master-enrollment/import/${importId}/confirm`),
  cancelImport: (importId) => api.post(`/master-enrollment/import/${importId}/cancel`),
  imports: (params) => api.get('/master-enrollment/imports', params),
  getImport: (importId) => api.get(`/master-enrollment/imports/${importId}`),
  remove: (id) => api.delete(`/master-enrollment/${id}`),
  clear: () => api.delete('/master-enrollment'),
};
