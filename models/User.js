const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    birthDate: { type: String },
    height: { type: Number },
    gender: { type: String, enum: ['male', 'female', 'other'] },

    // ── Активність для розрахунку TDEE (3 незалежних фактори) ──────
    // Тип роботи: сидяча, стояча, фізична
    jobType: { type: String, enum: ['desk', 'standing', 'physical'], default: 'desk' },
    // Тренувань на тиждень: 0–7
    workoutsPerWeek: { type: Number, min: 0, max: 7, default: 3 },
    // Побутова активність (ходьба, кроки поза тренуваннями)
    dailyActivity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },

    // legacy — залишаємо для зворотної сумісності, але більше не використовуємо для TDEE
    activityLevel: { type: String, enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'], default: 'moderate' },

    isOnline: { type: Boolean, default: false },

    bodyMetrics: [{
        date: { type: Date, default: Date.now },       // дата замірів
        weight: { type: Number, default: null },        // вага (кг)
        neck: { type: Number, default: null },          // шия (см)
        chest: { type: Number, default: null },         // грудна клітка (см)
        waist: { type: Number, default: null },         // талія (см)
        hips: { type: Number, default: null },          // стегна (см)
        biceps: { type: Number, default: null },        // біцепс (см)
        forearm: { type: Number, default: null },       // передпліччя (см)
        bmi: { type: Number, default: null },           // індекс маси тіла
        bodyFat: { type: Number, default: null },       // тілесний жир (%)
        subcutaneousFat: { type: Number, default: null }, // підшкірна жирова клітковина (%)
        visceralFat: { type: Number, default: null },   // вісцеральний жир (рівень)
        bodyWater: { type: Number, default: null },     // вода в організмі (%)
        muscleMass: { type: Number, default: null },    // м'язова маса (кг)
        boneMass: { type: Number, default: null },      // кісткова маса (кг)
        bmr: { type: Number, default: null },           // інтенсивність основного обміну (ккал)
        metabolicAge: { type: Number, default: null },  // метаболічний вік (років)
    }]
});

module.exports = mongoose.model('User', userSchema);
