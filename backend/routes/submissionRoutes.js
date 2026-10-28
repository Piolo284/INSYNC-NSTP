const router = require('express').Router();
const ctrl = require('../controllers/submissionController');
const { protect, authorize } = require('../middleware/auth');
const { uploader } = require('../middleware/upload');
const { STAFF_ROLES, TRAINEE_ROLES } = require('../config/constants');
const { requireUnrestricted } = require('../utils/attendanceStanding');

const file = uploader('submissions').single('file');
const staff = authorize(...STAFF_ROLES);
const trainee = authorize(...TRAINEE_ROLES);

router.use(protect);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
// Activities are modules, so turning work in is locked along with opening
// them (utils/attendanceStanding.js). Checked before the upload is stored.
// Staff editing/grading are never restricted.
const unlocked = requireUnrestricted('Submitting learning activities');
router.post('/', trainee, unlocked, file, ctrl.create);
router.put('/:id', unlocked, file, ctrl.update);
router.post('/:id/grade', staff, ctrl.grade);
router.delete('/:id', unlocked, ctrl.remove);

module.exports = router;
