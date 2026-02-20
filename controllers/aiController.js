require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const cron = require('node-cron');

const User = require('../models/User');
const Comment = require('../models/Comment');
const Workouts = require('../models/Workout');
const AIComment = require('../models/AIComment');
const Meal = require('../models/Meal');
const Goal = require('../models/Goal');

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

// --- AI Consultant endpoint ---
exports.consultAI = async (req, res) => {
    try {
        const userId = req.userId;
        const { context, question } = req.body;
        // context: 'workouts' | 'meals' | 'body' | 'general'

        const user = await User.findById(userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Fetch goal
        const goal = await Goal.findOne({ userId });
        const goalInfo = goal ? buildGoalInfo(goal) : 'Цілі не встановлені.';

        // Build context-specific data
        let contextData = '';

        if (context === 'workouts' || context === 'general') {
            const workouts = await Workouts.find({ userId }).sort({ date: -1 }).limit(100);
            contextData += buildWorkoutInfo(workouts);
        }

        if (context === 'meals' || context === 'general') {
            const meals = await Meal.find({ userId }).sort({ date: -1 }).limit(100);
            contextData += buildMealInfo(meals);
        }

        if (context === 'body' || context === 'general') {
            const bodyMetrics = (user.bodyMetrics || [])
                .slice()
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 20);
            contextData += buildBodyInfo(bodyMetrics, user);
        }

        const contextLabels = {
            workouts: 'тренувань',
            meals: 'харчування',
            body: 'метрик тіла',
            general: 'загальний (тренування + харчування + тіло)',
        };

        const systemPrompt = `
Ти — професійний фітнес-консультант та нутріціолог. Відповідай Українською мовою.
Аналізуй надані дані та давай конкретні, практичні поради.

📎 КОНТЕКСТ АНАЛІТИКИ: ${contextLabels[context] || 'загальний'}

🎯 ЦІЛІ КОРИСТУВАЧА:
${goalInfo}

📊 ДАНІ:
${contextData}

${question ? `💬 ДОДАТКОВЕ ПИТАННЯ КОРИСТУВАЧА: ${question}` : ''}

Інструкції:
- Дай аналіз поточного стану на основі даних
- Порівняй прогрес з цілями користувача
- Дай 3-5 конкретних рекомендацій
- Якщо є тренди (покращення/погіршення), вкажи їх
- Будь мотивуючим, але реалістичним
- Відповідь максимум 800 символів
- Формат: використовуй ## для заголовків секцій
- Без емодзі в тексті (тільки перед заголовками)
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        });

        const result = response?.text || 'Не вдалося отримати відповідь від AI.';
        res.json({ result });

    } catch (err) {
        console.error('AI consult error:', err);
        res.status(500).json({ message: 'AI consultation failed', error: err.message });
    }
};

function buildGoalInfo(goal) {
    const lines = [];
    if (goal.targetWeight) lines.push(`Цільова вага: ${goal.targetWeight} кг`);
    if (goal.targetBodyFat) lines.push(`Цільовий жир: ${goal.targetBodyFat}%`);
    if (goal.targetMuscleMass) lines.push(`Цільова м'язова маса: ${goal.targetMuscleMass} кг`);
    if (goal.targetBmi) lines.push(`Цільовий BMI: ${goal.targetBmi}`);
    if (goal.targetCaloriesPerDay) lines.push(`Калорії на день: ${goal.targetCaloriesPerDay} ккал`);
    if (goal.targetProteinPerDay) lines.push(`Білок на день: ${goal.targetProteinPerDay} г`);
    if (goal.targetWaterPerDay) lines.push(`Вода на день: ${goal.targetWaterPerDay} л`);
    if (goal.targetWorkoutsPerWeek) lines.push(`Тренувань на тиждень: ${goal.targetWorkoutsPerWeek}`);
    if (goal.targetDate) lines.push(`Дедлайн: ${new Date(goal.targetDate).toLocaleDateString('uk-UA')}`);
    if (goal.notes) lines.push(`Нотатки: ${goal.notes}`);
    if (goal.customGoals?.length) {
        goal.customGoals.forEach(cg => {
            lines.push(`Власна ціль "${cg.label}": поточне ${cg.currentValue ?? '—'} → ціль ${cg.targetValue ?? '—'} ${cg.unit || ''}`);
        });
    }
    return lines.length ? lines.join('\n') : 'Цілі не встановлені.';
}

function buildWorkoutInfo(workouts) {
    if (!workouts.length) return '\n🏋️ Тренування: немає даних.\n';

    const grouped = {};
    workouts.forEach(w => {
        if (!grouped[w.name]) grouped[w.name] = [];
        grouped[w.name].push(w);
    });

    let info = '\n🏋️ ТРЕНУВАННЯ:\n';
    info += `Всього записів: ${workouts.length}, унікальних вправ: ${Object.keys(grouped).length}\n`;

    const uniqueDays = new Set(workouts.map(w => w.date)).size;
    info += `Днів тренувань: ${uniqueDays}\n`;

    Object.entries(grouped).slice(0, 10).forEach(([name, list]) => {
        const weights = list.map(w => w.weight);
        const maxW = Math.max(...weights);
        const lastW = list[0].weight;
        const totalVol = list.reduce((s, w) => s + w.weight * w.reps * w.sets, 0);
        info += `- ${name}: макс ${maxW}кг, остання ${lastW}кг, об'єм ${totalVol}кг, ${list.length} разів\n`;
    });

    return info;
}

function buildMealInfo(meals) {
    if (!meals.length) return '\n🍽️ Харчування: немає даних.\n';

    const dailyMap = {};
    meals.forEach(m => {
        if (!dailyMap[m.date]) dailyMap[m.date] = { cal: 0, prot: 0, fats: 0, carbs: 0, count: 0 };
        dailyMap[m.date].cal += m.calories || 0;
        dailyMap[m.date].prot += m.protein || 0;
        dailyMap[m.date].fats += m.fats || 0;
        dailyMap[m.date].carbs += m.carbs || 0;
        dailyMap[m.date].count += 1;
    });

    const days = Object.values(dailyMap);
    const avgCal = Math.round(days.reduce((s, d) => s + d.cal, 0) / days.length);
    const avgProt = Math.round(days.reduce((s, d) => s + d.prot, 0) / days.length);
    const avgFats = Math.round(days.reduce((s, d) => s + d.fats, 0) / days.length);
    const avgCarbs = Math.round(days.reduce((s, d) => s + d.carbs, 0) / days.length);

    let info = '\n🍽️ ХАРЧУВАННЯ:\n';
    info += `Всього записів: ${meals.length}, днів: ${days.length}\n`;
    info += `Середнє на день: ${avgCal} ккал, Б: ${avgProt}г, Ж: ${avgFats}г, В: ${avgCarbs}г\n`;

    // Last 5 days
    const sortedDates = Object.entries(dailyMap).sort(([a], [b]) => new Date(b) - new Date(a)).slice(0, 5);
    sortedDates.forEach(([date, d]) => {
        info += `- ${date}: ${Math.round(d.cal)} ккал, Б:${Math.round(d.prot)}г, Ж:${Math.round(d.fats)}г, В:${Math.round(d.carbs)}г\n`;
    });

    return info;
}

function buildBodyInfo(bodyMetrics, user) {
    let info = '\n🧬 МЕТРИКИ ТІЛА:\n';
    info += `Зріст: ${user.height || 'N/A'} см, Дата народження: ${user.birthDate || 'N/A'}\n`;

    if (!bodyMetrics.length) {
        info += 'Немає замірів.\n';
        return info;
    }

    const latest = bodyMetrics[0];
    const fields = [
        ['Вага', 'weight', 'кг'], ['BMI', 'bmi', ''], ['Жир', 'bodyFat', '%'],
        ['М\'язи', 'muscleMass', 'кг'], ['Вода', 'bodyWater', '%'],
        ['Підшк.жир', 'subcutaneousFat', '%'], ['Вісц.жир', 'visceralFat', ''],
        ['Кістки', 'boneMass', 'кг'], ['Обмін', 'bmr', 'ккал'], ['Мет.вік', 'metabolicAge', ''],
    ];

    info += 'Останні заміри:\n';
    fields.forEach(([label, key, unit]) => {
        if (latest[key] != null) info += `- ${label}: ${latest[key]} ${unit}\n`;
    });

    if (bodyMetrics.length >= 2) {
        const prev = bodyMetrics[1];
        const changes = [];
        fields.forEach(([label, key, unit]) => {
            if (latest[key] != null && prev[key] != null) {
                const diff = Math.round((latest[key] - prev[key]) * 100) / 100;
                if (diff !== 0) changes.push(`${label}: ${diff > 0 ? '+' : ''}${diff} ${unit}`);
            }
        });
        if (changes.length) info += `Зміни: ${changes.join(', ')}\n`;
    }

    return info;
}

cron.schedule('0 21 * * 1,2,4,5', () => {
    autoGenerateForAllUsers();
});