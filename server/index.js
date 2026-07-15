require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { startScheduler } = require('./scheduler');
const articlesRouter = require('./routes/articles');
const commentsRouter = require('./routes/comments');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/articles', articlesRouter);
app.use('/api/comments', commentsRouter);

// Manual trigger — bypasses time check for testing
app.post('/api/trigger', async (req, res) => {
  try {
    console.log('\n🔁 Manual trigger activated...');
    const { runAutomatedBlog } = require('./blog-engine');
    const { fetchNews } = require('./news-fetcher');

    const scrapedNews = await fetchNews();
    const result = await runAutomatedBlog(
      {
        scrapedNews,
        shareTime: '08:00 AM IST',
        publishTime: new Date()
      },
      true // bypass time check
    );

    res.json({
      success: true,
      articlesPublished: result.publishedArticles.length,
      commentsGenerated: result.generatedComments.length,
      articles: result.publishedArticles
    });
  } catch (err) {
    console.error('Trigger error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Automated AI News Blog`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → POST /api/trigger to run blog cycle manually\n`);
  startScheduler();
});
