// Human author names — no AI branding visible to readers
const AUTHOR_NAMES = {
  'Agent B': 'Blake Reed',
  'Agent C': 'Casey Morgan',
  'Agent D': 'Devon Hart',
  'Agent E': 'Ellis Park',
  'Agent F': 'Finley Cross'
};

const AUTHOR_ROLES = {
  'Agent B': 'Senior Reporter',
  'Agent C': 'Staff Writer',
  'Agent D': 'Contributing Editor',
  'Agent E': 'Technology Correspondent',
  'Agent F': 'Business Reporter'
};

// Bold story color blocks — rotating palette
const STORY_COLORS = [
  { bg: '#ffe600', text: '#000' },
  { bg: '#ff6b35', text: '#fff' },
  { bg: '#c084fc', text: '#fff' },
  { bg: '#3cffd0', text: '#000' },
  { bg: '#5200ff', text: '#fff' },
  { bg: '#ff3b30', text: '#fff' },
];

const SOURCE_LABELS = {
  'TechCrunch': 'TC',
  'Wired': 'WD',
  'The Verge': 'VG',
  'Ars Technica': 'AT'
};

function getColor(index) {
  return STORY_COLORS[index % STORY_COLORS.length];
}

function getAuthorName(agent) {
  return AUTHOR_NAMES[agent] || agent;
}

function getAuthorRole(agent) {
  return AUTHOR_ROLES[agent] || 'Staff Reporter';
}

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatFullDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 4000);
}

function renderHero(articles) {
  if (!articles || articles.length === 0) return;
  const heroSection = document.getElementById('hero-section');

  const main = articles[0];
  const sideArticles = articles.slice(1, 4);
  const color = getColor(0);
  const authorName = getAuthorName(main.author);
  const timeAgo = formatTimeAgo(main.publishTime);
  const excerpt = (main.content || '').substring(0, 140).replace(/\n/g, ' ') + '…';
  const source = main.source || '';

  const sideHTML = sideArticles.map((a, i) => {
    const c = getColor(i + 1);
    const targetUrl = (a.url || '').replace(/^\//, '') || `article.html?id=${a.id}`;
    return `
    <a class="hero-sidebar-story" href="${targetUrl}">
      <div class="sidebar-story-cat">${a.source || 'Tech'} · Opinion</div>
      <div class="sidebar-story-title">${a.title || ''}</div>
      <div class="sidebar-story-meta">${getAuthorName(a.author)} · ${formatTimeAgo(a.publishTime)}</div>
    </a>`;
  }).join('');

  const mainTargetUrl = (main.url || '').replace(/^\//, '') || `article.html?id=${main.id}`;

  heroSection.innerHTML = `
    <div class="hero-feature">
      <a class="hero-main" href="${mainTargetUrl}">
        <div class="hero-color-block" style="background:${color.bg}">
          ${main.imageUrl ? `<img src="${main.imageUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.45;" />` : ''}
        </div>
        <div class="hero-main-content">
          <div class="hero-category">Opinion · ${source}</div>
          <h2 class="hero-title" style="color:${color.text === '#000' ? '#000' : '#fff'}">${main.title || ''}</h2>
          <div class="hero-meta" style="color:${color.text === '#000' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)'}">
            <span>${authorName}</span>
            <span>·</span>
            <span>${timeAgo}</span>
          </div>
        </div>
      </a>
      <div class="hero-sidebar">${sideHTML}</div>
    </div>
  `;
}

function renderCard(article, index) {
  const color = getColor(index);
  const authorName = getAuthorName(article.author);
  const initials = article.source ? (SOURCE_LABELS[article.source] || article.source.substring(0, 2).toUpperCase()) : 'TC';
  const timeAgo = formatTimeAgo(article.publishTime);
  const excerpt = (article.content || '').substring(0, 100).replace(/\n/g, ' ') + '…';

  const card = document.createElement('a');
  card.className = 'story-card';
  const cardTargetUrl = (article.url || '').replace(/^\//, '') || `article.html?id=${article.id}`;
  card.href = cardTargetUrl;
  card.style.animationDelay = `${index * 60}ms`;

  card.innerHTML = `
    <div class="story-color-block" style="background:${color.bg};color:${color.text === '#000' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}">
      ${article.imageUrl ? `<img src="${article.imageUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.65;" />` : initials}
    </div>
    <div class="story-card-body">
      <div class="story-card-cat">Opinion · ${article.source || 'Tech'}</div>
      <div class="story-card-title">${article.title || 'Untitled'}</div>
      <div class="story-card-excerpt">${excerpt}</div>
    </div>
    <div class="story-card-footer">
      <span class="story-author">${authorName}</span>
      <span class="story-time">${timeAgo}</span>
    </div>
  `;
  return card;
}

async function loadArticles() {
  const grid = document.getElementById('article-grid');
  const countEl = document.getElementById('story-count');

  // Hide trigger button if running statically on GitHub Pages or file protocol
  if (window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:') {
    const btn = document.getElementById('trigger-btn');
    if (btn) btn.style.display = 'none';
  }

  try {
    const res = await fetch('data/articles.json');
    const articles = await res.json();

    grid.innerHTML = '';

    if (articles.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">No stories yet.</div>
          <div class="empty-desc">Click "Run Today's Cycle" to generate today's articles.</div>
        </div>`;
      countEl.textContent = '';
      document.getElementById('hero-section').innerHTML = '';
      return;
    }

    countEl.innerHTML = `<span>${articles.length} stories</span>`;

    // Hero — top article
    renderHero(articles);

    // Remaining articles in grid (skip the first 4 used in hero)
    const gridArticles = articles.length > 4 ? articles.slice(4) : articles;
    if (gridArticles.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-desc">More stories coming next cycle.</div></div>`;
    } else {
      gridArticles.forEach((a, i) => grid.appendChild(renderCard(a, i)));
    }

  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-title">Server error</div><div class="empty-desc">Make sure the server is running at localhost:3000</div></div>`;
  }
}

async function triggerCycle() {
  const btn = document.getElementById('trigger-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Writing stories...';
  showToast('Agents are writing today\'s stories…', 'success');

  try {
    const res = await fetch('/api/trigger', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`Published ${data.articlesPublished} stories!`, 'success');
      await loadArticles();
    } else {
      showToast(data.error || 'Cycle failed', 'error');
    }
  } catch (err) {
    showToast('Cannot reach server', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Run Today\'s Cycle';
  }
}

loadArticles();
