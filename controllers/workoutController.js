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

exports.updateWorkout = async (req, res) => {
    try {
        const { date, name, weight, sets, reps, difficulty } = req.body;
        const workout = await Workout.findById(req.params.id);

        if (!workout) {
            return res.status(404).json({ message: 'Workout not found' });
        }

        if (workout.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        if (name !== undefined) workout.name = name;
        if (weight !== undefined) workout.weight = weight;
        if (sets !== undefined) workout.sets = sets;
        if (reps !== undefined) workout.reps = reps;
        if (date !== undefined) workout.date = date;
        if (difficulty !== undefined) workout.difficulty = difficulty;

        await workout.save();

        res.json(workout);

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
