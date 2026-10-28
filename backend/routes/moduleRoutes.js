const router = require('express').Router();
const ctrl = require('../controllers/moduleController');
const comments = require('../controllers/privateCommentController');
const { protect, authorize } = require('../middleware/auth');
const { uploader } = require('../middleware/upload');
const { STAFF_ROLES } = require('../config/constants');
const { requireUnrestricted } = require('../utils/attendanceStanding');

const file = uploader('modules').single('file');
const staff = authorize(...STAFF_ROLES);

router.use(protect);

router.get('/', ctrl.list);
// Opening a module/activity (its file, instructions, rubric) is locked for a
// trainee at the absence limit; the list itself stays visible. Staff pass.
router.get('/:id', requireUnrestricted('Opening learning modules and activities'), ctrl.get);
router.get('/:id/submissions', staff, ctrl.submissions);
// Private trainee <-> officer thread per module; access checked in the controller.
router.get('/:id/comments', comments.list);
router.post('/:id/comments', comments.create);
router.get('/:id/comment-threads', staff, comments.threads);
router.post('/', staff, file, ctrl.create);
router.put('/:id', staff, file, ctrl.update);
router.delete('/:id', staff, ctrl.remove);

module.exports = router;
