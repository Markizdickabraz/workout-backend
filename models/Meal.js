const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    name: { type: String, required: true },
    calories: { type: Number, required: true },
    protein: { type: Number, required: true },
    fats: { type: Number, required: true },
    carbs: { type: Number, required: true },
    grams: { type: Number, default: 100 },
    date: { type: String, required: true },
    _id: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Meal', mealSchema);
