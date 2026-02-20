const mongoose = require('mongoose');

const customGoalSchema = new mongoose.Schema({
    label: { type: String, required: true },
    currentValue: { type: Number, default: null },
    targetValue: { type: Number, default: null },
    unit: { type: String, default: '' },
}, { _id: true });

const goalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', unique: true },
    targetWeight: { type: Number, default: null },
    targetBodyFat: { type: Number, default: null },
    targetMuscleMass: { type: Number, default: null },
    targetBmi: { type: Number, default: null },
    targetCaloriesPerDay: { type: Number, default: null },
    targetProteinPerDay: { type: Number, default: null },
    targetWaterPerDay: { type: Number, default: null },
    targetWorkoutsPerWeek: { type: Number, default: null },
    targetDate: { type: Date, default: null },
    notes: { type: String, default: '' },
    customGoals: [customGoalSchema],
}, { timestamps: true });

module.exports = mongoose.model('Goal', goalSchema);
