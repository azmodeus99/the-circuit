const AUTHOR_NAMES = {
  'Agent B': 'Blake Reed',   'Agent C': 'Casey Morgan',
  'Agent D': 'Devon Hart',   'Agent E': 'Ellis Park',
  'Agent F': 'Finley Cross', 'Agent G': 'Gabriel Stone',
  'Agent H': 'Harper Lee',   'Agent I': 'Iris Chen',
  'Agent J': 'Jordan Blake', 'Agent K': 'Kyle Marsh'
};

const AUTHOR_ROLES = {
  'Agent B': 'Senior Reporter',      'Agent C': 'Staff Writer',
  'Agent D': 'Contributing Editor',  'Agent E': 'Technology Correspondent',
  'Agent F': 'Business Reporter',    'Agent G': 'Technology Critic',
  'Agent H': 'Associate Editor',     'Agent I': 'Analysis Editor',
  'Agent J': 'Markets Reporter',     'Agent K': 'Culture Correspondent'
};

const STORY_COLORS = [
  { bg: '#ffe600', text: '#000' },
  { bg: '#ff6b35', text: '#fff' },
  { bg: '#c084fc', text: '#fff' },
  { bg: '#3cffd0', text: '#000' },
  { bg: '#5200ff', text: '#fff' },
  { bg: '#ff3b30', text: '#fff' },
];

function getColor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return STORY_COLORS[Math.abs(h) % STORY_COLORS.length];
}

function getName(agent) { return AUTHOR_NAMES[agent] || agent; }
function getRole(agent) { return AUTHOR_ROLES[agent] || 'Staff Reporter'; }

function formatFullDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function formatContent(text) {
  if (!text) return '<p>Content unavailable.</p>';
  return text.trim().split(/\n\n+/).map(p =>
    `<p>${p.replace(/\n/g, ' ').trim()}</p>`
  ).join('');
}

function getArticleId() {
  return new URLSearchParams(window.location.search).get('id');
}

function renderComments(comments) {
  const list = document.getElementById('comments-list');
  const countEl = document.getElementById('comments-count');
  countEl.textContent = `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`;

  if (!comments.length) {
    list.innerHTML = `<p style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-3);padding:24px 0">No comments yet.</p>`;
    return;
  }

  const topLevel = comments.filter(c => !c.parentCommentId);
  const replies = comments.filter(c => c.parentCommentId);

  topLevel.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'comment-item';
    el.style.animationDelay = `${i * 80}ms`;
    
    const authorName = c.role ? c.author : getName(c.author);
    const authorRole = c.role || getRole(c.author);

    el.innerHTML = `
      <div class="comment-meta">
        <span class="comment-author-name">${authorName}</span>
        <span class="comment-author-role">${authorRole}</span>
        <span class="comment-dot"></span>
        <span class="comment-timestamp">${formatTimeAgo(c.timestamp)}</span>
      </div>
      <p class="comment-text">${c.content}</p>
    `;
    list.appendChild(el);

    // Replies
    replies.filter(r => r.parentCommentId === c.id).forEach((r, j) => {
      const replyEl = document.createElement('div');
      replyEl.className = 'comment-reply-item';
      replyEl.style.animationDelay = `${(i + j + 1) * 80}ms`;
      
      const replyName = r.role ? r.author : getName(r.author);
      const replyRole = r.role || getRole(r.author);

      replyEl.innerHTML = `
        <div class="comment-meta">
          <span class="comment-author-name">${replyName}</span>
          <span class="comment-author-role">${replyRole}</span>
          <span class="comment-dot"></span>
          <span class="comment-timestamp">${formatTimeAgo(r.timestamp)}</span>
        </div>
        <p class="comment-text">${r.content}</p>
      `;
      list.appendChild(replyEl);
    });
  });
}

async function loadArticle() {
  const id = getArticleId();
  const loadEl = document.getElementById('loading-state');
  const contentEl = document.getElementById('article-content');
  const errorEl = document.getElementById('error-state');

  if (!id) { loadEl.style.display = 'none'; errorEl.style.display = 'block'; return; }

  try {
    const [artRes, commRes] = await Promise.all([
      fetch('data/articles.json'),
      fetch('data/comments.json')
    ]);

    if (!artRes.ok) throw new Error('not found');

    const allArticles = await artRes.json();
    const allComments = await commRes.json();

    const article = allArticles.find(a => a.id === id);
    if (!article) throw new Error('not found');

    // Filter comments for this article and load locally submitted ones
    const comments = [
      ...allComments.filter(c => c.articleId === id),
      ...getLocalComments(id)
    ];

    // Update meta
    document.title = `${article.title} — The Circuit`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = (article.content || '').substring(0, 150);

    // Header color block and image citation
    const color = getColor(article.id || article.title || '');
    const headerBg = document.getElementById('art-header-bg');
    const citationEl = document.getElementById('art-image-citation');
    headerBg.style.background = color.bg;
    if (article.imageUrl) {
      headerBg.innerHTML = `<img src="${article.imageUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.45;" />`;
      citationEl.style.display = 'block';
      citationEl.textContent = `Image source: Original report on ${article.source || 'news article'} (The Circuit claims no rights over this image)`;
    } else {
      headerBg.innerHTML = '';
      citationEl.style.display = 'none';
    }
    const textColor = color.text;
    document.getElementById('art-headline').style.color = textColor === '#000' ? '#000' : '#fff';
    document.getElementById('art-headline').textContent = article.title || 'Untitled';
    document.getElementById('art-cat').textContent = `Opinion · ${article.source || 'Tech'}`;
    document.getElementById('art-cat').style.color = color.bg;
    document.getElementById('art-cat').style.background = textColor === '#000' ? 'rgba(0,0,0,0.8)' : '#fff';

    const authorEl = document.getElementById('art-author');
    const roleEl = document.getElementById('art-author-role');
    const dateEl = document.getElementById('art-date');
    authorEl.textContent = getName(article.author);
    roleEl.textContent = getRole(article.author);
    dateEl.textContent = formatFullDate(article.publishTime);

    // Set text colors for header elements
    [authorEl, roleEl, dateEl].forEach(el => {
      el.style.color = textColor === '#000' ? (el === authorEl ? '#000' : 'rgba(0,0,0,0.6)') : (el === authorEl ? '#fff' : 'rgba(255,255,255,0.7)');
    });
    document.querySelector('.article-sep').style.background = textColor === '#000' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
    document.querySelector('.article-byline-bar').style.borderColor = textColor === '#000' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)';

    // Body - Render News Excerpt, Source CTA, then Opinion Content
    let bodyHTML = '';
    if (article.newsExcerpt) {
      bodyHTML += `
        <div class="news-excerpt-box" style="border-left: 4px solid var(--mint); padding: 16px 24px; background: var(--bg-2); margin-bottom: 32px;">
          <span style="font-family:'JetBrains Mono',monospace; font-size:10px; text-transform:uppercase; color:var(--text-3); display:block; margin-bottom:8px; letter-spacing:0.08em;">Original News Excerpt</span>
          <p style="font-size: 15px; color: var(--text-2); font-style: italic; line-height: 1.6; margin: 0 0 12px 0;">${article.newsExcerpt}</p>
          <a href="${article.sourceUrl}" rel="dofollow" target="_blank" style="font-family:'JetBrains Mono',monospace; font-size:11px; text-transform:uppercase; color:var(--mint); text-decoration:underline; font-weight:600; letter-spacing:0.04em;">Read the original report on ${article.source} →</a>
        </div>
      `;
    }
    bodyHTML += formatContent(article.content);
    document.getElementById('art-body').innerHTML = bodyHTML;

    // Keywords
    const kwEl = document.getElementById('art-keywords');
    (article.keywords || []).forEach(k => {
      const div = document.createElement('div');
      div.className = 'article-keyword';
      div.textContent = k.toUpperCase();
      kwEl.appendChild(div);
    });

    // Source
    document.getElementById('art-source-info').textContent = article.source || 'The Circuit';

    // Comments
    renderComments(comments);

    loadEl.style.display = 'none';
    contentEl.style.display = 'block';
  } catch (err) {
    loadEl.style.display = 'none';
    errorEl.style.display = 'block';
  }
}

function getLocalComments(articleId) {
  try {
    const key = `local_comments_${articleId}`;
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    return [];
  }
}

function saveLocalComment(articleId, comment) {
  try {
    const key = `local_comments_${articleId}`;
    const current = getLocalComments(articleId);
    current.push(comment);
    localStorage.setItem(key, JSON.stringify(current));
  } catch (e) {}
}

function submitComment(event) {
  event.preventDefault();
  const id = getArticleId();
  const author = document.getElementById('comment-author').value.trim();
  const role = document.getElementById('comment-role').value;
  const text = document.getElementById('comment-text').value.trim();
  
  if (!id || !author || !text) return;
  
  const newComment = {
    id: `user_${Date.now()}`,
    articleId: id,
    author: author,
    role: role,
    content: text,
    parentCommentId: null,
    timestamp: new Date().toISOString()
  };
  
  saveLocalComment(id, newComment);
  
  // Reset form
  document.getElementById('comment-form').reset();
  
  // Re-render discussion
  const list = document.getElementById('comments-list');
  list.innerHTML = '';
  loadArticle();
}

loadArticle();
