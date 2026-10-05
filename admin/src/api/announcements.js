import { api } from './client';

function toFormData(payload) {
  const fd = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    fd.append(key, value);
  });
  return fd;
}

export const announcementsApi = {
  list: (params) => api.get('/announcements', params),
  get: (id) => api.get(`/announcements/${id}`),
  // `file` is optional — an auto-generated poster (see announcementGenerator.js)
  // or a manually attached image. Omitting it keeps the exact same plain-JSON
  // request this always sent, so nothing existing changes behavior.
  create: (payload, file) =>
    file
      ? api.post('/announcements', toFormData({ ...payload, file }), { isMultipart: true })
      : api.post('/announcements', payload),
  update: (id, payload, file) =>
    file
      ? api.put(`/announcements/${id}`, toFormData({ ...payload, file }), { isMultipart: true })
      : api.put(`/announcements/${id}`, payload),
  remove: (id) => api.delete(`/announcements/${id}`),
  send: (id, payload) => api.post(`/announcements/${id}/send`, payload || {}),
};
