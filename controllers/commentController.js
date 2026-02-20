const Comment = require('../models/Comment');

exports.getComment = async (req, res) => {
    try {
        const comments = await Comment.find({ userId: req.userId });
        res.json(comments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getCommentByDate = async (req, res) => {
    try {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ message: 'Не передано дату' });
        }

        const comments = await Comment.find({
            userId: req.userId,
            date: date,
        });

        res.json(comments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.addComment = async (req, res) => {
    try {
        const { date, text, _id } = req.body;
        const comment = await Comment.create({ userId: req.userId, date, text, _id });
        res.status(201).json(comment);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.deleteComment = async (req, res) => {
    try {
        const { id } = req.params;
        await Comment.deleteOne({ _id: id, userId: req.userId });
        res.json({ message: 'Comment deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateComment = async (req, res) => {
    try {
        const { text, date } = req.body;
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        if (comment.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        if (text !== undefined) comment.text = text;
        if (date !== undefined) comment.date = date;

        await comment.save();

        res.json(comment);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update comment' });
    }
}