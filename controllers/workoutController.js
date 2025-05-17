const Workout = require('../models/Workout');
const Comment = require("../models/Comment");

exports.getWorkouts = async (req, res) => {
    try {
        const workouts = await Workout.find({ userId: req.userId });
        res.json(workouts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.addWorkout = async (req, res) => {
    try {
        const { date, name, weight, sets, reps, _id } = req.body;
        const workout = await Workout.create({ userId: req.userId, date, name, weight, sets, reps, _id });
        res.status(201).json(workout);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateWorkout = async (req, res) => {
    try {
        const { date, name, weight, sets, reps, _id, difficulty } = req.body;
        const user = await Workout.findById(req.params.id);
        if (name !== undefined) user.name = name;
        if (weight !== undefined) user.weight = weight;
        if (sets !== undefined) user.sets = sets;
        if (reps !== undefined) user.reps = reps;
        if (date !== undefined) user.date = date;
        if (_id !== undefined) user._id = _id;
        if (difficulty !== undefined) user.difficulty = difficulty;

        await user.save();

        res.json({
            name,
            weight,
            sets,
            reps,
            _id,
            date,
            difficulty,
            userId: req.userId,
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

exports.deleteWorkout = async (req, res) => {
    try {
        const { id } = req.params;
        await Workout.deleteOne({ _id: id, userId: req.userId });
        res.json({ message: 'Workout deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
