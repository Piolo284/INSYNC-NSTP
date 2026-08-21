const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', ctrl.login);
router.post('/register', ctrl.register);
router.get('/me', protect, ctrl.me);
router.put('/password', protect, ctrl.changePassword);

module.exports = router;
