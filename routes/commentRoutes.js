const express = require('express');
const router = express.Router();
const {getComment, addComment, deleteComment, updateComment, getCommentByDate} = require('../controllers/commentController');
const auth = require('../middleware/authMiddleware');

router.get('/',auth , getComment);
router.get('/:date', auth, getCommentByDate);
router.post('/', auth, addComment);
router.put('/:id', auth ,updateComment);
router.delete('/:id', auth , deleteComment);

module.exports = router;
