const router = require('express').Router();
const ctrl = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/auth');
const { STAFF_ROLES, ADMIN_ROLES } = require('../config/constants');

router.use(protect);

router.get('/officer', authorize(...STAFF_ROLES), ctrl.officer);
router.get('/admin', authorize(...ADMIN_ROLES), ctrl.admin);

module.exports = router;
