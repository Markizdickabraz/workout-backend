const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const workoutRoutes = require('./routes/workoutRoutes');
const commentRoutes = require('./routes/commentRoutes');
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/comments', commentRoutes);

module.exports = app;
