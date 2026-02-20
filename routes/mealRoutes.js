const express = require('express');
const router = express.Router();
const { getMeals, getMealsByDate, addMeal, updateMeal, deleteMeal } = require('../controllers/mealController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, getMeals);
router.get('/by-date', auth, getMealsByDate);
router.post('/', auth, addMeal);
router.put('/:id', auth, updateMeal);
router.delete('/:id', auth, deleteMeal);

module.exports = router;
