import { api } from './client';

function toFormData(payload) {
  const fd = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === 'rubrics') {
      fd.append('rubrics', JSON.stringify(value));
      return;
    }
    if (Array.isArray(value)) {
      fd.append(key, value.join('\n'));
      return;
    }
    fd.append(key, value);
  });
  return fd;
}

export const modulesApi = {
  list: (params) => api.get('/modules', params),
  get: (id) => api.get(`/modules/${id}`),
  submissions: (id, params) => api.get(`/modules/${id}/submissions`, params),
  create: (payload) => api.post('/modules', toFormData(payload), { isMultipart: true }),
  update: (id, payload) => api.put(`/modules/${id}`, toFormData(payload), { isMultipart: true }),
  remove: (id) => api.delete(`/modules/${id}`),
};
