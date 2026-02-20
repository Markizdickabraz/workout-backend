const express = require('express');
const router = express.Router();
const { register, login, getProfile, updateProfile, allUsers, logout, getBodyMetricsHistory } = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', auth, logout);
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.get('/allUsers', auth, allUsers);
router.get('/body-metrics-history', auth, getBodyMetricsHistory);

module.exports = router;
