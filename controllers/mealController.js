const Meal = require('../models/Meal');

exports.getMeals = async (req, res) => {
    try {
        const meals = await Meal.find({ userId: req.userId });
        res.json(meals);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getMealsByDate = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ message: 'Date is required' });

        const meals = await Meal.find({ userId: req.userId, date });
        res.json(meals);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.addMeal = async (req, res) => {
    try {
        const { date, name, calories, protein, fats, carbs, grams, _id } = req.body;
        const meal = await Meal.create({
            userId: req.userId,
            date,
            name,
            calories,
            protein,
            fats,
            carbs,
            grams: grams || 100,
            _id,
        });
        res.status(201).json(meal);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateMeal = async (req, res) => {
    try {
        const { name, calories, protein, fats, carbs, grams, date } = req.body;
        const meal = await Meal.findById(req.params.id);

        if (!meal) return res.status(404).json({ message: 'Meal not found' });
        if (meal.userId.toString() !== req.userId) return res.status(403).json({ message: 'Forbidden' });

        if (name !== undefined) meal.name = name;
        if (calories !== undefined) meal.calories = calories;
        if (protein !== undefined) meal.protein = protein;
        if (fats !== undefined) meal.fats = fats;
        if (carbs !== undefined) meal.carbs = carbs;
        if (grams !== undefined) meal.grams = grams;
        if (date !== undefined) meal.date = date;

        await meal.save();
        res.json(meal);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.deleteMeal = async (req, res) => {
    try {
        const { id } = req.params;
        await Meal.deleteOne({ _id: id, userId: req.userId });
        res.json({ message: 'Meal deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
