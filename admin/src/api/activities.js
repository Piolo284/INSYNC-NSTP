import { api } from './client';

function toFormData(payload) {
  const fd = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === 'photos' && Array.isArray(value)) {
      value.forEach((file) => fd.append('photos', file));
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

export const activitiesApi = {
  list: (params) => api.get('/activities', params),
  get: (id) => api.get(`/activities/${id}`),
  participants: (id) => api.get(`/activities/${id}/participants`),
  create: (payload) => api.post('/activities', toFormData(payload), { isMultipart: true }),
  update: (id, payload) => api.put(`/activities/${id}`, toFormData(payload), { isMultipart: true }),
  remove: (id) => api.delete(`/activities/${id}`),
};
