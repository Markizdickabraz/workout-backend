const mongoose = require('mongoose');

const aiCommentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    date: { type: String, default: () => {
            const d = new Date();
            return d.toISOString().split('T')[0];
        }}
});

module.exports = mongoose.model('AIComment', aiCommentSchema);
