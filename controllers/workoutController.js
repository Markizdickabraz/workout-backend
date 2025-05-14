const Workout = require('../models/Workout');

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

exports.deleteWorkout = async (req, res) => {
    try {
        const { id } = req.params;
        await Workout.deleteOne({ _id: id, userId: req.userId });
        res.json({ message: 'Workout deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
