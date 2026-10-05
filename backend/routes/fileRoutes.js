const router = require('express').Router();
const ctrl = require('../controllers/fileController');

// Deliberately no protect() here — see controllers/fileController.js.
router.get('/:id', ctrl.stream);

module.exports = router;
