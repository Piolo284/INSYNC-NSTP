const router = require('express').Router();
const ctrl = require('../controllers/certificateTemplateController');
const { protect, authorize } = require('../middleware/auth');
const { uploader } = require('../middleware/upload');
const { STAFF_ROLES, SYSTEM_ROLES } = require('../config/constants');

const image = uploader('certificate-templates').single('file');

router.use(protect);

// Reading a template is needed by whoever's approving a certificate request
// (any STAFF_ROLES member, per certificateRequestRoutes.js) so the admin
// panel can auto-generate the certificate from it — not just the NSTP Head.
// The System Maintenance Administrator also reads/writes templates (its one
// permitted NSTP-adjacent surface — see backend/config/constants.js) since
// template design is treated as a technical-maintenance concern.
router.get('/', authorize(...STAFF_ROLES, ...SYSTEM_ROLES), ctrl.list);
router.get('/:program', authorize(...STAFF_ROLES, ...SYSTEM_ROLES), ctrl.get);

// Designing the template itself — what it looks like, where fields go — is
// a university-wide concern (it drives every future issued certificate for
// the whole program). It used to also be the NSTP Head's job; that's moved
// to the maintenance admin exclusively, same as the Masterlist.
router.post('/:program', authorize(...SYSTEM_ROLES), image, ctrl.upload);
router.put('/:program/fields', authorize(...SYSTEM_ROLES), ctrl.updateFields);
router.delete('/:program', authorize(...SYSTEM_ROLES), ctrl.remove);

module.exports = router;
