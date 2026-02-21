const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const workoutRoutes = require('./routes/workoutRoutes');
const commentRoutes = require('./routes/commentRoutes');
const aiRoutes = require('./routes/aiRoutes');
const userRoutes = require('./routes/userRoutes');
const newsRoutes = require('./routes/newsRoutes');
const mealRoutes = require('./routes/mealRoutes');
const goalRoutes = require('./routes/goalRoutes');
const cardioRoutes = require('./routes/cardioRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/user', userRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/cardio', cardioRoutes);

module.exports = app;

