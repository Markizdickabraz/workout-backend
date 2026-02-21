const mongoose = require('mongoose');

const cardioSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    date: {
        type: String, // YYYY-MM-DD format
        required: true,
    },
    type: {
        type: String,
        required: true,
        enum: ['running', 'cycling', 'swimming', 'walking', 'rowing', 'elliptical', 'stair_climber', 'jump_rope', 'hiking', 'other'],
    },
    customType: {
        type: String, // For 'other' type
    },
    duration: {
        type: Number, // minutes
        required: true,
    },
    distance: {
        type: Number, // km
    },
    avgHeartRate: {
        type: Number, // bpm
    },
    maxHeartRate: {
        type: Number, // bpm
    },
    calories: {
        type: Number, // kcal burned
    },
    avgPace: {
        type: Number, // min/km
    },
    avgSpeed: {
        type: Number, // km/h
    },
    elevation: {
        type: Number, // meters
    },
    notes: {
        type: String,
    },
}, {
    timestamps: true,
});

// Index for faster queries
cardioSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('Cardio', cardioSchema);
