/**
 * Estimate daily calorie & protein targets from real user data + goals.
 * NEVER treats goal.targetCaloriesPerDay / targetProteinPerDay as authoritative —
 * those may be previously auto-written values. Always recalculates from scratch.
 *
 * Goal direction (priority):
 *   1. Notes/customGoal labels contain cut/сушк/схуд → 'cut'
 *   2. Notes contain набір/gain/маса/bulk            → 'gain'
 *   3. targetBodyFat set (any value) AND no current bodyFat → assume 'cut'
 *      (user set a body-fat goal = they want to reduce fat)
 *   4. currentBodyFat > targetBodyFat                → 'cut'
 *   5. currentBodyFat < targetBodyFat                → 'gain'
 *   6. currentWeight  > targetWeight * 1.03          → 'cut'
 *   7. currentWeight  < targetWeight * 0.97          → 'gain'
 *   8. targetMuscleMass > currentMuscleMass          → 'gain'
 *   9. else → 'maintain'
 *
 * Returns { calories, protein, fats, carbs, method, goalDirection, tdee, leanMass }
 */
function estimateMacros(user, goal) {
    // ── 1. Latest body metrics ────────────────────────────────────
    // Scan through recent entries to find the best available value for each field.
    // This avoids losing data when a profile save created an entry without all fields.
    const sorted = (user.bodyMetrics || [])
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    function findRecent(field) {
        for (const m of sorted) {
            if (m[field] != null && m[field] !== '' && m[field] !== 0) return m[field];
        }
        return null;
    }

    const currentWeight  = findRecent('weight');
    const currentBodyFat = findRecent('bodyFat');
    const measuredBmr    = findRecent('bmr');
    const muscleMass     = findRecent('muscleMass');

    const height = user.height || null;
    const gender = user.gender || 'male';

    let age = null;
    if (user.birthDate) {
        const bd = new Date(user.birthDate);
        if (!isNaN(bd.getTime()))
            age = Math.floor((Date.now() - bd.getTime()) / (365.25 * 24 * 3600 * 1000));
    }

    // ── 2. Lean body mass ────────────────────────────────────────
    let leanMass = null;
    if (currentWeight && currentBodyFat) {
        leanMass = Math.round(currentWeight * (1 - currentBodyFat / 100) * 10) / 10;
    } else if (muscleMass) {
        leanMass = muscleMass;
    }

    // ── 3. Goal direction ─────────────────────────────────────────
    const notesText = (
        (goal?.notes || '') + ' ' +
        (goal?.customGoals || []).map(g => g.label).join(' ')
    ).toLowerCase();

    const isCutIntent  = /сушк|cut|схуд|жир|рельєф|літ|літо|лето/.test(notesText);
    const isGainIntent = /набір|gain|маса|bulk/.test(notesText);

    let goalDirection = 'maintain';

    if (isCutIntent) {
        goalDirection = 'cut';
    } else if (isGainIntent) {
        goalDirection = 'gain';
    } else if (goal?.targetBodyFat) {
        // User set a body fat target — this always means they want to reduce fat
        // Whether or not we have current measurement, treat as cut
        if (!currentBodyFat) {
            goalDirection = 'cut'; // has a BF goal but no current measure → assume cut intent
        } else if (goal.targetBodyFat < currentBodyFat - 0.5) {
            goalDirection = 'cut';
        } else if (goal.targetBodyFat > currentBodyFat + 0.5) {
            goalDirection = 'gain';
        }
    } else if (currentWeight && goal?.targetWeight) {
        if (goal.targetWeight < currentWeight * 0.97)      goalDirection = 'cut';
        else if (goal.targetWeight > currentWeight * 1.03) goalDirection = 'gain';
    } else if (goal?.targetMuscleMass && muscleMass) {
        if (goal.targetMuscleMass > muscleMass * 1.02)     goalDirection = 'gain';
    }

    // ── 4. BMR ───────────────────────────────────────────────────
    let bmr = null;
    let bmrSource = null;

    if (measuredBmr) {
        bmr = measuredBmr;
        bmrSource = 'measured';
    } else if (currentWeight && height && age) {
        bmr = gender === 'female'
            ? 10 * currentWeight + 6.25 * height - 5 * age - 161
            : 10 * currentWeight + 6.25 * height - 5 * age + 5;
        bmrSource = 'mifflin';
    } else if (currentWeight) {
        bmr = currentWeight * 24;
        bmrSource = 'weight_only';
    }

    if (!bmr) {
        return { calories: null, protein: null, fats: null, carbs: null, method: 'no_data', goalDirection };
    }

    // ── 5. TDEE → calorie target ──────────────────────────────────
    // Розраховуємо множник активності з 3 незалежних факторів:
    //
    // [A] Тип роботи (базовий рівень NEAT протягом дня)
    const jobMultipliers = {
        desk:     0.0,   // сидяча робота — нічого не додає
        standing: 0.1,   // стояча / в русі (офіціант, продавець)
        physical: 0.3,   // важка фізична праця (будівництво, вантаж)
    };
    const jobAdd = jobMultipliers[user.jobType] ?? 0.0;

    // [B] Тренування на тиждень
    // 0→0, 1→0.05, 2→0.1, 3→0.15, 4→0.2, 5→0.25, 6→0.3, 7→0.35
    const workouts = Math.min(Math.max(Number(user.workoutsPerWeek) || 0, 0), 7);
    const workoutAdd = Math.round(workouts * 0.05 * 100) / 100;

    // [C] Побутова активність (ходьба, кроки поза тренуваннями)
    const dailyActivityMultipliers = {
        low:    0.0,   // <5 000 кроків, мало ходьби
        medium: 0.05,  // 5 000–10 000 кроків
        high:   0.1,   // 10 000+ кроків, активні вихідні
    };
    const dailyAdd = dailyActivityMultipliers[user.dailyActivity] ?? 0.05;

    // Фінальний множник: базовий 1.2 + всі надбавки
    const activityMultiplier = Math.round((1.2 + jobAdd + workoutAdd + dailyAdd) * 100) / 100;
    const tdee = Math.round(bmr * activityMultiplier);

    // ── 5b. Adaptive deficit/surplus based on gap to goal ─────────
    //
    // Замість фіксованого ±500/±300, враховуємо наскільки далеко від цілі:
    //
    //  CUT:  дефіцит 300–700 ккал залежно від різниці жиру або ваги
    //    bodyFat gap <2% → м'який дефіцит 300
    //    bodyFat gap 2–5% → стандартний 500
    //    bodyFat gap >5% → агресивний 700
    //
    //  GAIN: профіцит 200–400 ккал
    //    weight gap <3кг → lean bulk 200
    //    weight gap 3–8кг → стандартний 300
    //    weight gap >8кг → 400

    let calorieAdjustment;
    if (goalDirection === 'cut') {
        let gap = 3; // default gap if no data to compare
        if (currentBodyFat && goal?.targetBodyFat) {
            gap = currentBodyFat - goal.targetBodyFat;
        } else if (currentWeight && goal?.targetWeight) {
            // map weight gap to approximate fat% gap (rough: 1kg ≈ 0.5% BF for ~85kg person)
            gap = (currentWeight - goal.targetWeight) * 0.5;
        }
        if (gap <= 2)      calorieAdjustment = -300;  // close to goal — gentle cut
        else if (gap <= 5) calorieAdjustment = -500;  // standard cut
        else               calorieAdjustment = -700;  // far from goal — aggressive
        // Safety floor
        calorieAdjustment = Math.max(calorieAdjustment, -(tdee - 1200));
    } else if (goalDirection === 'gain') {
        let gap = 5; // default
        if (currentWeight && goal?.targetWeight) {
            gap = goal.targetWeight - currentWeight;
        }
        if (gap <= 3)      calorieAdjustment = 200;   // lean bulk
        else if (gap <= 8) calorieAdjustment = 300;   // standard
        else               calorieAdjustment = 400;   // aggressive bulk
    } else {
        calorieAdjustment = 0;
    }

    let targetCalories = Math.max(1200, tdee + calorieAdjustment);

    // ── 6. Protein ────────────────────────────────────────────────
    let targetProtein;
    if (goalDirection === 'cut') {
        // Prioritise lean mass for protein; fall back to bodyweight
        targetProtein = leanMass
            ? Math.round(leanMass * 2.4)
            : Math.round((currentWeight || 70) * 2.2);
    } else if (goalDirection === 'gain') {
        targetProtein = Math.round((currentWeight || 70) * 2.0);
    } else {
        targetProtein = Math.round((currentWeight || 70) * 1.8);
    }

    // ── 7. Fats & carbs ───────────────────────────────────────────
    const fatPct      = goalDirection === 'cut' ? 0.28 : 0.25;
    const targetFats  = Math.round(targetCalories * fatPct / 9);
    const targetCarbs = Math.max(0, Math.round((targetCalories - targetProtein * 4 - targetFats * 9) / 4));

    return {
        calories: targetCalories,
        protein:  targetProtein,
        fats:     targetFats,
        carbs:    targetCarbs,
        method:   `${goalDirection}_${bmrSource}`,
        goalDirection,
        tdee,
        leanMass,
        activityMultiplier,
        // breakdown for debugging / UI display
        activityBreakdown: { jobAdd, workoutAdd, dailyAdd, base: 1.2 },
        calorieAdjustment,
    };
}

module.exports = { estimateMacros };
