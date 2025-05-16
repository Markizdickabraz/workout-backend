const Comment = require('../models/Comment');
const User = require("../models/User");

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
        const { date, text, _id,  } = req.body;
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
        const { text, _id, date } = req.body;
        const user = await Comment.findById(req.params.id);
        if (text !== undefined) user.text = text;
        if (date !== undefined) user.date = date;
        if (_id !== undefined) user._id = _id;

        await user.save();

        res.json({
            text: user.text,
            _id,
            date,
            userId: req.userId,
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update comment' });
    }
}