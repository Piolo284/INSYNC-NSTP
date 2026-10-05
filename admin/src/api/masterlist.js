import { api } from './client';

export const masterlistApi = {
  list: (params) => api.get('/master-enrollment', params),
  create: (payload) => api.post('/master-enrollment', payload),
  upload: (file, mode) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/master-enrollment/upload', fd, {
      isMultipart: true,
      params: mode === 'replace' ? { mode: 'replace' } : undefined,
    });
  },
  remove: (id) => api.delete(`/master-enrollment/${id}`),
  clear: () => api.delete('/master-enrollment'),
};
