const router = require('express').Router();
const ctrl = require('../controllers/moduleController');
const { protect, authorize } = require('../middleware/auth');
const { uploader } = require('../middleware/upload');

const file = uploader('modules').single('file');
const staff = authorize('officer', 'instructor', 'admin');

router.use(protect);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.get('/:id/submissions', staff, ctrl.submissions);
router.post('/', staff, file, ctrl.create);
router.put('/:id', staff, file, ctrl.update);
router.delete('/:id', staff, ctrl.remove);

module.exports = router;
