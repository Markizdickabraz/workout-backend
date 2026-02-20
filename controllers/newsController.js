const News = require('../models/News');
const User = require('../models/User');

exports.getNews = async (req, res) => {
    try {
        const { sort, myNews } = req.query;
        const query = {};

        if (myNews === 'true' && req.userId) {
            query.userId = req.userId;
        }

        const sortOrder = sort === 'asc' ? 1 : -1;

        const newsList = await News.find(query)
            .sort({ createdAt: sortOrder })
            .lean();

        res.status(200).json(newsList);
    } catch (error) {
        console.error('Помилка отримання новин:', error);
        res.status(500).json({ message: 'Не вдалося отримати новини' });
    }
};

// TODO add to front

exports.getNewsByDate = async (req, res) => {
    try {
        const { date } = req.params;

        const news = await News.findOne({ date }).lean();
        if (!news) {
            return res.status(404).json({ message: 'Новину не знайдено' });
        }

        res.status(200).json(news);
    } catch (error) {
        console.error('Помилка пошуку новини:', error);
        res.status(500).json({ message: 'Помилка при отриманні новини' });
    }
};

exports.addNews = async (req, res) => {
    try {
        const { title, text, date } = req.body;

        if (!title || !text || !date) {
            return res.status(400).json({ message: 'Усі поля обов’язкові' });
        }

        if (!req.userId) {
            return res.status(401).json({ message: 'Не авторизований' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Користувача не знайдено' });
        }

        const author = `${user.name}`;

        const newNews = new News({
            title,
            text,
            date,
            author,
            userId: req.userId,
        });

        await newNews.save();

        res.status(201).json({ message: 'Новину успішно додано', news: newNews });
    } catch (error) {
        console.error('Помилка додавання новини:', error);
        res.status(500).json({ message: 'Не вдалося додати новину' });
    }
};

// TODO add to front

exports.updateNews = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, text, date } = req.body;

        const news = await News.findById(id);
        if (!news) {
            return res.status(404).json({ message: 'Новину не знайдено' });
        }

        if (news.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Немає доступу' });
        }

        if (title) news.title = title;
        if (text) news.text = text;
        if (date) news.date = date;

        await news.save();
        res.status(200).json({ message: 'Новину оновлено', news });
    } catch (error) {
        console.error('Помилка оновлення новини:', error);
        res.status(500).json({ message: 'Не вдалося оновити новину' });
    }
};

exports.deleteNews = async (req, res) => {
    try {
        const { id } = req.params;

        const news = await News.findById(id);
        if (!news) {
            return res.status(404).json({ message: 'Новину не знайдено' });
        }

        if (news.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Немає прав для видалення' });
        }

        await news.deleteOne();

        res.status(200).json({ message: 'Новину видалено' });
    } catch (error) {
        console.error('Помилка видалення новини:', error);
        res.status(500).json({ message: 'Не вдалося видалити новину' });
    }
};

