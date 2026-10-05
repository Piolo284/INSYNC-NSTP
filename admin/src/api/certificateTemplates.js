import { api } from './client';

export const certificateTemplatesApi = {
  list: () => api.get('/certificate-templates'),
  get: (program) => api.get(`/certificate-templates/${program}`),
  upload: (program, file, width, height) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('width', width);
    fd.append('height', height);
    return api.post(`/certificate-templates/${program}`, fd, { isMultipart: true });
  },
  updateFields: (program, fields) => api.put(`/certificate-templates/${program}/fields`, { fields }),
  remove: (program) => api.delete(`/certificate-templates/${program}`),
};
