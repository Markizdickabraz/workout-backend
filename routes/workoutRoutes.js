const express = require('express');
const router = express.Router();
const { getWorkouts, addWorkout, deleteWorkout, updateWorkout} = require('../controllers/workoutController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, getWorkouts);
router.post('/', auth, addWorkout);
router.put('/:id', auth, updateWorkout);
router.delete('/:id', auth, deleteWorkout);

module.exports = router;
