const express = require('express');
const router = express.Router();
const { loadComments } = require('../data-store');

// GET /api/comments/:articleId — all comments for an article
router.get('/:articleId', (req, res) => {
  const comments = loadComments();
  const articleComments = comments
    .filter(c => c.articleId === req.params.articleId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json(articleComments);
});

module.exports = router;
