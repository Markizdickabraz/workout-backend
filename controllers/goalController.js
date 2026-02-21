const Goal = require('../models/Goal');
const User = require('../models/User');
const { estimateMacros } = require('../services/macroEstimator');

/**
 * Build a live macro response from a saved goal + user data.
 * Never persists auto-calculated values — they are always derived on-the-fly.
 */
async function buildGoalResponse(goal, userId) {
    const user = await User.findById(userId).select('bodyMetrics height gender birthDate jobType workoutsPerWeek dailyActivity').lean();
    const macros = estimateMacros(user, goal);
    console.log('[goalController] estimateMacros:', JSON.stringify(macros));

    // ALWAYS use live-calculated macros — never trust stored values in DB
    // (stored targetCaloriesPerDay/targetProteinPerDay may be stale from old sessions)
    const calories = macros.calories || null;
    const protein  = macros.protein  || null;
    const fats     = macros.fats     || null;
    const carbs    = macros.carbs    || null;

    return {
        ...goal.toObject(),
        // Always overwrite stored macros in response with live-calculated values
        // (stored values in DB may be stale auto-writes from previous sessions)
        targetCaloriesPerDay: calories,
        targetProteinPerDay:  protein,
        _macros: { calories, protein, fats, carbs },
        _macroMethod:    macros.method,
        _goalDirection:  macros.goalDirection,
        _tdee:           macros.tdee,
        _leanMass:       macros.leanMass,
        _calorieAdjustment: macros.calorieAdjustment,
    };
}

exports.getGoal = async (req, res) => {
    try {
        let goal = await Goal.findOne({ userId: req.userId });
        if (!goal) {
            goal = await Goal.create({ userId: req.userId });
        }
        const response = await buildGoalResponse(goal, req.userId);
        res.json(response);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.upsertGoal = async (req, res) => {
    try {
        const {
            targetWeight, targetBodyFat, targetMuscleMass, targetBmi,
            targetWaterPerDay, targetWorkoutsPerWeek, targetDate, notes, customGoals,
            // Only persist these if user explicitly provides them as manual overrides
            targetCaloriesPerDay, targetProteinPerDay,
        } = req.body;

        const update = {};
        if (targetWeight          !== undefined) update.targetWeight          = targetWeight;
        if (targetBodyFat         !== undefined) update.targetBodyFat         = targetBodyFat;
        if (targetMuscleMass      !== undefined) update.targetMuscleMass      = targetMuscleMass;
        if (targetBmi             !== undefined) update.targetBmi             = targetBmi;
        if (targetWaterPerDay     !== undefined) update.targetWaterPerDay     = targetWaterPerDay;
        if (targetWorkoutsPerWeek !== undefined) update.targetWorkoutsPerWeek = targetWorkoutsPerWeek;
        if (targetDate            !== undefined) update.targetDate            = targetDate || null;
        if (notes                 !== undefined) update.notes                 = notes;
        if (customGoals           !== undefined) update.customGoals           = customGoals;

        // Clear stored auto-calculated macros so they are always recalculated live.
        // Only persist if the frontend explicitly sends non-null numeric values (manual override).
        const hasManualCal  = targetCaloriesPerDay  != null && targetCaloriesPerDay  > 0;
        const hasManualProt = targetProteinPerDay    != null && targetProteinPerDay   > 0;
        update.targetCaloriesPerDay = hasManualCal  ? targetCaloriesPerDay  : null;
        update.targetProteinPerDay  = hasManualProt ? targetProteinPerDay   : null;

        const goal = await Goal.findOneAndUpdate(
            { userId: req.userId },
            { $set: update },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        const response = await buildGoalResponse(goal, req.userId);
        return res.json(response);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
