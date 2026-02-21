const express = require('express');
const router = express.Router();
const { processAIRequest, getAIComment, getAICommentByDate, consultAI, mealAdvice } = require('../controllers/aiController');
const auth = require('../middleware/authMiddleware');

router.post('/ask', auth, processAIRequest);
router.post('/consult', auth, consultAI);
router.post('/meal-advice', auth, mealAdvice);
router.get('/', auth, getAIComment);
router.get('/by-date', auth, getAICommentByDate);

module.exports = router;
