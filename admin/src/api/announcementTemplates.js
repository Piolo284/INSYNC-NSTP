import { api } from './client';

export const announcementTemplatesApi = {
  list: () => api.get('/announcement-templates'),
  get: (program) => api.get(`/announcement-templates/${program}`),
  upload: (program, file, width, height) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('width', width);
    fd.append('height', height);
    return api.post(`/announcement-templates/${program}`, fd, { isMultipart: true });
  },
  updateFields: (program, fields) => api.put(`/announcement-templates/${program}/fields`, { fields }),
  remove: (program) => api.delete(`/announcement-templates/${program}`),
};
