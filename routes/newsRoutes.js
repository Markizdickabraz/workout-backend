const express = require('express');
const router = express.Router();
const {
    getNews,
    addNews,
    deleteNews,
    updateNews,
    getNewsByDate
} = require('../controllers/newsController');
const auth = require('../middleware/authMiddleware');

router.get('/', getNews);
router.get('/:date', getNewsByDate);
router.post('/', auth, addNews);
router.put('/:id', auth, updateNews);
router.delete('/:id', auth, deleteNews);

module.exports = router;
