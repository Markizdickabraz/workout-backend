const express = require('express');
const router = express.Router();
const { getWorkouts, addWorkout, deleteWorkout } = require('../controllers/workoutController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, getWorkouts);
router.post('/', auth, addWorkout);
router.delete('/:id', auth, deleteWorkout);

module.exports = router;
