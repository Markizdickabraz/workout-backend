const express = require('express');
const router = express.Router();
const {processAIRequest, getAIComment, getAICommentByDate} = require('../controllers/aiController');
const auth = require('../middleware/authMiddleware');
const {getComment, getCommentByDate} = require("../controllers/commentController");

router.post('/ask' ,auth, processAIRequest);
router.get('/',auth , getAIComment);
router.get('/:date', auth, getAICommentByDate);

module.exports = router;
