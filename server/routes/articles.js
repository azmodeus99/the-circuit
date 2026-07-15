const express = require('express');
const router = express.Router();
const { loadArticles } = require('../data-store');

// GET /api/articles — all published articles, newest first
router.get('/', (req, res) => {
  const articles = loadArticles();
  articles.sort((a, b) => new Date(b.publishTime) - new Date(a.publishTime));
  res.json(articles);
});

// GET /api/articles/:id — single article
router.get('/:id', (req, res) => {
  const articles = loadArticles();
  const article = articles.find(a => a.id === req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.json(article);
});

module.exports = router;
