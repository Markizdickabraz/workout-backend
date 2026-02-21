const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const cardioController = require('../controllers/cardioController');

// All routes require authentication
router.use(authMiddleware);

// POST /api/cardio — Create new cardio session
router.post('/', cardioController.createCardio);

// GET /api/cardio — Get all cardio sessions (with optional filters)
router.get('/', cardioController.getCardio);

// GET /api/cardio/stats — Get cardio statistics
router.get('/stats', cardioController.getCardioStats);

// GET /api/cardio/:id — Get single cardio session
router.get('/:id', cardioController.getCardioById);

// PUT /api/cardio/:id — Update cardio session
router.put('/:id', cardioController.updateCardio);

// DELETE /api/cardio/:id — Delete cardio session
router.delete('/:id', cardioController.deleteCardio);

module.exports = router;
