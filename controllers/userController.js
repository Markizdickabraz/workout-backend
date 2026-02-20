const User = require('../models/User');

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find({ isOnline: true })
            .select('-password')
            .lean();

        res.status(200).json(users);
    } catch (error) {
        console.error('Помилка отримання користувачів:', error);
        res.status(500).json({ message: 'Не вдалося отримати користувачів' });
    }
};