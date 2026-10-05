const router = require('express').Router();
const ctrl = require('../controllers/systemConfigController');
const { protect, authorize } = require('../middleware/auth');
const { SYSTEM_ROLES } = require('../config/constants');

router.use(protect);
router.use(authorize(...SYSTEM_ROLES));

router.get('/', ctrl.get);
router.put('/general', ctrl.updateGeneral);
router.put('/maintenance', ctrl.updateMaintenance);
router.put('/qr', ctrl.updateQr);
router.put('/email', ctrl.updateEmail);
router.put('/grading', ctrl.updateGrading);

module.exports = router;
