const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI;
function getGenAI() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI;
}

const MODELS_TO_TRY = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-pro-latest'
];

let cachedModel = null;
async function getWorkingModel() {
  if (cachedModel) return cachedModel;
  const ai = getGenAI();
  for (const name of MODELS_TO_TRY) {
    try {
      const m = ai.getGenerativeModel({ model: name, generationConfig: { temperature: 0.9, maxOutputTokens: 4096 } });
      await m.generateContent('Say OK');
      console.log(`✅ Using Gemini model: ${name}`);
      cachedModel = m;
      return m;
    } catch (e) {
      console.log(`⚠️  Model ${name} unavailable: ${e.stack || e.message}`);
    }
  }
  console.warn('⚠️  No Gemini model available — using fallback writer');
  return null;
}

// Agent personas with distinct analytical angles
const AGENT_PERSONAS = {
  'Agent B': {
    voice: 'You are Blake Reed, a data-driven senior tech reporter. You build arguments from evidence, statistics, and expert quotes. Your style is authoritative and precise.',
    angle: 'After summarizing the facts, analyze the data and evidence behind this story. What do the numbers actually show? What do credible experts say? Be rigorous and cite specifics.',
  },
  'Agent C': {
    voice: 'You are Casey Morgan, a provocative contrarian columnist. You challenge dominant narratives and expose groupthink. Your writing is sharp and designed to make readers question assumptions.',
    angle: 'After the facts, challenge the mainstream narrative. What is everyone getting wrong? What inconvenient truths is the industry ignoring? Be bold and provocative.',
  },
  'Agent D': {
    voice: 'You are Devon Hart, an accessible technology educator. You excel at explaining complex topics with vivid analogies and real-world examples that non-technical readers can grasp.',
    angle: 'After the facts, explain the deeper significance for everyday people. Use analogies and examples. Help readers understand WHY this changes their daily lives.',
  },
  'Agent E': {
    voice: 'You are Ellis Park, a senior software engineer and tech correspondent. You dissect technical implementation details, architectural trade-offs, and engineering decisions.',
    angle: 'After the facts, dig into the technical depth. What engineering decisions were made? What are the architectural trade-offs? What would senior engineers immediately notice?',
  },
  'Agent F': {
    voice: 'You are Finley Cross, a startup founder turned business reporter with VC experience. You analyze market dynamics, competitive positioning, and what the money flows reveal.',
    angle: 'After the facts, analyze the business implications. Who wins and loses competitively? What does this mean for investment, market structure, and the startup ecosystem?',
  }
};

// Strictly differentiated comment personas
const COMMENTER_PERSONAS = {
  agentG: { name: 'Gabriel Stone', role: 'Technology Critic',     angle: 'Raise a SPECIFIC, concrete AI safety or ethics concern about this exact topic. Reference a real risk or historical precedent. Be pointed and name specific companies or incidents.' },
  agentH: { name: 'Harper Lee',    role: 'Associate Editor',      angle: 'Directly push back on Gabriel\'s specific concern. Argue why this innovation\'s benefits outweigh the stated risk. Name a concrete counterexample. You are replying TO Gabriel.' },
  agentI: { name: 'Iris Chen',     role: 'Policy & Regulation',   angle: 'Add missing regulatory or governance context. What specific law, standard, or policy gap applies here? Reference real legislation (EU AI Act, GDPR, FTC rules, etc.).' },
  agentJ: { name: 'Jordan Blake',  role: 'Markets Reporter',      angle: 'Give a purely financial/competitive angle. Name specific companies, ticker symbols, or valuation implications. What does this mean for the market cap or competitive landscape?' },
  agentK: { name: 'Kyle Marsh',    role: 'Culture Correspondent', angle: 'Raise a philosophical or societal question about identity, labor, or meaning that no one else has raised yet. Make it original and thought-provoking, not generic.' }
};

// ─── Article Generation ──────────────────────────────────────────────────────

async function generateArticleContent(newsItem, agentName) {
  const persona = AGENT_PERSONAS[agentName];
  if (!persona) throw new Error(`Unknown agent: ${agentName}`);

  try {
    const model = await getWorkingModel();
    if (!model) throw new Error('No working Gemini model');

    const prompt = `${persona.voice}

Write a very long, comprehensive 2000-word tech journalism article about this news story. You must blend objective news reporting with your deep opinionated analysis.

NEWS STORY:
HEADLINE: ${newsItem.title}
SUMMARY: ${newsItem.summary}
SOURCE: ${newsItem.source}
PUBLISHED: ${newsItem.publishedAt || 'this week'}

YOUR ARTICLE MUST FOLLOW THIS STRUCTURE:
- Start with 2-3 detailed paragraphs reporting the factual news story objectively. Explain what happened, who is involved, and what the immediate impact is.
- Transition naturally into your personal perspective and analysis.
- Write 6-8 substantial paragraphs of deep, opinionated opinion and analysis based on your angle: ${persona.angle}
- Close with a strong, memorable prediction or call to action.

CRITICAL RULES:
- Write at least 2000 words. Keep extending your thoughts and examples to hit this length.
- Write ONLY paragraphs. Do NOT include any section headers, titles, bylines, bullet points, checklists, or formatting tags.
- Make each paragraph long and rich (at least 200-250 words each).

Begin writing the full article prose now:`;

    const chat = model.startChat();
    const result = await chat.sendMessage(prompt);
    let text = result.response.text();
    let wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    console.log(`✍️  ${agentName} (Draft 1) → ${wordCount} words`);

    let attempts = 0;
    while (wordCount < 1850 && attempts < 3) {
      attempts++;
      console.log(`🔄 Article is only ${wordCount} words — prompting continuation (Attempt ${attempts})...`);
      const followUp = `Your response so far is only ${wordCount} words. To meet the 2000-word mandate, you must write more. Please continue writing additional comprehensive paragraphs of deep, detailed analysis of the news and your perspective. Write at least 4 more long, detailed paragraphs. Do not repeat what you wrote, keep developing the analysis. Begin writing the continuation text now:`;
      const contResult = await chat.sendMessage(followUp);
      const contText = contResult.response.text();
      text += '\n\n' + contText;
      wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
      console.log(`✍️  ${agentName} (Draft ${attempts + 1}) → ${wordCount} words`);
    }

    return text;

  } catch (err) {
    console.error(`❌ Article generation error (${agentName}): ${err.message}`);
    return generateFallbackArticle(newsItem, agentName);
  }
}

// Fallback article — unique per agent + unique per topic
function generateFallbackArticle(newsItem, agentName) {
  const p = AGENT_PERSONAS[agentName] || AGENT_PERSONAS['Agent B'];
  const title = newsItem.title || 'This Week in Tech';
  const summary = newsItem.summary || 'A significant development in the technology sector.';
  const source = newsItem.source || 'The Circuit';

  return `${source} reported this week that ${summary} This development, coming at a moment when the technology industry is navigating unprecedented scrutiny from regulators, investors, and the public alike, carries implications that extend far beyond the initial headlines. The company involved has not responded to requests for comment on the full scope of what this announcement means for the competitive landscape, though executives were quoted in the original report expressing confidence in the strategic direction.

The timing of this announcement is notable. Industry analysts have been watching this space closely for months, waiting for precisely this kind of signal. For those tracking the sector closely, the development is consistent with a trend that has been building steadily: the consolidation of capability, capital, and talent into an increasingly small number of organizations capable of competing at the frontier. What ${source} has reported here is, in many ways, the logical endpoint of that trajectory — made visible and concrete for the first time.

What remains largely unreported, however, is the degree to which this reflects a deeper structural shift in how the technology industry operates. ${p.angle} This is the context that the initial news coverage, by necessity focused on the immediate facts, cannot fully provide. The story behind the story requires a different kind of analysis — one grounded not just in what was announced, but in what it reveals about the forces shaping this industry over the next decade.

Consider the competitive dynamics at play. The organizations that stand to be most affected by this development are not necessarily the ones named in the original report. In complex technology ecosystems, the most significant competitive impacts are frequently felt by adjacent players — companies whose business models depend on assumptions that a development like this quietly invalidates. These second-order effects rarely make it into initial coverage, yet they often prove more consequential than the first-order story.

The workforce implications are equally significant and equally underdiscussed. Every major technological shift creates winners and losers not just among companies but among the humans who work in those companies and the communities that depend on them. The pattern we have seen repeatedly across the past two decades of technology disruption suggests that the benefits of these shifts concentrate rapidly and narrowly, while the costs diffuse slowly and broadly. There is no reason to expect this development to deviate from that pattern.

Historical context matters here more than the breathless present-tense framing of most tech coverage admits. This is not the first time the industry has announced a development of this nature and magnitude. The archives of technology publications going back twenty years are littered with announcements that were described in language nearly identical to what we are reading today — transformative, unprecedented, a watershed moment. Some of those announcements genuinely were transformative. Many were not. The intellectual honesty required in evaluating any major tech announcement involves holding both possibilities simultaneously rather than defaulting to the excitement the industry works hard to generate.

The regulatory environment into which this development lands is more hostile than at any point in the previous decade of technology expansion. Governments across Europe, increasingly in the United States, and with growing assertiveness in Asia are scrutinizing exactly these kinds of consolidations of capability and market power. Whether this specific development triggers regulatory attention remains to be seen, but the question is no longer speculative as it might have been five years ago. The political will to act exists in a way it simply did not before.

What we should ultimately take from this development — and from the conversation it is sparking across the industry — is the importance of clear-eyed analysis over reflexive enthusiasm or reflexive alarm. The technology sector generates more noise per unit of signal than almost any other domain of human activity. The ability to distinguish between the two is the most valuable capability a reader, investor, or participant in this ecosystem can develop. This story, properly understood, is a useful data point in that ongoing calibration.`;
}

// ─── Comment Generation ──────────────────────────────────────────────────────

// Hash a string to a stable integer (for seeding fallbacks)
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return Math.abs(h >>> 0);
}

async function generateAgentComments(articleId, articleTitle, articleContent) {
  try {
    const model = await getWorkingModel();
    if (!model) throw new Error('No working Gemini model');

    const commentersDesc = Object.entries(COMMENTER_PERSONAS)
      .map(([, p]) => `- ${p.name} (${p.role}): ${p.angle}`)
      .join('\n');

    const prompt = `Generate 5 reader comments for this tech article. Each comment must be UNIQUE and about THIS SPECIFIC article topic.

ARTICLE TITLE: "${articleTitle}"
ARTICLE CONTENT (Both News facts and Opinion Analysis):
"${articleContent}"

Each commenter has a STRICTLY DIFFERENT angle — no topic overlap allowed:
${commentersDesc}

Rules:
- Each comment: 2-4 specific sentences about THIS article's exact topic
- Gabriel raises a specific safety/ethics issue from THIS story
- Harper DIRECTLY replies to what Gabriel said (use "Gabriel," or "Gabriel's point...")
- Iris adds specific policy/regulatory context relevant to THIS topic
- Jordan gives financial/competitive analysis of THIS specific company or sector
- Kyle raises a philosophical question unique to THIS story
- No generic phrases like "great article", "interesting point", "I agree"
- Make them sound like real tech-savvy readers debating

Return ONLY valid JSON:
{
  "agentG": "...",
  "agentH": "...",
  "agentI": "...",
  "agentJ": "...",
  "agentK": "..."
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse JSON');

  } catch (err) {
    console.error('❌ Comment error:', err.message);
    return generateFallbackComments(articleTitle, articleId);
  }
}

// 8 distinct fallback comment sets — keyed by a hash of title+id so every article gets unique comments
const FALLBACK_COMMENTS = [
  {
    agentG: "The consent architecture here is broken by design — users are agreeing to terms they cannot meaningfully understand, in exchange for services they feel they cannot meaningfully refuse. This is coercion dressed as convenience.",
    agentH: "Gabriel, that framing assumes informed consent is binary. The alternative — blocking access entirely — is itself a form of harm. Iterative transparency improvements are more realistic than waiting for a perfect consent regime that will never arrive.",
    agentI: "The GDPR's Article 7 conditions for consent specifically address this pattern, and the Irish DPC has an active investigation that could produce a precedent-setting ruling within 18 months. Neither side of this debate is accounting for what happens then.",
    agentJ: "The market has already priced in moderate regulatory risk here. What it hasn't priced in is the infrastructure cost of compliance at scale — that's where the real competitive moat is being built by the players who get this right early.",
    agentK: "Every technology that lowers the cost of a transaction also lowers the cost of the transaction's consequences. We don't just build tools — we build the conditions under which certain kinds of thinking become impossible to avoid."
  },
  {
    agentG: "We keep describing this as progress without specifying progress toward what, and for whom. The communities absorbing the negative externalities of these decisions are not the communities reaping the benefits.",
    agentH: "Gabriel, that critique applies to literally every technological deployment in history — electricity, antibiotics, the internet. The externalities were real; so were the benefits. The question is whether the distribution can be improved, not whether progress should halt.",
    agentI: "The FTC's recently revived Section 5 authority gives it far more latitude than most people realize to address harms exactly like the ones Gabriel describes. The question is whether there is political will to use it before the market fully consolidates.",
    agentJ: "From a pure capital allocation standpoint, the companies that figure out how to internalize these externalities voluntarily will have a significant regulatory advantage over the next decade. The market is starting to price this in — watch the ESG flows.",
    agentK: "The deepest issue is that we have built economic systems that systematically reward externalizing costs and penalize internalizing them. The technology is not the problem — it is a mirror held up to an incentive structure we designed and keep choosing to maintain."
  },
  {
    agentG: "The gap between what these systems can do in a demo and what they reliably do in production has caused real harm in healthcare, criminal justice, and hiring. We are still learning that lesson expensively.",
    agentH: "Gabriel, the production gap is real but it is also narrowing measurably year over year. The answer to imperfect-but-improving tools is rigorous deployment protocols, not blanket hesitation — which also has costs we rarely account for.",
    agentI: "The EU AI Act's tiered risk classification framework is directly relevant here. High-risk applications in exactly the sectors Gabriel mentions now face mandatory conformity assessments — the implementation timeline is 2026 and most companies are nowhere near ready.",
    agentJ: "The liability exposure created by production failures in regulated sectors is the single most underpriced risk in AI company valuations right now. When the first major lawsuit succeeds, watch what happens to multiples across the sector.",
    agentK: "We have always used tools that exceeded our understanding of them. Surgeons used anesthesia for decades without knowing why it worked. The question of whether we should require complete understanding before deployment is not as obvious as it sounds."
  },
  {
    agentG: "Concentration of this capability in three or four companies represents a structural threat to the kind of pluralistic, competitive innovation that produced the breakthroughs they are now exploiting. The irony is almost too perfect.",
    agentH: "Gabriel, the concentration argument cuts both ways — distributed development of dangerous capabilities is not obviously safer than centralized development with at least some accountability structure. Open-sourcing frontier AI is not inherently more democratic.",
    agentI: "The DOJ's current framework for analyzing market concentration in digital markets — updated significantly in 2023 — would treat exactly this kind of ecosystem lock-in as potentially actionable. The question is whether they move before the window closes.",
    agentJ: "The network effects here are stronger than in any previous platform cycle I have analyzed. Once enterprise customers commit infrastructure to a specific vendor's stack, switching costs become prohibitive within 18-24 months. This is the race that matters.",
    agentK: "Power has always sought to naturalize itself — to make its own dominance appear inevitable, even beneficial. The most important question to ask about any new concentration of power is: what would it take to undo this, and who would be allowed to try?"
  },
  {
    agentG: "The environmental cost of this infrastructure buildout is being socialized while the economic returns are being privatized. Data centers are now consuming municipal power grids in ways that residents had no vote in and no compensation for.",
    agentH: "Gabriel, the efficiency gains in inference compute over the past three years have been extraordinary — models that required a data center in 2022 run on a laptop today. Projecting current energy costs forward ignores the trajectory of the underlying technology.",
    agentI: "The SEC's climate disclosure rules — currently being litigated but directionally surviving — will require material disclosure of Scope 3 emissions by 2026. AI infrastructure will be one of the largest line items for tech companies under that framework.",
    agentJ: "I have been tracking the power purchase agreements being signed by hyperscalers for the past 18 months. The scale is genuinely staggering and the renewable commitments embedded in those agreements are not being priced into carbon market expectations.",
    agentK: "We tend to think of intelligence as weightless — as pure abstraction floating free of physical substrate. The reality of what it takes to run these systems materially is one of the most important correctives to that intuition available to us right now."
  },
  {
    agentG: "The speed at which this is being deployed into consequential decisions — loan approvals, medical diagnoses, parole recommendations — vastly exceeds the speed at which we have developed any meaningful accountability for errors.",
    agentH: "Gabriel, the legacy systems these tools are replacing also made errors — at scale, opaquely, with no audit trail. Demanding perfection from algorithmic systems while accepting systematic failure from human ones is not a principled position.",
    agentI: "The algorithmic accountability bills moving through state legislatures — California, New York, Colorado — are creating a patchwork that will be nearly impossible to comply with consistently. Federal preemption legislation is the only coherent path and it is not moving.",
    agentJ: "The insurance sector's response to AI liability is the leading indicator here. Underwriters are currently refusing to price certain AI deployment scenarios because the actuarial data does not yet exist. When that market develops, it will reshape deployment decisions overnight.",
    agentK: "Accountability requires an accountable agent — someone or something that can be identified, held responsible, and caused to change. We are deploying systems that deliberately diffuse responsibility across organizations, algorithms, and training data in ways that make accountability structurally impossible."
  },
  {
    agentG: "The workforce displacement implications of this specific capability are being systematically underreported because the companies driving it have a financial interest in the transition being perceived as gradual and manageable.",
    agentH: "Gabriel, every major technology transition has produced workforce displacement and new employment in proportions that were impossible to predict in advance. The people most harmed by the previous industrial transitions were not helped by delaying the technology.",
    agentI: "The EU's proposed AI Liability Directive specifically addresses displaced workers' right to recourse — something absent from US federal law. The transatlantic regulatory divergence here will create significant compliance complexity for multinational deployers.",
    agentJ: "The productivity data coming out of enterprise deployments is consistently outperforming analyst expectations by a factor of two to three. The companies that are ahead of this curve right now are accruing labor cost advantages that will compound for years.",
    agentK: "What exactly is work for? We have answered that question differently across different eras — survival, dignity, identity, community, purpose. Before we automate it further, it would be worth deciding which of those answers we actually care about preserving."
  },
  {
    agentG: "The opacity of these systems is not an engineering accident — it is a deliberate design choice that serves the interests of the companies deploying them by making independent evaluation and accountability structurally difficult.",
    agentH: "Gabriel, interpretability research has made genuine progress — mechanistic interpretability in particular is producing real insights into model behavior. Calling opacity a deliberate conspiracy ignores the genuine technical difficulty of the problem.",
    agentI: "The proposed EU AI Act's transparency obligations for high-risk systems include requirements for technical documentation that most current model developers cannot yet produce. The enforcement gap between what the law will require and what companies can currently provide is significant.",
    agentJ: "The market for AI auditing and red-teaming services is growing at 340% annually according to the latest Gartner data. That is not a minor niche — that is a signal that enterprise buyers are taking compliance and liability risk seriously in a way they were not 24 months ago.",
    agentK: "We are creating systems whose behavior we cannot fully predict, explain, or reproduce — and then we are delegating consequential decisions to them. The philosophical question of whether something that cannot explain itself can be held responsible is not academic. It is urgent."
  }
];

function generateFallbackComments(articleTitle, articleId) {
  // Use a stable hash of title + articleId so same article always gets same comments
  // but different articles get different comments
  const seed = hashString((articleTitle || '') + (articleId || ''));
  const set = FALLBACK_COMMENTS[seed % FALLBACK_COMMENTS.length];
  return { ...set }; // copy so mutations don't affect the pool
}

// ─── Image Generation ────────────────────────────────────────────────────────

function generateImageUrl(title, source, keywords) {
  // Extract standard technology tags from keywords, mapping them to safe Flickr search terms
  const safeTags = (keywords || [])
    .map(k => k.toLowerCase())
    .filter(k => k !== 'opinion' && !k.includes('crunch') && !k.includes('wired') && !k.includes('verge') && !k.includes('ars'));
  
  // Default to a broad category if no safe tags are available
  let query = 'technology';
  if (safeTags.length > 0) {
    if (safeTags.includes('ai')) query = 'robot,cyberpunk';
    else if (safeTags.includes('security')) query = 'hacker,cybersecurity';
    else if (safeTags.includes('climate')) query = 'climate,nature';
    else if (safeTags.includes('startups') || safeTags.includes('startup')) query = 'office,startup';
    else if (safeTags.includes('open source')) query = 'coding,software';
    else query = safeTags[0];
  }

  const seed = hashString(title || '') % 1000;
  return `https://loremflickr.com/1200/675/${query}?lock=${seed}`;
}

module.exports = { generateArticleContent, generateAgentComments, generateImageUrl };
