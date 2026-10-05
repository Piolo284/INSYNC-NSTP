import { api } from './client';

export const certificateRequestsApi = {
  list: (params) => api.get('/certificate-requests', params),
  get: (id) => api.get(`/certificate-requests/${id}`),
  review: (id, { status, reviewNote, file }) => {
    if (file) {
      const fd = new FormData();
      fd.append('status', status);
      if (reviewNote) fd.append('reviewNote', reviewNote);
      fd.append('file', file);
      return api.put(`/certificate-requests/${id}`, fd, { isMultipart: true });
    }
    return api.put(`/certificate-requests/${id}`, { status, reviewNote });
  },
};
