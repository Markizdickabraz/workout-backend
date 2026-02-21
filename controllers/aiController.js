const axios = require('axios');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Workout = require('../models/Workout');
const AIComment = require('../models/AIComment');
const Meal = require('../models/Meal');
const Goal = require('../models/Goal');
const Cardio = require('../models/Cardio');
const { estimateMacros } = require('../services/macroEstimator');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODELNAME = process.env.MODEL_NAME || 'meta-llama/llama-3.3-70b-instruct';
const MAX_RETRIES = 3;

// ─── Helper: sleep ────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Shared AI call (with retry on 429) ──────────────────────────
async function callAI(promptText) {
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const { data } = await axios.post(
                OPENROUTER_URL,
                {
                    model: MODELNAME,
                    messages: [{ role: 'user', content: promptText }],
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 60000,
                }
            );
            return data?.choices?.[0]?.message?.content || 'Не вдалося отримати відповідь від AI.';
        } catch (err) {
            lastError = err;
            const status = err.response?.status;
            const body = err.response?.data;

            console.error(`[callAI] attempt ${attempt}/${MAX_RETRIES} failed — status ${status}`, body || err.message);

            if (status === 429 && attempt < MAX_RETRIES) {
                // Use Retry-After header if present, otherwise exponential backoff
                const retryAfter = parseInt(err.response?.headers?.['retry-after'], 10);
                const delayMs = retryAfter ? retryAfter * 1000 : attempt * 5000;
                console.log(`[callAI] rate-limited, retrying in ${delayMs}ms...`);
                await sleep(delayMs);
                continue;
            }

            // For non-429 errors or last attempt, throw with enriched info
            const enriched = new Error(
                status === 429
                    ? 'AI сервіс перевантажений (rate limit). Спробуйте через хвилину.'
                    : `OpenRouter error ${status || ''}: ${body?.error?.message || err.message}`
            );
            enriched.status = status || 500;
            throw enriched;
        }
    }
}

// ─── Shared data fetchers ─────────────────────────────────────────
async function fetchUserContext(userId, user) {
    const [goal, workouts, meals, comments, cardioSessions] = await Promise.all([
        Goal.findOne({ userId }),
        Workout.find({ userId }).sort({ date: -1 }).limit(100),
        Meal.find({ userId }).sort({ date: -1 }).limit(100),
        Comment.find({ userId }).limit(10).sort({ createdAt: -1 }),
        Cardio.find({ userId }).sort({ date: -1 }).limit(50),
    ]);

    const bodyMetrics = (user.bodyMetrics || [])
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 20);

    return { goal, workouts, meals, comments, bodyMetrics, cardioSessions };
}

// ─── Daily auto-generate prompt ───────────────────────────────────
function buildDailyPrompt(user, { goal, workouts, meals, comments, bodyMetrics, cardioSessions }) {
    const macros = goal ? estimateMacros(user, goal) : null;
    const goalInfo = goal ? buildGoalInfo(goal, macros) : 'Цілі не встановлені.';
    const workoutInfo = buildWorkoutInfo(workouts);
    const cardioInfo = buildCardioInfo(cardioSessions);
    const mealInfo = buildMealInfo(meals);
    const bodyInfo = buildBodyInfo(bodyMetrics, user);

    const commentsInfo = comments.length
        ? comments.map(c => `- ${c.text}`).join('\n')
        : 'Немає коментарів.';

    return `
Ти — професійний фітнес-консультант. Відповідай Українською мовою.

👤 Користувач: ${user.name}
Дата народження: ${user.birthDate || 'N/A'}
Зріст: ${user.height || 'N/A'} см

🎯 ЦІЛІ:
${goalInfo}

${workoutInfo}
${cardioInfo}
${mealInfo}
${bodyInfo}

💬 Останні коментарі:
${commentsInfo}

Інструкції:
- Напиши пораду на день та прогноз на наступне тренування
- Порівняй прогрес з цілями
- Враховуй кардіо-навантаження при аналізі
- Будь мотивуючим, але реалістичним
- Суворо 2 блоки, по 300 символів максимум кожен
- Формат: ## Порада на день\n<текст>\n## Прогноз на тренування\n<текст>
- Без емодзі в тексті
`;
}

// ─── Consultant prompt ────────────────────────────────────────────
function buildConsultPrompt(user, context, question, { goal, workouts, meals, bodyMetrics, cardioSessions }) {
    const macros = goal ? estimateMacros(user, goal) : null;
    const goalInfo = goal ? buildGoalInfo(goal, macros) : 'Цілі не встановлені.';

    let contextData = '';
    if (context === 'workouts' || context === 'general') {
        contextData += buildWorkoutInfo(workouts);
        contextData += buildCardioInfo(cardioSessions);
    }
    if (context === 'cardio' || context === 'general') {
        if (context === 'cardio') {
            contextData += buildCardioInfo(cardioSessions);
        }
    }
    if (context === 'meals' || context === 'general') {
        contextData += buildMealInfo(meals);
    }
    if (context === 'body' || context === 'general') {
        contextData += buildBodyInfo(bodyMetrics, user);
    }

    const contextLabels = {
        workouts: 'тренувань',
        cardio: 'кардіо-тренувань',
        meals: 'харчування',
        body: 'метрик тіла',
        general: 'загальний (тренування + кардіо + харчування + тіло)',
    };

    return `
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
}

// ─── Endpoints ────────────────────────────────────────────────────

/** POST /api/ai/ask — daily AI advice (manual trigger) */
exports.processAIRequest = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId).select('-password');
        if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

        const ctx = await fetchUserContext(userId, user);
        const prompt = buildDailyPrompt(user, ctx);
        const aiResponse = await callAI(prompt);

        // Save as AIComment
        await AIComment.create({
            userId,
            text: aiResponse,
            date: new Date().toISOString().slice(0, 10),
        });

        res.json({ result: aiResponse, _debug: { prompt } });
    } catch (err) {
        console.error('AI request error:', err.message);
        const status = err.status || 500;
        res.status(status).json({ message: 'AI request failed', error: err.message });
    }
};

/** POST /api/ai/consult — contextual AI consultant */
exports.consultAI = async (req, res) => {
    try {
        const userId = req.userId;
        const { context = 'general', question } = req.body;

        const validContexts = ['workouts', 'cardio', 'meals', 'body', 'general'];
        if (!validContexts.includes(context)) {
            return res.status(400).json({ message: `Невірний контекст. Допустимі: ${validContexts.join(', ')}` });
        }

        const user = await User.findById(userId).select('-password');
        if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

        const ctx = await fetchUserContext(userId, user);
        const prompt = buildConsultPrompt(user, context, question, ctx);
        const result = await callAI(prompt);

        res.json({ result, _debug: { prompt } });
    } catch (err) {
        console.error('AI consult error:', err.message);
        const status = err.status || 500;
        res.status(status).json({ message: 'AI consultation failed', error: err.message });
    }
};

/** POST /api/ai/meal-advice — smart "what to eat" recommendation */
exports.mealAdvice = async (req, res) => {
    try {
        const userId = req.userId;
        const { date } = req.body; // date for which we need advice (today or tomorrow)
        const targetDate = date || new Date().toISOString().slice(0, 10);

        const user = await User.findById(userId).select('-password');
        if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

        const goal = await Goal.findOne({ userId });

        // Meals for the target day
        const todayMeals = await Meal.find({ userId, date: targetDate });

        // Meals for the last 7 days (for weekly trends)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().slice(0, 10);
        const weekMeals = await Meal.find({
            userId,
            date: { $gte: weekAgoStr, $lte: targetDate },
        }).sort({ date: -1 });

        // Calculate today's totals
        const todayTotals = todayMeals.reduce((acc, m) => ({
            calories: acc.calories + (m.calories || 0),
            protein: acc.protein + (m.protein || 0),
            fats: acc.fats + (m.fats || 0),
            carbs: acc.carbs + (m.carbs || 0),
            count: acc.count + 1,
        }), { calories: 0, protein: 0, fats: 0, carbs: 0, count: 0 });

        // Calculate weekly daily averages
        const weekDailyMap = {};
        weekMeals.forEach(m => {
            if (!weekDailyMap[m.date]) weekDailyMap[m.date] = { cal: 0, prot: 0, fats: 0, carbs: 0 };
            weekDailyMap[m.date].cal += m.calories || 0;
            weekDailyMap[m.date].prot += m.protein || 0;
            weekDailyMap[m.date].fats += m.fats || 0;
            weekDailyMap[m.date].carbs += m.carbs || 0;
        });
        const weekDays = Object.values(weekDailyMap);
        const weekDayCount = weekDays.length || 1;
        const weekAvg = {
            cal: Math.round(weekDays.reduce((s, d) => s + d.cal, 0) / weekDayCount),
            prot: Math.round(weekDays.reduce((s, d) => s + d.prot, 0) / weekDayCount),
            fats: Math.round(weekDays.reduce((s, d) => s + d.fats, 0) / weekDayCount),
            carbs: Math.round(weekDays.reduce((s, d) => s + d.carbs, 0) / weekDayCount),
        };

        // Smart macro estimation from real data (no hardcoded defaults)
        const macros = estimateMacros(user, goal);
        console.log('[mealAdvice] estimateMacros:', JSON.stringify(macros));

        const targetCal  = macros.calories;
        const targetProt = macros.protein;
        const targetFats = macros.fats  || null;
        const targetCarbs = macros.carbs || null;

        // Build goal info using live macros
        const goalLines = [];
        if (goal) {
            if (targetCal)  goalLines.push(`Ціль калорій на день: ${targetCal} ккал (${macros.goalDirection === 'cut' ? 'сушка' : macros.goalDirection === 'gain' ? 'набір' : 'підтримка'})`);
            if (targetProt) goalLines.push(`Ціль білка на день: ${targetProt} г`);
            if (goal.targetWeight) goalLines.push(`Цільова вага: ${goal.targetWeight} кг`);
            if (goal.targetBodyFat) goalLines.push(`Цільовий жир: ${goal.targetBodyFat}%`);
            if (goal.targetMuscleMass) goalLines.push(`Цільова м'язова маса: ${goal.targetMuscleMass} кг`);
            if (goal.notes) goalLines.push(`Нотатки: ${goal.notes}`);
        }
        const goalInfo = goalLines.length ? goalLines.join('\n') : 'Цілі КБЖВ не встановлені.';

        const remaining = targetCal ? {
            calories: Math.max(0, targetCal - todayTotals.calories),
            protein: Math.max(0, (targetProt || 0) - todayTotals.protein),
            fats: Math.max(0, (targetFats || 0) - todayTotals.fats),
            carbs: Math.max(0, (targetCarbs || 0) - todayTotals.carbs),
        } : null;

        // Build macro section for prompt — honest about what we have
        let macroSection;
        if (macros.method === 'no_data') {
            macroSection = `📊 ЦІЛЬОВІ МАКРОСИ: Недостатньо даних для точного розрахунку (немає поточної ваги в метриках тіла).
Користувач ще не вніс заміри тіла. Оціни самостійно розумну норму КБЖВ на основі зросту (${user.height || 'невідомо'} см) та цілей.`;
        } else {
            const methodLabel = {
                'explicit_goal':    'встановлені вручну',
                'cut_measured':     'сушка, BMR з вимірювань',
                'cut_mifflin':      'сушка, формула Міффліна',
                'cut_weight_only':  'сушка, лише по вазі',
                'gain_measured':    'набір маси, BMR з вимірювань',
                'gain_mifflin':     'набір маси, формула Міффліна',
                'gain_weight_only': 'набір маси, лише по вазі',
                'maintain_measured':  'підтримка, BMR з вимірювань',
                'maintain_mifflin':   'підтримка, формула Міффліна',
                'maintain_weight_only': 'підтримка, лише по вазі',
                // legacy keys
                'lose_measured':    'дефіцит, BMR з вимірювань',
                'lose_mifflin':     'дефіцит, формула Міффліна',
                'lose_weight_only': 'дефіцит, лише по вазі',
            }[macros.method] || macros.method;
            macroSection = `📊 ЦІЛЬОВІ МАКРОСИ НА ДЕНЬ (${methodLabel}):
Калорії: ${targetCal} ккал, Білки: ${targetProt}г, Жири: ${targetFats}г, Вуглеводи: ${targetCarbs}г`;
        }

        const remainingSection = remaining
            ? `⏳ ЗАЛИШИЛОСЬ ДО ЦІЛІ:\nКалорії: ${remaining.calories} ккал, Білки: ${Math.round(remaining.protein)}г, Жири: ${Math.round(remaining.fats)}г, Вуглеводи: ${Math.round(remaining.carbs)}г`
            : `⏳ ЗАЛИШИЛОСЬ ДО ЦІЛІ: розрахуй самостійно на основі цілей і вже з'їденого.`;

        // Today's meals list
        const todayMealsList = todayMeals.length
            ? todayMeals.map(m => `- ${m.name}: ${m.calories} ккал, Б:${m.protein}г, Ж:${m.fats}г, В:${m.carbs}г`).join('\n')
            : 'Ще нічого не з\'їдено.';

        const prompt = `
Ти — професійний нутріціолог та дієтолог. Відповідай Українською мовою.

📅 Дата: ${targetDate}
👤 Користувач: ${user.name}
Зріст: ${user.height || 'невідомо'} см, Стать: ${user.gender === 'female' ? 'жінка' : 'чоловік'}
Тип роботи: ${{ desk: 'Сидяча (офіс)', standing: 'Стояча/рухлива', physical: 'Важка фізична праця' }[user.jobType] || 'Сидяча'}
Тренувань на тиждень: ${user.workoutsPerWeek ?? 3}
Ходьба/кроки: ${{ low: 'Мало (<5 000 кроків)', medium: 'Помірно (5 000–10 000 кроків)', high: 'Активно (10 000+ кроків)' }[user.dailyActivity] || 'Помірно'}
Множник активності: ×${macros.activityMultiplier || 1.55}
${macros.leanMass ? `М'язова маса (суха): ${macros.leanMass} кг\n` : ''}${macros.tdee ? `TDEE (добова потреба): ${macros.tdee} ккал\n` : ''}Ціль: ${macros.goalDirection === 'cut' ? '🔥 СУШКА (спалювання жиру зі збереженням м\'язів)' : macros.goalDirection === 'gain' ? '📈 НАБІР М\'ЯЗОВОЇ МАСИ' : '⚖️ ПІДТРИМКА ФОРМИ'}

🎯 ЦІЛІ:
${goalInfo}

${macroSection}

🍽️ ЩО ВЖЕ З'ЇДЕНО СЬОГОДНІ (${todayTotals.count} прийомів):
${todayMealsList}
Разом: ${todayTotals.calories} ккал, Б:${Math.round(todayTotals.protein)}г, Ж:${Math.round(todayTotals.fats)}г, В:${Math.round(todayTotals.carbs)}г

${remainingSection}

📈 СЕРЕДНЄ ЗА ОСТАННІЙ ТИЖДЕНЬ (${weekDayCount} днів):
${weekAvg.cal} ккал/день, Б:${weekAvg.prot}г, Ж:${weekAvg.fats}г, В:${weekAvg.carbs}г

Інструкції:
- Порахуй скільки ще потрібно з'їсти для закриття КБЖВ на день з урахуванням встановлених цілей
- Порекомендуй 2-3 конкретні прийоми їжі (назва страви + приблизні КБЖВ) для закриття денної норми
- ${macros.goalDirection === 'cut' ? 'Акцент на білок для збереження м\'язів під час сушки! Рекомендуй нежирні білкові страви.' : 'Враховуй баланс макросів.'}
- Якщо калораж вже перевищено — попередь і дай поради
- Порівняй з тижневим середнім — чи є тренди переїдання/недоїдання
- Будь конкретним і практичним
- Відповідь максимум 800 символів
- Формат: ## Залишок на день\\n<що ще можна з'їсти>\\n## Рекомендовані прийоми\\n<конкретні страви>\\n## Тижневий тренд\\n<короткий аналіз>
- Без емодзі в тексті (тільки перед заголовками)
`;

        const result = await callAI(prompt);
        res.json({
            result,
            remaining,
            todayTotals,
            weekAvg,
            targetMacros: {
                calories: targetCal,
                protein: targetProt,
                fats: targetFats,
                carbs: targetCarbs,
                method: macros.method,
            },
            _debug: { prompt, macrosMethod: macros.method },
        });
    } catch (err) {
        console.error('AI meal-advice error:', err.message);
        const status = err.status || 500;
        res.status(status).json({ message: 'AI meal advice failed', error: err.message });
    }
};

/** GET /api/ai/ — all AI comments for user */
exports.getAIComment = async (req, res) => {
    try {
        const comments = await AIComment.find({ userId: req.userId }).sort({ date: -1 });
        res.json(comments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** GET /api/ai/by-date?date=YYYY-MM-DD */
exports.getAICommentByDate = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ message: 'Не передано дату' });

        const comments = await AIComment.find({ userId: req.userId, date });
        res.json(comments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ─── Data builders ────────────────────────────────────────────────

function buildGoalInfo(goal, macros) {
    const lines = [];
    if (goal.targetWeight) lines.push(`Цільова вага: ${goal.targetWeight} кг`);
    if (goal.targetBodyFat) lines.push(`Цільовий жир: ${goal.targetBodyFat}%`);
    if (goal.targetMuscleMass) lines.push(`Цільова м'язова маса: ${goal.targetMuscleMass} кг`);
    if (goal.targetBmi) lines.push(`Цільовий BMI: ${goal.targetBmi}`);
    // Use live-calculated macros if available, fall back to user-set values
    const cal  = (macros && macros.calories) || goal.targetCaloriesPerDay;
    const prot = (macros && macros.protein)  || goal.targetProteinPerDay;
    if (cal)  lines.push(`Калорії на день: ${cal} ккал${macros ? ` (${macros.goalDirection === 'cut' ? 'сушка' : macros.goalDirection === 'gain' ? 'набір' : 'підтримка'})` : ''}`);
    if (prot) lines.push(`Білок на день: ${prot} г`);
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
        const weights = list.map(w => w.weight).filter(w => w != null);
        const maxW = weights.length ? Math.max(...weights) : 0;
        const lastW = list[0]?.weight ?? 0;
        const totalVol = list.reduce((s, w) => s + (w.weight || 0) * (w.reps || 0) * (w.sets || 0), 0);
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

    const sortedDates = Object.entries(dailyMap).sort(([a], [b]) => new Date(b) - new Date(a)).slice(0, 5);
    sortedDates.forEach(([date, d]) => {
        info += `- ${date}: ${Math.round(d.cal)} ккал, Б:${Math.round(d.prot)}г, Ж:${Math.round(d.fats)}г, В:${Math.round(d.carbs)}г\n`;
    });

    return info;
}

function buildBodyInfo(bodyMetrics, user) {
    const jobLabels = {
        desk:     'Сидяча (офіс)',
        standing: 'Стояча/рухлива (офіціант, продавець)',
        physical: 'Важка фізична (будівельник, вантажник)',
    };
    const dailyLabels = {
        low:    'Мало ходьби (<5 000 кроків)',
        medium: 'Помірна ходьба (5 000–10 000 кроків)',
        high:   'Активний день (10 000+ кроків)',
    };

    const jobAdd  = { desk: 0, standing: 0.1, physical: 0.3 }[user.jobType] ?? 0;
    const wAdd    = Math.round(Math.min(Math.max(Number(user.workoutsPerWeek) || 0, 0), 7) * 0.05 * 100) / 100;
    const dAdd    = { low: 0, medium: 0.05, high: 0.1 }[user.dailyActivity] ?? 0.05;
    const mult    = Math.round((1.2 + jobAdd + wAdd + dAdd) * 100) / 100;

    let info = '\n🧬 МЕТРИКИ ТІЛА:\n';
    info += `Зріст: ${user.height || 'N/A'} см, Стать: ${user.gender === 'female' ? 'жінка' : 'чоловік'}, Дата народження: ${user.birthDate || 'N/A'}\n`;
    info += `Тип роботи: ${jobLabels[user.jobType] || 'Сидяча'}\n`;
    info += `Тренувань/тиж: ${user.workoutsPerWeek ?? 3}\n`;
    info += `Ходьба/кроки: ${dailyLabels[user.dailyActivity] || 'Помірна ходьба'}\n`;
    info += `Множник активності: ×${mult} (TDEE = BMR × ${mult})\n`;

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

function buildCardioInfo(cardioSessions) {
    if (!cardioSessions || !cardioSessions.length) return '\n🏃 Кардіо: немає даних.\n';

    const typeLabels = {
        running: 'Біг', cycling: 'Велосипед', swimming: 'Плавання',
        walking: 'Ходьба', rowing: 'Веслування', elliptical: 'Еліптичний',
        stair_climber: 'Сходи', jump_rope: 'Скакалка', hiking: 'Піший туризм', other: 'Інше',
    };

    let info = '\n🏃 КАРДІО-ТРЕНУВАННЯ:\n';
    info += `Всього сесій: ${cardioSessions.length}\n`;

    // Group by type
    const byType = {};
    let totalDuration = 0;
    let totalDistance = 0;
    let totalCalories = 0;
    const hrValues = [];

    cardioSessions.forEach(s => {
        const t = s.type || 'other';
        if (!byType[t]) byType[t] = { count: 0, duration: 0, distance: 0, calories: 0 };
        byType[t].count += 1;
        byType[t].duration += s.duration || 0;
        byType[t].distance += s.distance || 0;
        byType[t].calories += s.calories || 0;
        totalDuration += s.duration || 0;
        totalDistance += s.distance || 0;
        totalCalories += s.calories || 0;
        if (s.avgHeartRate) hrValues.push(s.avgHeartRate);
    });

    info += `Загальна тривалість: ${Math.floor(totalDuration / 60)}г ${totalDuration % 60}хв\n`;
    info += `Загальна відстань: ${totalDistance.toFixed(1)} км\n`;
    info += `Загальні калорії: ${totalCalories} ккал\n`;
    if (hrValues.length) {
        const avgHR = Math.round(hrValues.reduce((s, v) => s + v, 0) / hrValues.length);
        info += `Середній пульс: ${avgHR} уд/хв\n`;
    }

    info += 'По типах:\n';
    Object.entries(byType).forEach(([type, data]) => {
        const label = typeLabels[type] || type;
        info += `- ${label}: ${data.count} разів, ${data.duration} хв, ${data.distance.toFixed(1)} км, ${data.calories} ккал\n`;
    });

    // Last 5 sessions details
    const recent = cardioSessions.slice(0, 5);
    info += 'Останні сесії:\n';
    recent.forEach(s => {
        const label = typeLabels[s.type] || s.customType || s.type;
        let line = `- ${s.date} ${label}: ${s.duration}хв`;
        if (s.distance) line += `, ${s.distance}км`;
        if (s.avgHeartRate) line += `, пульс ${s.avgHeartRate}`;
        if (s.calories) line += `, ${s.calories}ккал`;
        if (s.avgPace) line += `, темп ${s.avgPace}хв/км`;
        info += line + '\n';
    });

    return info;
}