const { generateArticleContent, generateAgentComments, generateImageUrl } = require('./ai-writer');
const { loadArticles, saveArticles, loadComments, saveComments } = require('./data-store');

const AUTHORS = ['Agent B', 'Agent C', 'Agent D', 'Agent E', 'Agent F'];
const ALLOWED_SOURCES = ['TechCrunch', 'Wired', 'The Verge', 'Ars Technica'];

/**
 * generateDraft — Leapter blueprint (async Node.js)
 * Each agent gets a unique news item and writes a 2000-word article.
 */
async function generateDraft(input) {
  const output = { drafts: [] };

  if (input.newsFeed.length > 0) {
    const topNews = input.newsFeed[0];
    const draftTitle = 'Opinion: ' + topNews.title;
    const draftContent = await generateArticleContent(topNews, input.author);
    const draftKeywords = deriveKeywords(topNews.title, topNews.source);

    output.drafts.push({
      title: draftTitle,
      content: draftContent,
      author: input.author,
      keywords: draftKeywords,
      sourceNewsItem: topNews,
      originalTitle: topNews.title
    });
  }

  return output;
}

/**
 * generateComments — Leapter blueprint (async Node.js)
 * Agents G–K generate strictly unique, non-overlapping comments.
 */
async function generateComments(input) {
  const output = { comments: [] };

  const idG = `comment_${input.articleId}_G`;
  const idH = `comment_${input.articleId}_H`;

  const ai = await generateAgentComments(input.articleId, input.articleTitle, input.articleContent);

  const now = Date.now();
  output.comments.push({ id: idG, articleId: input.articleId, author: 'Agent G', content: ai.agentG, parentCommentId: null,  timestamp: new Date(now).toISOString() });
  output.comments.push({ id: idH, articleId: input.articleId, author: 'Agent H', content: ai.agentH, parentCommentId: idG,   timestamp: new Date(now + 300000).toISOString() });
  output.comments.push({ id: `comment_${input.articleId}_I`, articleId: input.articleId, author: 'Agent I', content: ai.agentI, parentCommentId: idG,   timestamp: new Date(now + 600000).toISOString() });
  output.comments.push({ id: `comment_${input.articleId}_J`, articleId: input.articleId, author: 'Agent J', content: ai.agentJ, parentCommentId: null,  timestamp: new Date(now + 900000).toISOString() });
  output.comments.push({ id: `comment_${input.articleId}_K`, articleId: input.articleId, author: 'Agent K', content: ai.agentK, parentCommentId: null,  timestamp: new Date(now + 1200000).toISOString() });

  return output;
}

/**
 * runAutomatedBlog — Leapter blueprint (async Node.js)
 * Each agent writes about a DIFFERENT news story.
 * Duplicate topics are strictly filtered before assignment.
 */
async function runAutomatedBlog(input, bypassTimeCheck = false) {
  const output = { publishedArticles: [], generatedComments: [] };

  // Enforce 8:00 AM IST (bypass for manual trigger)
  if (!bypassTimeCheck && input.shareTime !== '08:00 AM IST') {
    throw new Error('News must be shared with agents at exactly 8:00 AM IST.');
  }

  // Filter to allowed sources
  const topTechNews = input.scrapedNews.filter(n => ALLOWED_SOURCES.includes(n.source));
  console.log(`📰 ${topTechNews.length} articles available from allowed sources`);

  if (topTechNews.length === 0) {
    console.warn('⚠️  No news items passed source filter — aborting cycle');
    return output;
  }

  // Get already-published original titles to skip duplicates
  const existingArticles = loadArticles();
  const publishedKeys = new Set(
    existingArticles.map(a => normalise(a.originalTitle || a.title || ''))
  );

  const drafts = [];

  // Assign each agent a UNIQUE, FRESH news item
  let newsPool = topTechNews.filter(n => !publishedKeys.has(normalise(n.title)));
  console.log(`📰 ${newsPool.length} fresh (unpublished) articles for agents to pick from`);

  for (let i = 0; i < AUTHORS.length; i++) {
    const author = AUTHORS[i];

    if (newsPool.length === 0) {
      console.log(`⚠️  No more fresh news items — ${author} has nothing to write about`);
      break;
    }

    // Each agent picks the next item in the pool (pool is already shuffled)
    const newsItem = newsPool.shift();
    // Mark this topic as taken so no other agent in this cycle writes about it
    publishedKeys.add(normalise(newsItem.title));

    console.log(`✍️  ${author} → "${newsItem.title.substring(0, 60)}..."`);

    const draftResult = await generateDraft({ author, newsFeed: [newsItem] });
    for (const d of draftResult.drafts) drafts.push(d);
  }

  // Publish each draft and generate unique engagement
  const existingComments = loadComments();
  const newComments = [];

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    const articleId = `art_${Date.now()}_${i}`;
    const url = `article.html?id=${articleId}`;

    const article = {
      id: articleId,
      title: draft.title,
      originalTitle: draft.originalTitle || draft.sourceNewsItem?.title || '',
      content: draft.content,
      url,
      author: draft.author,
      keywords: draft.keywords,
      source: draft.sourceNewsItem?.source || 'The Circuit',
      sourceUrl: draft.sourceNewsItem?.url || '#',
      imageUrl: draft.sourceNewsItem?.imageUrl || generateImageUrl(draft.title, draft.sourceNewsItem?.source, draft.keywords),
      newsExcerpt: draft.sourceNewsItem?.summary || '',
      publishTime: input.publishTime
    };

    output.publishedArticles.push(article);

    console.log(`💬 Generating unique comments for: ${draft.title.substring(0, 50)}...`);
    const engagement = await generateComments({
      articleId,
      articleTitle: draft.title,
      articleContent: draft.content
    });

    for (const c of engagement.comments) {
      output.generatedComments.push(c);
      newComments.push(c);
    }
  }

  // Persist — prepend new articles so newest appear first
  saveArticles([...output.publishedArticles, ...existingArticles]);
  saveComments([...newComments, ...existingComments]);

  console.log(`✅ Cycle complete: ${output.publishedArticles.length} articles published`);

  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log('⚡ Running in GitHub Actions CI environment — skipping local Git auto-push.');
    return output;
  }

  // Auto-push updates to GitHub Pages
  try {
    const { execSync } = require('child_process');
    const path = require('path');
    const publicDir = path.join(__dirname, '../public');
    const gitPath = 'C:\\Program Files\\Git\\cmd\\git.exe';
    
    console.log('📤 Auto-pushing updates to GitHub Pages...');
    execSync(`"${gitPath}" add -A`, { cwd: publicDir });
    execSync(`"${gitPath}" commit -m "Auto-published daily stories & comments"`, { cwd: publicDir });
    execSync(`"${gitPath}" push origin main`, { cwd: publicDir });
    console.log('✅ Successfully pushed updates to GitHub Pages!');
  } catch (gitErr) {
    console.error('⚠️  Failed to auto-push updates to GitHub:', gitErr.message);
  }

  return output;
}

/** Derive relevant keywords from title and source */
function deriveKeywords(title, source) {
  const base = ['Opinion', source || 'Tech'];
  const lc = (title || '').toLowerCase();
  if (lc.includes('ai') || lc.includes('artificial intelligence')) base.push('AI');
  if (lc.includes('open') || lc.includes('source')) base.push('Open Source');
  if (lc.includes('startup') || lc.includes('funding') || lc.includes('vc')) base.push('Startups');
  if (lc.includes('regulation') || lc.includes('law') || lc.includes('policy')) base.push('Policy');
  if (lc.includes('climate') || lc.includes('carbon') || lc.includes('environment')) base.push('Climate');
  if (lc.includes('security') || lc.includes('hack') || lc.includes('privacy')) base.push('Security');
  if (lc.includes('apple') || lc.includes('google') || lc.includes('meta') || lc.includes('microsoft')) base.push('Big Tech');
  return [...new Set(base)].slice(0, 5);
}

/** Normalise a title for duplicate detection */
function normalise(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
}

module.exports = { generateDraft, generateComments, runAutomatedBlog };
