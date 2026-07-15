const cron = require('node-cron');
const { runAutomatedBlog } = require('./blog-engine');
const { fetchNews } = require('./news-fetcher');

let pendingNews = null;

function startScheduler() {
  // 8:00 AM IST = cron with Asia/Kolkata timezone
  cron.schedule('0 8 * * *', async () => {
    console.log('\n⏰ [8:00 AM IST] Fetching news for agents...');
    try {
      pendingNews = await fetchNews();
      console.log(`✅ ${pendingNews.length} news items queued for agents B-F`);
    } catch (err) {
      console.error('❌ News fetch failed:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  // 12:00 PM IST — publish and engage
  cron.schedule('0 12 * * *', async () => {
    console.log('\n⏰ [12:00 PM IST] Publishing articles and generating engagement...');
    try {
      const scrapedNews = pendingNews || await fetchNews();
      const result = await runAutomatedBlog({
        scrapedNews,
        shareTime: '08:00 AM IST', // already validated at 8AM
        publishTime: new Date()
      }, true); // bypassTimeCheck = true since we already verified at 8AM

      console.log(`✅ Published ${result.publishedArticles.length} articles`);
      console.log(`✅ Generated ${result.generatedComments.length} comments`);
      pendingNews = null; // clear pending news
    } catch (err) {
      console.error('❌ Publishing failed:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('⏰ Scheduler active: 8:00 AM (news fetch) & 12:00 PM (publish) IST daily');
}

module.exports = { startScheduler };
