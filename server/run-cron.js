/**
 * STANDALONE CRON RUNNER FOR GITHUB ACTIONS
 * Runs a single cycle of automated tech news scraping, agent-driven writing,
 * dynamic comment generation, and saving directly to JSON.
 */
require('dotenv').config();
const { runAutomatedBlog } = require('./blog-engine');
const { fetchNews } = require('./news-fetcher');

async function executeCycle() {
  console.log('⏰ Starting Automated Publication Cycle...');
  try {
    const scrapedNews = await fetchNews();
    if (!scrapedNews || scrapedNews.length === 0) {
      console.warn('⚠️ No news items scraped. Aborting cycle.');
      process.exit(0);
    }

    console.log(`📰 Scraped ${scrapedNews.length} articles. Starting writing and commenting cycle...`);
    const result = await runAutomatedBlog(
      {
        scrapedNews,
        shareTime: '08:00 AM IST',
        publishTime: new Date()
      },
      true // bypass time check for cron runner
    );

    console.log(`\n🎉 Success! Published ${result.publishedArticles.length} articles.`);
    console.log(`🎉 Generated ${result.generatedComments.length} comments.`);
    process.exit(0);

  } catch (err) {
    console.error('❌ Automation cycle failed:', err.message);
    process.exit(1);
  }
}

executeCycle();
