const router = require('express').Router();
const ctrl = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');
const { STAFF_ROLES, TRAINEE_ROLES } = require('../config/constants');
const { requireUnrestricted, standingForUser } = require('../utils/attendanceStanding');
const asyncHandler = require('../utils/asyncHandler');

const staff = authorize(...STAFF_ROLES);
const trainee = authorize(...TRAINEE_ROLES);

router.use(protect);

// --- QR sessions (officer) ---
router.post('/sessions', staff, ctrl.createSession);
router.get('/sessions', staff, ctrl.listSessions);
router.get('/sessions/:id', ctrl.getSession);
router.put('/sessions/:id/close', staff, ctrl.closeSession);

// --- Trainee QR flow ---
// Locked once the trainee reaches the counted-absence limit
// (utils/attendanceStanding.js) — enforced here, not just hidden in the app.
const attendanceUnlocked = requireUnrestricted('Attendance check-in/check-out');
router.post('/scan', trainee, attendanceUnlocked, ctrl.scan);
router.post('/verify', trainee, attendanceUnlocked, ctrl.verify);

// The trainee's own live attendance standing (at-risk / restricted).
router.get(
  '/standing',
  trainee,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await standingForUser(req.user) });
  })
);

// --- Records ---
router.get('/summary', ctrl.summary);
router.post('/finalize', staff, ctrl.finalizeDay);
router.get('/', ctrl.list);
router.post('/', staff, ctrl.create);
router.put('/:id', staff, ctrl.update);
router.delete('/:id', staff, ctrl.remove);

module.exports = router;
