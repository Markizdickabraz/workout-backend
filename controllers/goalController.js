const Goal = require('../models/Goal');

exports.getGoal = async (req, res) => {
    try {
        let goal = await Goal.findOne({ userId: req.userId });
        if (!goal) {
            goal = await Goal.create({ userId: req.userId });
        }
        res.json(goal);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.upsertGoal = async (req, res) => {
    try {
        const {
            targetWeight, targetBodyFat, targetMuscleMass, targetBmi,
            targetCaloriesPerDay, targetProteinPerDay, targetWaterPerDay,
            targetWorkoutsPerWeek, targetDate, notes, customGoals,
        } = req.body;

        const update = {};
        if (targetWeight !== undefined) update.targetWeight = targetWeight;
        if (targetBodyFat !== undefined) update.targetBodyFat = targetBodyFat;
        if (targetMuscleMass !== undefined) update.targetMuscleMass = targetMuscleMass;
        if (targetBmi !== undefined) update.targetBmi = targetBmi;
        if (targetCaloriesPerDay !== undefined) update.targetCaloriesPerDay = targetCaloriesPerDay;
        if (targetProteinPerDay !== undefined) update.targetProteinPerDay = targetProteinPerDay;
        if (targetWaterPerDay !== undefined) update.targetWaterPerDay = targetWaterPerDay;
        if (targetWorkoutsPerWeek !== undefined) update.targetWorkoutsPerWeek = targetWorkoutsPerWeek;
        if (targetDate !== undefined) update.targetDate = targetDate || null;
        if (notes !== undefined) update.notes = notes;
        if (customGoals !== undefined) update.customGoals = customGoals;

        const goal = await Goal.findOneAndUpdate(
            { userId: req.userId },
            { $set: update },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.json(goal);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
