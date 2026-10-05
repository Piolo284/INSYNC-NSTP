import { api } from './client';

export const systemConfigApi = {
  get: () => api.get('/system/config'),
  updateGeneral: (payload) => api.put('/system/config/general', payload),
  updateMaintenance: (payload) => api.put('/system/config/maintenance', payload),
  updateQr: (payload) => api.put('/system/config/qr', payload),
  updateEmail: (payload) => api.put('/system/config/email', payload),
  updateGrading: (payload) => api.put('/system/config/grading', payload),
};
