const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    birthDate: { type: String },
    height: { type: Number },
    gender: { type: String, enum: ['male', 'female', 'other'] },

    bodyMetrics: [{
        date: { type: Date, default: Date.now }, // дата замірів
        weight: { type: Number, default: null }, // вага (кг)
        neck: { type: Number, default: null },   // шия (см)
        chest: { type: Number, default: null },  // грудна клітка (см)
        waist: { type: Number, default: null },  // талія (см)
        hips: { type: Number, default: null },   // стегна (см)
        biceps: { type: Number, default: null }, // біцепс (см)
        forearm: { type: Number, default: null } // передпліччя (см)
    }]
});

module.exports = mongoose.model('User', userSchema);
