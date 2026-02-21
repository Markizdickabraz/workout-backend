const Cardio = require('../models/Cardio');

// POST /api/cardio — Create new cardio session
exports.createCardio = async (req, res) => {
    try {
        const { date, type, customType, duration, distance, avgHeartRate, maxHeartRate, calories, avgPace, avgSpeed, elevation, notes } = req.body;

        if (!date || !type || !duration) {
            return res.status(400).json({ message: 'Дата, тип та тривалість обов\'язкові' });
        }

        const cardio = await Cardio.create({
            userId: req.userId,
            date,
            type,
            customType: type === 'other' ? customType : undefined,
            duration,
            distance,
            avgHeartRate,
            maxHeartRate,
            calories,
            avgPace,
            avgSpeed,
            elevation,
            notes,
        });

        res.status(201).json(cardio);
    } catch (err) {
        console.error('Create cardio error:', err);
        res.status(500).json({ message: 'Помилка створення кардіо-сесії', error: err.message });
    }
};

// GET /api/cardio — Get all cardio sessions for user
exports.getCardio = async (req, res) => {
    try {
        const { startDate, endDate, type } = req.query;
        
        const filter = { userId: req.userId };
        
        if (startDate && endDate) {
            filter.date = { $gte: startDate, $lte: endDate };
        } else if (startDate) {
            filter.date = { $gte: startDate };
        } else if (endDate) {
            filter.date = { $lte: endDate };
        }
        
        if (type) {
            filter.type = type;
        }

        const cardioSessions = await Cardio.find(filter).sort({ date: -1, createdAt: -1 });
        res.json(cardioSessions);
    } catch (err) {
        console.error('Get cardio error:', err);
        res.status(500).json({ message: 'Помилка отримання кардіо-сесій', error: err.message });
    }
};

// GET /api/cardio/:id — Get single cardio session
exports.getCardioById = async (req, res) => {
    try {
        const cardio = await Cardio.findOne({ _id: req.params.id, userId: req.userId });
        
        if (!cardio) {
            return res.status(404).json({ message: 'Кардіо-сесію не знайдено' });
        }

        res.json(cardio);
    } catch (err) {
        console.error('Get cardio by id error:', err);
        res.status(500).json({ message: 'Помилка отримання кардіо-сесії', error: err.message });
    }
};

// PUT /api/cardio/:id — Update cardio session
exports.updateCardio = async (req, res) => {
    try {
        const { date, type, customType, duration, distance, avgHeartRate, maxHeartRate, calories, avgPace, avgSpeed, elevation, notes } = req.body;

        const cardio = await Cardio.findOne({ _id: req.params.id, userId: req.userId });
        
        if (!cardio) {
            return res.status(404).json({ message: 'Кардіо-сесію не знайдено' });
        }

        // Update fields
        if (date !== undefined) cardio.date = date;
        if (type !== undefined) cardio.type = type;
        if (type === 'other' && customType !== undefined) cardio.customType = customType;
        if (duration !== undefined) cardio.duration = duration;
        if (distance !== undefined) cardio.distance = distance;
        if (avgHeartRate !== undefined) cardio.avgHeartRate = avgHeartRate;
        if (maxHeartRate !== undefined) cardio.maxHeartRate = maxHeartRate;
        if (calories !== undefined) cardio.calories = calories;
        if (avgPace !== undefined) cardio.avgPace = avgPace;
        if (avgSpeed !== undefined) cardio.avgSpeed = avgSpeed;
        if (elevation !== undefined) cardio.elevation = elevation;
        if (notes !== undefined) cardio.notes = notes;

        await cardio.save();
        res.json(cardio);
    } catch (err) {
        console.error('Update cardio error:', err);
        res.status(500).json({ message: 'Помилка оновлення кардіо-сесії', error: err.message });
    }
};

// DELETE /api/cardio/:id — Delete cardio session
exports.deleteCardio = async (req, res) => {
    try {
        const cardio = await Cardio.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        
        if (!cardio) {
            return res.status(404).json({ message: 'Кардіо-сесію не знайдено' });
        }

        res.json({ message: 'Кардіо-сесію видалено', cardio });
    } catch (err) {
        console.error('Delete cardio error:', err);
        res.status(500).json({ message: 'Помилка видалення кардіо-сесії', error: err.message });
    }
};

// GET /api/cardio/stats — Get cardio statistics
exports.getCardioStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const filter = { userId: req.userId };
        if (startDate && endDate) {
            filter.date = { $gte: startDate, $lte: endDate };
        }

        const sessions = await Cardio.find(filter);

        const stats = {
            totalSessions: sessions.length,
            totalDuration: sessions.reduce((sum, s) => sum + (s.duration || 0), 0),
            totalDistance: sessions.reduce((sum, s) => sum + (s.distance || 0), 0),
            totalCalories: sessions.reduce((sum, s) => sum + (s.calories || 0), 0),
            avgHeartRate: 0,
            avgPace: 0,
            avgSpeed: 0,
            byType: {},
        };

        if (sessions.length > 0) {
            const hrSessions = sessions.filter(s => s.avgHeartRate);
            const paceSessions = sessions.filter(s => s.avgPace);
            const speedSessions = sessions.filter(s => s.avgSpeed);

            if (hrSessions.length) {
                stats.avgHeartRate = Math.round(hrSessions.reduce((sum, s) => sum + s.avgHeartRate, 0) / hrSessions.length);
            }
            if (paceSessions.length) {
                stats.avgPace = Math.round(paceSessions.reduce((sum, s) => sum + s.avgPace, 0) / paceSessions.length * 100) / 100;
            }
            if (speedSessions.length) {
                stats.avgSpeed = Math.round(speedSessions.reduce((sum, s) => sum + s.avgSpeed, 0) / speedSessions.length * 100) / 100;
            }

            // Group by type
            sessions.forEach(s => {
                const type = s.type;
                if (!stats.byType[type]) {
                    stats.byType[type] = { count: 0, duration: 0, distance: 0, calories: 0 };
                }
                stats.byType[type].count += 1;
                stats.byType[type].duration += s.duration || 0;
                stats.byType[type].distance += s.distance || 0;
                stats.byType[type].calories += s.calories || 0;
            });
        }

        res.json(stats);
    } catch (err) {
        console.error('Get cardio stats error:', err);
        res.status(500).json({ message: 'Помилка отримання статистики кардіо', error: err.message });
    }
};
