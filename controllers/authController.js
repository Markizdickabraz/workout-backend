const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    try {
        const {name, email, password} = req.body;
        const existingUser = await User.findOne({email});
        if (existingUser) return res.status(400).json({message: 'User already exists'});

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({name, email, password: hashedPassword});

        const token = jwt.sign({userId: user._id}, process.env.JWT_SECRET, {expiresIn: '7d'});
        user.isOnline = true;
        await user.save();

        res.status(201).json({token, user: {id: user._id, name: user.name, email: user.email}});
    } catch (err) {
        res.status(500).json({message: err.message});
    }
};

exports.login = async (req, res) => {
    try {
        const {email, password} = req.body;
        const user = await User.findOne({email});
        if (!user) return res.status(400).json({message: 'Invalid credentials'});

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({message: 'Invalid credentials'});

        const token = jwt.sign({userId: user._id}, process.env.JWT_SECRET, {expiresIn: '7d'});
        user.isOnline = true;
        await user.save();

        res.json({token, user: {id: user._id, name: user.name, email: user.email}});
    } catch (err) {
        res.status(500).json({message: err.message});
    }
};

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(404).json({message: 'User not found'});

        const userObj = user.toObject();

        if (Array.isArray(userObj.bodyMetrics)) {
            userObj.bodyMetrics.sort((a, b) => new Date(b.date) - new Date(a.date));
            userObj.bodyMetrics = userObj.bodyMetrics.slice(0, 5);
        }

        res.json(userObj);
    } catch (err) {
        console.error(err);
        res.status(500).json({message: err.message});
    }
};


exports.updateProfile = async (req, res) => {
    try {
        const {name, birthDate, height, gender, bodyMetrics} = req.body;

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({message: 'User not found'});

        if (name !== undefined) user.name = name;
        if (birthDate !== undefined) user.birthDate = birthDate;
        if (gender !== undefined) user.gender = gender;
        if (height !== undefined) user.height = height;

        if (!Array.isArray(user.bodyMetrics)) {
            user.bodyMetrics = [];
        }

        if (bodyMetrics) {
            const m = bodyMetrics[0];
            const newMetrics = {
                weight: m.weight,
                neck: m.neck,
                chest: m.chest,
                waist: m.waist,
                hips: m.hips,
                biceps: m.biceps,
                forearm: m.forearm,
                bmi: m.bmi,
                bodyFat: m.bodyFat,
                subcutaneousFat: m.subcutaneousFat,
                visceralFat: m.visceralFat,
                bodyWater: m.bodyWater,
                muscleMass: m.muscleMass,
                boneMass: m.boneMass,
                bmr: m.bmr,
                metabolicAge: m.metabolicAge,
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
        res.status(500).json({message: err.message});
    }
};

exports.allUsers = async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.userId } });

        const filteredUsers = users.map(user => {
            const lastMetric = user.bodyMetrics?.length > 0
                ? user.bodyMetrics[user.bodyMetrics.length - 1]
                : null;

            return {
                _id: user._id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt,
                bodyMetric: lastMetric
            };
        });

        res.status(200).json(filteredUsers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error. Unable to fetch users.' });
    }
};

exports.logout = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.isOnline = false;
        await user.save();

        res.json({ message: 'Logout successful' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ message: 'Logout failed' });
    }
};

exports.getBodyMetricsHistory = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('bodyMetrics');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const metrics = (user.bodyMetrics || [])
            .slice()
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        res.json(metrics);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};
