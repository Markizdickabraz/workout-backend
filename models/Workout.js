const mongoose = require('mongoose');

const workoutSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    name: { type: String, required: true },
    weight: { type: Number, required: true },
    reps: { type: Number, required: true },
    sets: { type: Number, required: true },
    date: { type: String, required: true },
    _id: { type: String, required: true },
    difficulty: {
        type: String,
        enum: ['easy', 'hard', ''],
        default: ''
    }
}, { timestamps: true });

module.exports = mongoose.model('Workout', workoutSchema);
