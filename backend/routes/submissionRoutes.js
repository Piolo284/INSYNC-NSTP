const router = require('express').Router();
const ctrl = require('../controllers/submissionController');
const { protect, authorize } = require('../middleware/auth');
const { uploader } = require('../middleware/upload');

const file = uploader('submissions').single('file');
const staff = authorize('officer', 'instructor', 'admin');

router.use(protect);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', file, ctrl.create);
router.put('/:id', file, ctrl.update);
router.post('/:id/grade', staff, ctrl.grade);
router.delete('/:id', ctrl.remove);

module.exports = router;
