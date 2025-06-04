const express = require('express');
const router = express.Router();
const { register, login, getProfile, updateProfile, allUsers} = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/profile',auth , getProfile);
router.put('/profile', auth ,updateProfile);
router.get('/allUsers',auth, allUsers);

module.exports = router;
