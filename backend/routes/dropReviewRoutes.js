const router = require('express').Router();
const ctrl = require('../controllers/dropReviewController');
const { protect, authorize } = require('../middleware/auth');

// Only the trainee's assigned officer confirms a drop (checked per trainee
// in the controller).
router.use(protect);
router.use(authorize('officer'));

router.post('/:userId/confirm', ctrl.confirm);
router.post('/:userId/keep', ctrl.keep);

module.exports = router;
