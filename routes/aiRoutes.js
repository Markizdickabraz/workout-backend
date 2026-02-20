const express = require('express');
const router = express.Router();
const { processAIRequest, getAIComment, getAICommentByDate, consultAI } = require('../controllers/aiController');
const auth = require('../middleware/authMiddleware');

router.post('/ask', auth, processAIRequest);
router.post('/consult', auth, consultAI);
router.get('/', auth, getAIComment);
router.get('/by-date', auth, getAICommentByDate);

module.exports = router;
