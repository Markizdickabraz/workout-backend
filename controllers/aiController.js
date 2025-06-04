require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const cron = require('node-cron');

const User = require('../models/User');
const Comment = require('../models/Comment');
const Workouts = require('../models/Workout');
const AIComment = require('../models/AIComment');

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

async function generateAIResponse(user, prompt = '') {
    let lastBodyMetrics = [];

    if (Array.isArray(user.bodyMetrics)) {
        lastBodyMetrics = user.bodyMetrics
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
    }

    const comments = await Comment.find({ userId: user._id }).limit(10).sort({ createdAt: -1 });
    const workouts = await Workouts.find({ userId: user._id });

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

    const additionalPrompt = `аналізуючи мої коментарі, вагу та вправи, напиши пораду на день, та зроби прогноз на наступне тренування, відповідь присилай Українською мовою, трохи мотивації, суворо в 2 блока "Порада на день" та "Прогноз на тренування" по 300 символів максимум. формат тексту має бути наступним: "Порада на день": "текст поради" ## Прогноз на тренування: "текст прогнозу" без будь-яких додаткових пояснень, тільки текст в лапках, без емодзі та інших символів, тільки текст."`;

    const fullPrompt = `
${userInfo}

💬 Recent Comments:
${commentsInfo}

🏋️‍♂️ Recent Workouts:
${workoutsInfo}

${prompt}

${additionalPrompt}
`;

    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    });

    return response?.text || 'No response from AI.';
}


exports.processAIRequest = async (req, res) => {
    try {
        const userId = req.userId;
        const { prompt } = req.body;

        const user = await User.findById(userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const aiResponse = await generateAIResponse(user, prompt);

        res.json({ result: aiResponse });

        await AIComment.create({
            userId,
            text: aiResponse,
            date: new Date().toISOString().slice(0, 10),
        });

    } catch (err) {
        console.error('Full error:', err);
        res.status(500).json({ message: "AI request failed", error: err.message });
    }
};

exports.getAICommentByDate = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ message: 'Не передано дату' });

        const comments = await AIComment.find({
            userId: req.userId,
            date,
        });

        res.json(comments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getAIComment = async (req, res) => {
    try {
        const comments = await AIComment.find({ userId: req.userId });
        res.json(comments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

async function autoGenerateForAllUsers() {
    try {
        const users = await User.find();

        for (const user of users) {
            const today = new Date().toISOString().slice(0, 10);
            const exists = await AIComment.findOne({ userId: user._id, date: today });
            if (exists) continue;

            const aiResponse = await generateAIResponse(user);

            await AIComment.create({
                userId: user._id,
                text: aiResponse,
                date: today,
            });

        }
    } catch (err) {
        console.error('❌ Error during auto AI generation:', err.message);
    }
}

cron.schedule('0 21 * * 1,2,4,5', () => {
    autoGenerateForAllUsers();
});