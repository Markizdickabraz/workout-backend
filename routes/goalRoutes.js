const express = require('express');
const router = express.Router();
const { getGoal, upsertGoal } = require('../controllers/goalController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, getGoal);
router.put('/', auth, upsertGoal);

module.exports = router;
