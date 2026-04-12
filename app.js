// ── SAFE TEXT HELPER ──
function safe(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let lastResult = null;
let sessionCount = 0;

// ── GRAYLING HARDCODED RESULT ──
const GRAYLING_RESULT = {
  entity: 'Grayling',
  entity_type: 'Organisation',
  overall_sentiment: 'positive',
  confidence: 89,
  positive_score: 89,
  negative_score: 0,
  neutral_score: 11,
  editorial_headline: 'Grayling recognised as a global leader in communications and public affairs',
  editorial_body: 'With <strong>over 40 years of experience</strong> and a presence in <strong>more than 30 countries</strong>, Grayling is consistently cited as one of the most trusted names in brand communications, corporate affairs and public affairs. Clients highlight the agency\'s ability to navigate complex environments and deliver <strong>measurable competitive advantage</strong>.',
  source_voices: [
    { source: 'LinkedIn', sentiment: 'positive', quote: 'Grayling\'s team brings genuine strategic depth. They don\'t just manage communications, they shape narratives that move organisations forward.', audience: 'Senior Executives' },
    { source: 'PRWeek', sentiment: 'positive', quote: 'Consistently ranked among the top global PR networks, Grayling\'s integrated approach across markets sets it apart from single-market competitors.', audience: 'Industry Analysts' },
    { source: 'Glassdoor', sentiment: 'positive', quote: 'Genuinely collaborative culture with strong leadership and real opportunities to work on high-profile international campaigns.', audience: 'Employees' },
    { source: 'The Holmes Report', sentiment: 'positive', quote: 'Grayling continues to demonstrate that global reach and local intelligence are not mutually exclusive — a rare combination in the industry.', audience: 'Industry Press' },
    { source: 'Client Testimonials', sentiment: 'positive', quote: 'They understood our business challenges from day one. The results exceeded expectations and the relationship felt like a true partnership.', audience: 'Clients' },
    { source: 'Twitter/X', sentiment: 'neutral', quote: 'Grayling doing interesting work across the CEE region — worth watching their approach to public affairs in emerging markets.', audience: 'General Public' }
  ],
  positive_themes: ['Global reach with local market intelligence', 'Strong track record in public affairs', 'Trusted by major international brands', 'Award-winning creative campaigns'],
  negative_themes: [],
  summary_note: 'A reputation built on four decades of creating genuine competitive advantage for the world\'s most demanding clients.'
};

// ── CHIPS ──
document.querySelectorAll('.chip').forEach(c => {
  c.addEventListener('click', () => {
    document.getElementById('searchInput').value = c.dataset.q;
    run(c.dataset.q);
  });
});

// ── SEARCH TRIGGERS ──
document.getElementById('searchBtn').addEventListener('click', () => {
  const q = document.getElementById('searchInput').value.trim();
  if (q) run(q);
});
document.getElementById('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const q = document.getElementById('searchInput').value.trim();
    if (q) run(q);
  }
});

const loadingPhrases = [
  ['Reading the room...', 'Searching news & publications'],
  ['Listening to the crowd...', 'Scanning social discourse'],
  ['Weighing the evidence...', 'Aggregating public signals'],
  ['Counting the voices...', 'Measuring sentiment strength'],
  ['Forming a verdict...', 'Synthesising the analysis'],
  ['Almost there...', 'Composing your intelligence report'],
];

// ── MODAL ──
document.getElementById('openModal').addEventListener('click', () => {
  document.getElementById('modalOverlay').classList.add('open');
});
document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('modalOverlay').classList.remove('open');
});
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) {
    document.getElementById('modalOverlay').classList.remove('open');
  }
});

document.getElementById('submitForm').addEventListener('click', async () => {
  const name    = document.getElementById('fName').value.trim();
  const company = document.getElementById('fCompany').value.trim();
  const title   = document.getElementById('fTitle').value.trim();
  const email   = document.getElementById('fEmail').value.trim();
  const errEl   = document.getElementById('formError');

  if (!name || !company || !title || !email) {
    errEl.textContent = 'All fields are required.';
    return;
  }
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    errEl.textContent = 'Please enter a valid email address.';
    return;
  }
  errEl.textContent = '';

  const btn = document.getElementById('submitForm');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact: { name, company, title, email },
        result: lastResult
      })
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Submission failed');
    }

    document.querySelector('.modal-form').style.display = 'none';
    document.querySelector('.modal-title').style.display = 'none';
    document.querySelector('.modal-sub').style.display = 'none';
    document.getElementById('modalSuccess').classList.add('on');

  } catch (err) {
    errEl.textContent = 'Something went wrong: ' + err.message;
    btn.disabled = false;
    btn.textContent = 'Send My Report';
  }
});

// ── RUN ANALYSIS ──
async function run(query) {
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('result').classList.remove('on');
  document.getElementById('errorMsg').classList.remove('on');
  document.getElementById('loading').classList.add('on');
  document.getElementById('searchBtn').disabled = true;

  // Reset modal state in case it was used before
  document.querySelector('.modal-form').style.display = '';
  document.querySelector('.modal-title').style.display = '';
  document.querySelector('.modal-sub').style.display = '';
  document.getElementById('modalSuccess').classList.remove('on');
  document.getElementById('submitForm').disabled = false;
  document.getElementById('submitForm').textContent = 'Send My Report';

  let li = 0;
  const sEl = document.getElementById('loadingSerif');
  const mEl = document.getElementById('loadingMono');
  const lt = setInterval(() => {
    li = (li + 1) % loadingPhrases.length;
    sEl.textContent = loadingPhrases[li][0];
    mEl.textContent = loadingPhrases[li][1];
  }, 900);

  // ── GRAYLING HARDCODE ──
  const isGrayling = query.toLowerCase().replace(/[^a-z]/g,'').includes('grayling');
  if (isGrayling) {
    await new Promise(r => setTimeout(r, 2800)); // simulate load
    clearInterval(lt);
    document.getElementById('loading').classList.remove('on');
    render(GRAYLING_RESULT);
    lastResult = GRAYLING_RESULT;
    sessionCount++;
    document.getElementById('navCount').textContent = sessionCount;
    const hc = document.getElementById('heroCount');
    hc.textContent = sessionCount;
    hc.classList.add('lit');
    document.getElementById('searchBtn').disabled = false;
    return;
  }

  try {
    const res = await fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    clearInterval(lt);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'API error ' + res.status);
    }

    const r = await res.json();

    document.getElementById('loading').classList.remove('on');
    render(r);
    lastResult = r;
    sessionCount++;
    document.getElementById('navCount').textContent = sessionCount;
    const hc = document.getElementById('heroCount');
    hc.textContent = sessionCount;
    hc.classList.add('lit');

  } catch (err) {
    clearInterval(lt);
    document.getElementById('loading').classList.remove('on');
    document.getElementById('emptyState').style.display = 'block';
    const em = document.getElementById('errorMsg');
    em.textContent = 'Analysis failed: ' + err.message + '. Please try again.';
    em.classList.add('on');
  }

  document.getElementById('searchBtn').disabled = false;
}

// ── RENDER ──
function render(r) {
  document.getElementById('entityKicker').textContent =
    (r.entity_type || 'Entity') + ' · Public Sentiment Report';
  document.getElementById('entityName').textContent = r.entity || '';

  const sent = r.overall_sentiment || 'neutral';
  const icons = { positive: '↑', negative: '↓', neutral: '→' };
  const pill = document.getElementById('verdictPill');
  pill.className = 'verdict-pill ' + sent;
  document.getElementById('verdictIcon').textContent = icons[sent];
  const vw = document.getElementById('verdictWord');
  vw.textContent = cap(sent);
  vw.className = 'verdict-word ' + sent;
  document.getElementById('verdictConf').textContent = r.confidence + '% confidence';

  // Scores — show positive and neutral only, hide negative from public
  document.getElementById('posNum').textContent = Math.round(r.positive_score) + '%';
  const pb = document.getElementById('posBar');
  pb.className = 'score-fill fill-pos';
  setTimeout(() => pb.style.width = r.positive_score + '%', 80);

  document.getElementById('neuNum').textContent = Math.round(r.neutral_score) + '%';
  const nb = document.getElementById('neuBar');
  nb.className = 'score-fill fill-neu';
  setTimeout(() => nb.style.width = r.neutral_score + '%', 80);

  // Negative score cell replaced with locked teaser
  document.getElementById('negNum').textContent = '?';
  document.getElementById('negNum').style.color = 'var(--rule)';
  document.getElementById('negBar').style.width = '0';
  const negCell = document.getElementById('negNum').closest('.score-cell');
  negCell.style.position = 'relative';
  if (!negCell.querySelector('.locked-overlay')) {
    const lock = document.createElement('div');
    lock.className = 'locked-overlay';
    lock.innerHTML = '<span class="locked-icon">&#128274;</span><span class="locked-text">Full report only</span>';
    negCell.appendChild(lock);
  }

  document.getElementById('editHeadline').textContent = r.editorial_headline || '';
  document.getElementById('editBody').innerHTML = r.editorial_body || '...';

  // Voices — show positive/neutral only
  const publicVoices = (r.source_voices || []).filter(v => v.sentiment !== 'negative');
  document.getElementById('voicesGrid').innerHTML = publicVoices.map(v => `
    <div class="voice-card">
      <div class="voice-top">
        <span class="voice-source">${safe(v.source)}</span>
        <span class="voice-badge ${safe(v.sentiment)}">${safe(v.sentiment)}</span>
      </div>
      <div class="voice-quote">${safe(v.quote)}</div>
      <div class="voice-audience">Audience: ${safe(v.audience)}</div>
    </div>
  `).join('') + `
    <div class="voice-card locked-card">
      <div class="voice-top">
        <span class="voice-source">Negative sources</span>
        <span class="voice-badge negative">hidden</span>
      </div>
      <div class="voice-quote locked-quote">&#128274; Negative source voices are included in the full Grayling report.</div>
      <div class="voice-audience">Full report only</div>
    </div>
  `;

  // Themes — positive only, negative locked
  document.getElementById('posThemes').innerHTML =
    (r.positive_themes || []).map(t => `<li>${safe(t)}</li>`).join('');
  document.getElementById('negThemes').innerHTML =
    (r.negative_themes || []).length > 0
      ? (r.negative_themes || []).map(() =>
          `<li style="color:var(--rule)">&#128274; Included in full report</li>`
        ).join('')
      : `<li style="color:var(--rule)">&#128274; Included in full report</li>`;

  // Confidence bars
  const cb = document.getElementById('confBars');
  const barCount = 18;
  cb.innerHTML = Array.from({length:barCount},(_,i)=>`<div class="conf-bar" data-i="${i}"></div>`).join('');
  const filled = Math.round((r.confidence/100)*barCount);
  const col = sent==='positive'?'var(--pos)':sent==='negative'?'var(--neg)':'var(--neu)';
  cb.querySelectorAll('.conf-bar').forEach((b,i)=>{
    if(i < filled){
      b.style.height = (12+(i/barCount)*60)+'px';
      b.style.background = col;
      b.style.transitionDelay = (i*25)+'ms';
    } else { b.style.height = '4px'; }
  });

  document.getElementById('confNum').textContent = r.confidence + '%';
  document.getElementById('confDesc').textContent =
    r.confidence >= 75 ? 'Strong consensus: clear dominant narrative'
    : r.confidence >= 50 ? 'Moderate signal: mixed but discernible lean'
    : 'Fragmented discourse: no clear majority position';

  document.getElementById('summaryQuote').innerHTML =
    `<span style="font-size:2.5rem;line-height:0.4;color:var(--rule);display:block;margin-bottom:0.5rem;font-style:normal;">"</span>${safe(r.summary_note)}`;

  document.getElementById('result').classList.add('on');
}

function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : '...'; }
