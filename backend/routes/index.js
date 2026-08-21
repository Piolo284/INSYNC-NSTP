const router = require('express').Router();

router.get('/', (_req, res) => {
  res.json({
    success: true,
    name: 'MARSU NSTP Management System API',
    version: '1.0.0',
    endpoints: [
      'POST   /api/auth/login',
      'POST   /api/auth/register',
      'GET    /api/auth/me',
      'PUT    /api/auth/password',
      'GET    /api/users',
      'GET    /api/users/:id',
      'PUT    /api/users/:id',
      'DELETE /api/users/:id',
      'GET    /api/students',
      'GET    /api/students/:id',
      'GET    /api/students/:id/dashboard',
      'GET    /api/students/:id/attendance',
      'GET    /api/students/:id/submissions',
      'GET    /api/students/:id/grades',
      'GET    /api/cadets',
      'GET    /api/cadets/:id',
      'GET    /api/cadets/:id/dashboard',
      'GET    /api/activities',
      'POST   /api/activities',
      'PUT    /api/activities/:id',
      'DELETE /api/activities/:id',
      'GET    /api/activities/:id/participants',
      'GET    /api/attendance',
      'POST   /api/attendance',
      'PUT    /api/attendance/:id',
      'POST   /api/attendance/sessions',
      'POST   /api/attendance/scan',
      'POST   /api/attendance/verify',
      'GET    /api/attendance/summary',
      'GET    /api/announcements',
      'POST   /api/announcements',
      'PUT    /api/announcements/:id',
      'DELETE /api/announcements/:id',
      'GET    /api/modules',
      'POST   /api/modules',
      'PUT    /api/modules/:id',
      'DELETE /api/modules/:id',
      'GET    /api/submissions',
      'POST   /api/submissions',
      'POST   /api/submissions/:id/grade',
      'GET    /api/grades',
      'GET    /api/grades/:studentId',
      'GET    /api/notifications/:userId',
      'PUT    /api/notifications/:id/read',
      'GET    /api/dashboard/officer',
      'GET    /api/dashboard/admin',
      'GET    /api/documents',
      'GET    /api/officers',
      'GET    /api/officers/:id',
      'POST   /api/officers',
      'PUT    /api/officers/:id',
      'DELETE /api/officers/:id',
    ],
  });
});

router.use('/auth', require('./authRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/students', require('./studentRoutes'));
router.use('/cadets', require('./cadetRoutes'));
router.use('/activities', require('./activityRoutes'));
router.use('/attendance', require('./attendanceRoutes'));
router.use('/announcements', require('./announcementRoutes'));
router.use('/modules', require('./moduleRoutes'));
router.use('/submissions', require('./submissionRoutes'));
router.use('/grades', require('./gradeRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/documents', require('./documentRoutes'));
router.use('/officers', require('./officerRoutes'));

module.exports = router;
