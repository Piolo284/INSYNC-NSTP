const router = require('express').Router();
const ctrl = require('../controllers/documentController');
const { protect, authorize } = require('../middleware/auth');
const { uploader } = require('../middleware/upload');

const file = uploader('documents').single('file');

router.use(protect);

router.get('/', ctrl.listMine);
router.get('/user/:userId', ctrl.listForUser);
router.post('/', file, ctrl.upload);
router.put('/:id', authorize('officer', 'instructor', 'admin'), ctrl.review);
router.delete('/:id', ctrl.remove);

module.exports = router;
