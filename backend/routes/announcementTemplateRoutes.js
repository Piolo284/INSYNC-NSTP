const router = require('express').Router();
const ctrl = require('../controllers/announcementTemplateController');
const { protect, authorize } = require('../middleware/auth');
const { uploader } = require('../middleware/upload');
const { STAFF_ROLES, SYSTEM_ROLES } = require('../config/constants');

const image = uploader('announcement-templates').single('file');

router.use(protect);

// Reading a template is needed by whoever's posting an announcement (any
// STAFF_ROLES member, per announcementRoutes.js) so the admin panel can
// auto-generate the poster from it — not just the NSTP Head. The System
// Maintenance Administrator also reads/writes templates, same as
// Certificate Templates — template design is a technical-maintenance
// concern, not an NSTP-data one.
router.get('/', authorize(...STAFF_ROLES, ...SYSTEM_ROLES), ctrl.list);
router.get('/:program', authorize(...STAFF_ROLES, ...SYSTEM_ROLES), ctrl.get);

// Designing the template itself is a university-wide concern (it drives
// every future posted announcement for the whole program) — restricted to
// the maintenance admin, same as Certificate Templates and the Masterlist.
router.post('/:program', authorize(...SYSTEM_ROLES), image, ctrl.upload);
router.put('/:program/fields', authorize(...SYSTEM_ROLES), ctrl.updateFields);
router.delete('/:program', authorize(...SYSTEM_ROLES), ctrl.remove);

module.exports = router;
