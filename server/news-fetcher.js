const axios = require('axios');
const { loadArticles } = require('./data-store');

const ALLOWED_SOURCES = ['TechCrunch', 'Wired', 'The Verge', 'Ars Technica'];

function mapSourceName(name) {
  if (!name) return null;
  const l = name.toLowerCase();
  if (l.includes('techcrunch')) return 'TechCrunch';
  if (l.includes('wired')) return 'Wired';
  if (l.includes('verge')) return 'The Verge';
  if (l.includes('ars')) return 'Ars Technica';
  return null;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getAlreadyPublishedTitles() {
  const existing = loadArticles();
  return new Set(
    existing.map(a => a.originalTitle || a.title || '').map(t => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
  );
}

async function fetchNews() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    // Use /everything to get full week of articles from allowed sources
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        sources: 'techcrunch,wired,the-verge,ars-technica',
        apiKey: process.env.NEWS_API_KEY,
        pageSize: 50,
        language: 'en',
        from: sevenDaysAgo,
        sortBy: 'publishedAt'
      },
      timeout: 12000
    });

    const articles = response.data.articles || [];

    // Map and filter
    const mapped = articles
      .map(a => ({
        title: a.title,
        summary: a.description || a.content?.substring(0, 400) || '',
        source: mapSourceName(a.source?.name),
        url: a.url,
        imageUrl: a.urlToImage,
        publishedAt: a.publishedAt
      }))
      .filter(a =>
        a.source &&
        ALLOWED_SOURCES.includes(a.source) &&
        a.title &&
        a.summary &&
        !a.title.includes('[Removed]') &&
        a.title.length > 20
      );

    // De-duplicate by title similarity
    const seen = new Set();
    const deduped = mapped.filter(a => {
      const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Remove topics already published in current data store
    const published = getAlreadyPublishedTitles();
    const fresh = deduped.filter(a => {
      const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);
      return !published.has(key);
    });

    // Shuffle to avoid always picking the same top stories
    const shuffled = shuffle(fresh);

    console.log(`📰 Found ${mapped.length} articles → ${fresh.length} fresh (${deduped.length - fresh.length} already published)`);

    if (shuffled.length === 0) {
      console.warn('⚠️  No fresh news from API — using expanded mock data');
      return getExpandedMockNews(published);
    }

    return shuffled;

  } catch (err) {
    console.error('❌ NewsAPI error:', err.message);
    const published = getAlreadyPublishedTitles();
    return getExpandedMockNews(published);
  }
}

function getExpandedMockNews(alreadyPublished = new Set()) {
  const all = [
    { title: "OpenAI's GPT-5 Is a Leap Forward — But at What Cost to Open Research?", summary: "OpenAI's latest model sets new benchmarks across reasoning and coding tasks, yet its closed architecture and secretive training process raise serious questions about the future of open AI development.", source: 'TechCrunch', url: '#', imageUrl: null, publishedAt: new Date(Date.now() - 1 * 86400000).toISOString() },
    { title: "Apple Intelligence Is Playing It Safe — and That's a Strategic Mistake", summary: "Apple's privacy-first AI approach sounds noble, but as rivals deploy more capable open models, Apple risks falling irreparably behind in the AI race.", source: 'Wired', url: '#', imageUrl: null, publishedAt: new Date(Date.now() - 1 * 86400000).toISOString() },
    { title: "DeepMind's AlphaFold 3 Could Compress Decades of Drug Discovery Into Years", summary: "The new protein-structure model predicts drug-molecule interactions with unprecedented accuracy, raising hopes for treatments for diseases that have stumped researchers for generations.", source: 'The Verge', url: '#', imageUrl: null, publishedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    { title: "The Hidden Environmental Toll of Training the World's Largest AI Models", summary: "New research calculates the carbon footprint of frontier AI training runs, sparking an urgent debate about whether the benefits justify the planetary cost.", source: 'Ars Technica', url: '#', imageUrl: null, publishedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    { title: "Anthropic's Claude Now Browses the Web — Here's Why That Changes Everything", summary: "With real-time web access and persistent memory, Claude moves from a chatbot to an autonomous research agent, reshaping how enterprises think about AI workflows.", source: 'TechCrunch', url: '#', imageUrl: null, publishedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { title: "The Self-Driving Car Industry Is in Crisis — and Only Waymo Seems to Know Why", summary: "After a wave of retreats, pivots and bankruptcies, Waymo stands almost alone. Its rivals' failures reveal fundamental misunderstandings about what autonomous driving actually requires.", source: 'Wired', url: '#', imageUrl: null, publishedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { title: "Google's Gemini Ultra vs. GPT-4o: The Real Differences Nobody Is Talking About", summary: "Benchmark scores tell one story; real-world performance tells another. We tested both flagship models on tasks that matter and the results are more nuanced than the marketing suggests.", source: 'The Verge', url: '#', imageUrl: null, publishedAt: new Date(Date.now() - 4 * 86400000).toISOString() },
    { title: "Meta's Open-Source AI Strategy Is a Trojan Horse — And It's Working", summary: "By releasing Llama models freely, Meta has subtly reshaped the AI ecosystem around its own infrastructure, developer tools, and data pipelines. Open source has never been so strategic.", source: 'Ars Technica', url: '#', imageUrl: null, publishedAt: new Date(Date.now() - 4 * 86400000).toISOString() },
    { title: "Nvidia's Blackwell GPUs Are Changing the Economics of AI Infrastructure", summary: "The new GPU architecture promises to cut inference costs by 30x, potentially democratizing access to powerful AI — or further entrenching Nvidia's monopoly over the compute stack.", source: 'TechCrunch', url: '#', imageUrl: null, publishedAt: new Date(Date.now() - 5 * 86400000).toISOString() },
    { title: "The Regulation of AI Is Coming — And Silicon Valley Is Completely Unprepared", summary: "As the EU AI Act takes effect and US states pass patchwork legislation, tech companies face a compliance reckoning they've spent years trying to avoid.", source: 'Wired', url: '#', imageUrl: null, publishedAt: new Date(Date.now() - 5 * 86400000).toISOString() },
    { title: "Inside the Startup Betting That Brain-Computer Interfaces Will Replace Smartphones", summary: "Neuralink isn't alone. A wave of BCI startups is racing to bring neural interfaces to market, and the implications for human identity, privacy and autonomy are staggering.", source: 'The Verge', url: '#', imageUrl: null, publishedAt: new Date(Date.now() - 6 * 86400000).toISOString() },
    { title: "The Quantum Computing Race Has a Credibility Problem", summary: "IBM, Google and IonQ are all claiming major milestones, but independent researchers say the goalposts keep moving. What will it actually take to achieve useful quantum advantage?", source: 'Ars Technica', url: '#', imageUrl: null, publishedAt: new Date(Date.now() - 6 * 86400000).toISOString() },
  ];

  // Filter out already-published ones
  const fresh = all.filter(a => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);
    return !alreadyPublished.has(key);
  });

  return shuffle(fresh);
}

module.exports = { fetchNews };
