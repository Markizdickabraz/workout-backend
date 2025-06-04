require('dotenv').config();
const {GoogleGenAI} = require('@google/genai');

const User = require('../models/User');
const Comment = require('../models/Comment');
const Workouts = require('../models/Workout');
const AIComment = require('../models/AIComment');

const ai = new GoogleGenAI({apiKey: process.env.GOOGLE_API_KEY});

exports.processAIRequest = async (req, res) => {
    try {
        const userId = req.userId;
        const {prompt} = req.body;

        const user = await User.findById(userId).select('-password');
        if (!user) return res.status(404).json({message: 'User not found'});

        let lastBodyMetrics = [];
        if (Array.isArray(user.bodyMetrics)) {
            lastBodyMetrics = user.bodyMetrics
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 5);
        }

        const comments = await Comment.find({userId: req.userId}).limit(10).sort({createdAt: -1});
        const workouts = await Workouts.find({userId: req.userId});

        const bodyMetricsInfo = lastBodyMetrics.length
            ? lastBodyMetrics.map(m => `- Date: ${m.date || 'N/A'}, Weight: ${m.weight || 'N/A'}, Height: ${m.height || 'N/A'}`).join('\n')
            : 'No body metrics.';

        const userInfo = `
👤 User Info:
Name: ${user.name}
Birth Date: ${user.birthDate || 'N/A'}
Height: ${user.height || 'N/A'}
📊 Last Body Metrics (up to 5):
${bodyMetricsInfo}
        `;

        const commentsInfo = comments.length
            ? comments.map(c => `- ${c.text}`).join('\n')
            : 'No comments.';

        const workoutsInfo = workouts.length
            ? workouts.map(w => `- ${w.name || w.type || 'Workout'} on ${w.date || 'N/A'}`).join('\n')
            : 'No workouts.';
        const userPrompt = prompt || '';
        const additionalPrompt = `аналізуючи мої коментарі, вагу та вправи, напиши пораду на день, та зроби прогноз на наступне тренування, відповідь присилай Українською мовою, трохи мотивації, в 2 блока "Порада на день" та "Прогноз на тренування" по 300 символів максимум`;

        const fullPrompt = `
${userInfo}

💬 Recent Comments:
${commentsInfo}

🏋️‍♂️ Recent Workouts:
${workoutsInfo}

${userPrompt}

${additionalPrompt}
`;


        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{role: 'user', parts: [{text: fullPrompt}]}],
        });

        const aiResponse = response?.text || 'No response from AI.';
        res.json({result: aiResponse});


        await AIComment.create({
            userId: req.userId,
            text: aiResponse,
        });

    } catch (err) {
        console.error('Full error:', err);
        res.status(500).json({message: "AI request failed", error: err.message});
    }
};


exports.getAICommentByDate = async (req, res) => {
    try {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ message: 'Не передано дату' });
        }

        const aicomments = await AIComment.find({
            userId: req.userId,
            date: date,
        });

        res.json(aicomments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getAIComment = async (req, res) => {
    try {
        const aicomments = await AIComment.find({ userId: req.userId });
        res.json(aicomments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};