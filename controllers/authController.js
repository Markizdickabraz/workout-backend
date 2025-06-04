const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashedPassword });

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const userObj = user.toObject();

        if (Array.isArray(userObj.bodyMetrics)) {
            userObj.bodyMetrics.sort((a, b) => new Date(b.date) - new Date(a.date));
            userObj.bodyMetrics = userObj.bodyMetrics.slice(0, 5);
        }

        res.json(userObj);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};



exports.updateProfile = async (req, res) => {
    try {
        const { name, birthDate, height, gender, bodyMetrics } = req.body;

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (name !== undefined) user.name = name;
        if (birthDate !== undefined) user.birthDate = birthDate;
        if (gender !== undefined) user.gender = gender;
        if (height !== undefined) user.height = height;

        if (!Array.isArray(user.bodyMetrics)) {
            user.bodyMetrics = [];
        }

        if (bodyMetrics) {
            const newMetrics = {
                weight: bodyMetrics[0].weight,
                neck: bodyMetrics[0].neck,
                chest: bodyMetrics[0].chest,
                waist: bodyMetrics[0].waist,
                hips: bodyMetrics[0].hips,
                biceps: bodyMetrics[0].biceps,
                forearm: bodyMetrics[0].forearm,
                date: new Date()
            };
            user.bodyMetrics.push(newMetrics);
        }

        await user.save();
        const last10Metrics = user.bodyMetrics.slice(-10);

        res.json({
            id: req.userId,
            name: user.name,
            birthDate: user.birthDate,
            height: user.height,
            gender: user.gender,
            bodyMetrics: last10Metrics
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

