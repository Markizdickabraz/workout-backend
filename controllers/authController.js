const User = require('../models/User');
const Goal = require('../models/Goal');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { estimateMacros } = require('../services/macroEstimator');

const allMetricFields = [
    'weight', 'neck', 'chest', 'waist', 'hips', 'biceps', 'forearm',
    'bmi', 'bodyFat', 'subcutaneousFat', 'visceralFat', 'bodyWater',
    'muscleMass', 'boneMass', 'bmr', 'metabolicAge',
];

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
        const {name, birthDate, height, gender, activityLevel, jobType, workoutsPerWeek, dailyActivity, bodyMetrics} = req.body;

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({message: 'User not found'});

        if (name !== undefined) user.name = name;
        if (birthDate !== undefined) user.birthDate = birthDate;
        if (gender !== undefined) user.gender = gender;
        if (height !== undefined) user.height = height;
        if (activityLevel !== undefined) user.activityLevel = activityLevel;
        if (jobType !== undefined) user.jobType = jobType;
        if (workoutsPerWeek !== undefined) user.workoutsPerWeek = workoutsPerWeek;
        if (dailyActivity !== undefined) user.dailyActivity = dailyActivity;

        if (!Array.isArray(user.bodyMetrics)) {
            user.bodyMetrics = [];
        }

        if (bodyMetrics) {
            const m = bodyMetrics[0];

            // Check if there's anything meaningful to save
            const hasAnyValue = allMetricFields.some(f => m[f] != null && m[f] !== '' && m[f] !== 0);

            if (hasAnyValue) {
                // Merge with previous latest entry so we don't lose fields
                // (e.g. user entered BMR last time but didn't re-enter it now)
                const prevLatest = user.bodyMetrics.length
                    ? user.bodyMetrics[user.bodyMetrics.length - 1]
                    : {};

                const newMetrics = { date: new Date() };
                allMetricFields.forEach(f => {
                    // Use new value if provided, otherwise carry forward from previous
                    const newVal = m[f] != null && m[f] !== '' ? m[f] : undefined;
                    const prevVal = prevLatest[f] != null ? prevLatest[f] : undefined;
                    if (newVal !== undefined) {
                        newMetrics[f] = newVal;
                    } else if (prevVal !== undefined) {
                        newMetrics[f] = prevVal;
                    }
                });

                user.bodyMetrics.push(newMetrics);
            }
        }

        await user.save();
        const last10Metrics = user.bodyMetrics.slice(-10);

        // ── Live-recalculate macro targets after ANY change that affects TDEE ──
        // Triggers: body metrics, jobType, workoutsPerWeek, dailyActivity, height, gender, birthDate
        let macroRecalcResult = null;
        try {
            const goal = await Goal.findOne({ userId: req.userId });
            if (goal) {
                // Use the full saved user document (after .save()) — same data source as goalController
                const freshUser = await User.findById(req.userId)
                    .select('bodyMetrics height gender birthDate jobType workoutsPerWeek dailyActivity')
                    .lean();
                const macros = estimateMacros(freshUser, goal);
                console.log('[authController] macro recalc after profile update:', JSON.stringify(macros));
                if (macros.calories && macros.protein) {
                    macroRecalcResult = {
                        method: macros.method,
                        goalDirection: macros.goalDirection,
                        targetCaloriesPerDay: macros.calories,
                        targetProteinPerDay:  macros.protein,
                        tdee: macros.tdee || null,
                        calorieAdjustment: macros.calorieAdjustment ?? null,
                    };
                }
            }
        } catch (macroErr) {
            console.error('Macro recalc after profile update failed:', macroErr);
        }

        res.json({
            id: req.userId,
            name: user.name,
            birthDate: user.birthDate,
            height: user.height,
            gender: user.gender,
            activityLevel: user.activityLevel,
            jobType: user.jobType,
            workoutsPerWeek: user.workoutsPerWeek,
            dailyActivity: user.dailyActivity,
            bodyMetrics: last10Metrics,
            ...(macroRecalcResult ? { _macroRecalc: macroRecalcResult } : {}),
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
