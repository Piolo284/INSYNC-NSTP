const router = require('express').Router();
const ctrl = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');
const { STAFF_ROLES, TRAINEE_ROLES } = require('../config/constants');

const staff = authorize(...STAFF_ROLES);
const trainee = authorize(...TRAINEE_ROLES);

router.use(protect);

// --- QR sessions (officer) ---
router.post('/sessions', staff, ctrl.createSession);
router.get('/sessions', staff, ctrl.listSessions);
router.get('/sessions/:id', ctrl.getSession);
router.put('/sessions/:id/close', staff, ctrl.closeSession);

// --- Trainee QR flow ---
router.post('/scan', trainee, ctrl.scan);
router.post('/verify', trainee, ctrl.verify);

// --- Records ---
router.get('/summary', ctrl.summary);
router.get('/', ctrl.list);
router.post('/', staff, ctrl.create);
router.put('/:id', staff, ctrl.update);
router.delete('/:id', staff, ctrl.remove);

module.exports = router;
