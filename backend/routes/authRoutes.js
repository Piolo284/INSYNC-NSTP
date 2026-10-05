const router = require('express').Router();
const ctrl = require('../controllers/authController');
const passwordResetCtrl = require('../controllers/passwordResetController');
const accountCtrl = require('../controllers/accountController');
const sessionCtrl = require('../controllers/sessionController');
const { protect } = require('../middleware/auth');

router.post('/login', ctrl.login);
router.post('/2fa/verify', ctrl.verifyTwoFactor);
router.post('/validate-enrollment', ctrl.validateEnrollment);
router.post('/register', ctrl.register);
router.get('/me', protect, ctrl.me);
router.put('/password', protect, ctrl.changePassword);
router.post('/forgot-password', passwordResetCtrl.request);
router.post('/reset-password', passwordResetCtrl.reset);

router.put('/2fa', protect, accountCtrl.toggleTwoFactor);
router.post('/password/request-change', protect, accountCtrl.requestPasswordChange);
router.post('/password/confirm', protect, accountCtrl.confirmPasswordChange);
router.post('/email/request-change', protect, accountCtrl.requestEmailChange);
router.post('/email/confirm', protect, accountCtrl.confirmEmailChange);
router.post('/contact-number/request-change', protect, accountCtrl.requestContactNumberChange);
router.post('/contact-number/confirm', protect, accountCtrl.confirmContactNumberChange);

router.get('/sessions', protect, sessionCtrl.list);
router.delete('/sessions/:id', protect, sessionCtrl.revoke);
router.post('/sessions/logout-all', protect, sessionCtrl.revokeAll);

module.exports = router;
