const router = require('express').Router();
const ctrl = require('../controllers/announcementController');
const { protect, authorize } = require('../middleware/auth');
const { uploader } = require('../middleware/upload');
const { STAFF_ROLES } = require('../config/constants');

const staff = authorize(...STAFF_ROLES);
// Optional — most announcements have no image; when the admin panel
// auto-composes one from a template (or an admin attaches one directly)
// it's sent as multipart, same as every other file upload in the app.
const image = uploader('announcements').single('file');

router.use(protect);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', staff, image, ctrl.create);
router.put('/:id', staff, image, ctrl.update);
router.delete('/:id', staff, ctrl.remove);
router.post('/:id/send', staff, ctrl.send);

module.exports = router;
