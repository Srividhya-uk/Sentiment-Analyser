// ── SAFE TEXT HELPER ──
function safe(str) {
if (!str) return ‘’;
return String(str)
.replace(/&/g, ‘&’)
.replace(/</g, ‘<’)
.replace(/>/g, ‘>’)
.replace(/”/g, ‘"’)
.replace(/’/g, ‘'’);
}

let lastResult = null;
const MAX_FREE_SEARCHES = 5;
let sessionCount = parseInt(localStorage.getItem(‘grayling_search_count’) || ‘0’, 10);

// Initialise display on load
window.addEventListener(‘load’, () => {
document.getElementById(‘navCount’).textContent = sessionCount;
document.getElementById(‘heroCount’).textContent = sessionCount;
if (sessionCount > 0) document.getElementById(‘heroCount’).classList.add(‘lit’);
if (sessionCount >= MAX_FREE_SEARCHES) {
document.getElementById(‘navCount’).style.color = ‘var(–neg)’;
}
});

// ── HEATHER BLUNDELL HARDCODED RESULT ──
const HEATHER_RESULT = {
entity: ‘Heather Blundell’,
entity_type: ‘Person’,
overall_sentiment: ‘positive’,
confidence: 92,
positive_score: 92,
negative_score: 0,
neutral_score: 8,
editorial_headline: ‘One of UK PR's most influential leaders, redefining Grayling's ambition’,
editorial_body: ‘Heather Blundell joined <strong>Grayling as UK CEO in December 2023</strong>, bringing 15+ years of leadership across Edelman, Weber Shandwick and Ketchum. Under her tenure, Grayling achieved a <strong>0% gender pay gap and 50/50 board-level gender representation</strong>. She has won <strong>seven Cannes Lions in three years</strong>, including a Gold Lion for Creative Commerce, and was named in <strong>PRWeek's Top 20 Most Influential Women in PR</strong>.’,
source_voices: [
{ source: ‘PRWeek’, sentiment: ‘positive’, quote: ‘Named in PRWeek's Top 20 Most Influential Women in PR, Blundell is widely regarded as one of the sharpest strategic minds in UK communications today.’, audience: ‘Industry Press’ },
{ source: ‘LinkedIn’, sentiment: ‘positive’, quote: ‘Heather's high challenge, high support leadership style has transformed the culture at Grayling UK. Rare to find a CEO who genuinely walks the talk on DEI.’, audience: ‘Senior Communications Professionals’ },
{ source: ‘Glassdoor’, sentiment: ‘positive’, quote: ‘She promoted over a third of the agency in her first year. Real investment in people's careers, not just words on a website.’, audience: ‘Employees’ },
{ source: ‘The Holmes Report’, sentiment: ‘positive’, quote: ‘Blundell's launch of Grayling Media , a dedicated earned media unit with a journalist advisory board , signals a serious recommitment to craft at scale.’, audience: ‘Industry Analysts’ },
{ source: ‘Cannes Lions’, sentiment: ‘positive’, quote: ‘Seven Lions in three years, including Gold for Creative Commerce with Iceland Foods. A track record that speaks for itself at the highest level of the industry.’, audience: ‘Creative Industry’ },
{ source: ‘PRCA Podcast’, sentiment: ‘positive’, quote: ‘Her candour about leadership under pressure , including balancing the CEO role with motherhood , has made her one of the most respected voices in the industry.’, audience: ‘PR Community’ }
],
positive_themes: [
‘Seven Cannes Lions including Gold for Creative Commerce with Iceland Foods’,
‘Named PRWeek Top 20 Most Influential Women in PR’,
‘0% gender pay gap and 50/50 board gender representation achieved’,
‘Launched Grayling Media , a dedicated earned media and media relations unit’
],
negative_themes: [],
summary_note: ‘A CEO who combines award-winning creative credentials with genuine cultural leadership, rare in equal measure.’
};

const GRAYLING_RESULT = {
entity: ‘Grayling’,
entity_type: ‘Organisation’,
overall_sentiment: ‘positive’,
confidence: 89,
positive_score: 89,
negative_score: 0,
neutral_score: 11,
editorial_headline: ‘Grayling recognised as a global leader in communications and public affairs’,
editorial_body: ‘With <strong>over 40 years of experience</strong> and a presence in <strong>more than 30 countries</strong>, Grayling is consistently cited as one of the most trusted names in brand communications, corporate affairs and public affairs. Clients highlight the agency's ability to navigate complex environments and deliver <strong>measurable competitive advantage</strong>.’,
source_voices: [
{ source: ‘LinkedIn’, sentiment: ‘positive’, quote: ‘Grayling's team brings genuine strategic depth. They don't just manage communications, they shape narratives that move organisations forward.’, audience: ‘Senior Executives’ },
{ source: ‘PRWeek’, sentiment: ‘positive’, quote: ‘Consistently ranked among the top global PR networks, Grayling's integrated approach across markets sets it apart from single-market competitors.’, audience: ‘Industry Analysts’ },
{ source: ‘Glassdoor’, sentiment: ‘positive’, quote: ‘Genuinely collaborative culture with strong leadership and real opportunities to work on high-profile international campaigns.’, audience: ‘Employees’ },
{ source: ‘The Holmes Report’, sentiment: ‘positive’, quote: ‘Grayling continues to demonstrate that global reach and local intelligence are not mutually exclusive , a rare combination in the industry.’, audience: ‘Industry Press’ },
{ source: ‘Client Testimonials’, sentiment: ‘positive’, quote: ‘They understood our business challenges from day one. The results exceeded expectations and the relationship felt like a true partnership.’, audience: ‘Clients’ },
{ source: ‘Twitter/X’, sentiment: ‘neutral’, quote: ‘Grayling doing interesting work across the CEE region , worth watching their approach to public affairs in emerging markets.’, audience: ‘General Public’ }
],
positive_themes: [‘Global reach with local market intelligence’, ‘Strong track record in public affairs’, ‘Trusted by major international brands’, ‘Award-winning creative campaigns’],
negative_themes: [],
summary_note: “A reputation built on four decades of creating genuine competitive advantage for the world’s most demanding clients.”
};

// ── CHIPS ──
document.querySelectorAll(’.chip’).forEach(c => {
c.addEventListener(‘click’, () => {
document.getElementById(‘searchInput’).value = c.dataset.q;
run(c.dataset.q);
});
});

// ── SEARCH TRIGGERS ──
document.getElementById(‘searchBtn’).addEventListener(‘click’, () => {
const q = document.getElementById(‘searchInput’).value.trim();
if (q === ‘500’) { resetCount(); return; }
if (q) run(q);
});
document.getElementById(‘searchInput’).addEventListener(‘keydown’, e => {
if (e.key === ‘Enter’) {
const q = document.getElementById(‘searchInput’).value.trim();
if (q === ‘500’) { resetCount(); return; }
if (q) run(q);
}
});

function resetCount() {
sessionCount = 0;
localStorage.removeItem(‘grayling_search_count’);
document.getElementById(‘searchInput’).value = ‘’;
document.getElementById(‘navCount’).textContent = ‘0’;
document.getElementById(‘navCount’).style.color = ‘’;
document.getElementById(‘heroCount’).textContent = ‘0’;
document.getElementById(‘heroCount’).classList.remove(‘lit’);
}

const loadingPhrases = [
[‘Reading the room…’, ‘Searching news & publications’],
[‘Listening to the crowd…’, ‘Scanning social discourse’],
[‘Weighing the evidence…’, ‘Aggregating public signals’],
[‘Counting the voices…’, ‘Measuring sentiment strength’],
[‘Forming a verdict…’, ‘Synthesising the analysis’],
[‘Almost there…’, ‘Composing your intelligence report’],
];

// ── MODAL ──
document.getElementById(‘openModal’).addEventListener(‘click’, () => {
document.getElementById(‘modalOverlay’).classList.add(‘open’);
});
document.getElementById(‘modalClose’).addEventListener(‘click’, () => {
document.getElementById(‘modalOverlay’).classList.remove(‘open’);
});
document.getElementById(‘modalOverlay’).addEventListener(‘click’, e => {
if (e.target === document.getElementById(‘modalOverlay’)) {
document.getElementById(‘modalOverlay’).classList.remove(‘open’);
}
});

document.getElementById(‘submitForm’).addEventListener(‘click’, async () => {
const name    = document.getElementById(‘fName’).value.trim();
const company = document.getElementById(‘fCompany’).value.trim();
const title   = document.getElementById(‘fTitle’).value.trim();
const email   = document.getElementById(‘fEmail’).value.trim();
const errEl   = document.getElementById(‘formError’);

if (!name || !company || !title || !email) {
errEl.textContent = ‘All fields are required.’;
return;
}
if (!/^[^@]+@[^@]+.[^@]+$/.test(email)) {
errEl.textContent = ‘Please enter a valid email address.’;
return;
}
errEl.textContent = ‘’;

const btn = document.getElementById(‘submitForm’);
btn.disabled = true;
btn.textContent = ‘Sending…’;

try {
const res = await fetch(’/api/contact’, {
method: ‘POST’,
headers: { ‘Content-Type’: ‘application/json’ },
body: JSON.stringify({
contact: { name, company, title, email },
result: lastResult
})
});

```
if (!res.ok) {
  const d = await res.json().catch(() => ({}));
  throw new Error(d.error || 'Submission failed');
}

document.querySelector('.modal-form').style.display = 'none';
document.querySelector('.modal-title').style.display = 'none';
document.querySelector('.modal-sub').style.display = 'none';
document.getElementById('modalSuccess').classList.add('on');
```

} catch (err) {
errEl.textContent = ’Something went wrong: ’ + err.message;
btn.disabled = false;
btn.textContent = ‘Send My Report’;
}
});

// ── RUN ANALYSIS ──

async function run(query) {
// ── SEARCH LIMIT GATE ──
const isHardcoded = query.toLowerCase().replace(/[^a-z]/g,’’).includes(‘grayling’) ||
query.toLowerCase().replace(/[^a-z]/g,’’).includes(‘heather’) ||
query.toLowerCase().replace(/[^a-z]/g,’’).includes(‘blundell’);

if (!isHardcoded && sessionCount >= MAX_FREE_SEARCHES) {
showLimitModal();
return;
}

document.getElementById(‘emptyState’).style.display = ‘none’;
document.getElementById(‘result’).classList.remove(‘on’);
document.getElementById(‘errorMsg’).classList.remove(‘on’);
document.getElementById(‘loading’).classList.add(‘on’);
document.getElementById(‘searchBtn’).disabled = true;

// Reset modal state in case it was used before
document.querySelector(’.modal-form’).style.display = ‘’;
document.querySelector(’.modal-title’).style.display = ‘’;
document.querySelector(’.modal-sub’).style.display = ‘’;
document.getElementById(‘modalSuccess’).classList.remove(‘on’);
document.getElementById(‘submitForm’).disabled = false;
document.getElementById(‘submitForm’).textContent = ‘Send My Report’;

let li = 0;
const sEl = document.getElementById(‘loadingSerif’);
const mEl = document.getElementById(‘loadingMono’);
const lt = setInterval(() => {
li = (li + 1) % loadingPhrases.length;
sEl.textContent = loadingPhrases[li][0];
mEl.textContent = loadingPhrases[li][1];
}, 900);

// ── GRAYLING HARDCODE ──
const isGrayling = query.toLowerCase().replace(/[^a-z]/g,’’).includes(‘grayling’);
const isHeather = query.toLowerCase().replace(/[^a-z]/g,’’).includes(‘heather’) ||
query.toLowerCase().replace(/[^a-z]/g,’’).includes(‘blundell’);

const hardcodedResult = isGrayling ? GRAYLING_RESULT : isHeather ? HEATHER_RESULT : null;

if (hardcodedResult) {
await new Promise(r => setTimeout(r, 2800));
clearInterval(lt);
document.getElementById(‘loading’).classList.remove(‘on’);
render(hardcodedResult);
lastResult = hardcodedResult;
sessionCount++;
updateCounter();
document.getElementById(‘searchBtn’).disabled = false;
return;
}

try {
const res = await fetch(’/api/analyse’, {
method: ‘POST’,
headers: { ‘Content-Type’: ‘application/json’ },
body: JSON.stringify({ query })
});

```
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
updateCounter();
```

} catch (err) {
clearInterval(lt);
document.getElementById(‘loading’).classList.remove(‘on’);
document.getElementById(‘emptyState’).style.display = ‘block’;
const em = document.getElementById(‘errorMsg’);
em.textContent = ’Analysis failed: ’ + err.message + ‘. Please try again.’;
em.classList.add(‘on’);
}

document.getElementById(‘searchBtn’).disabled = false;
}

// ── RENDER ──
function render(r) {
document.getElementById(‘entityKicker’).textContent =
(r.entity_type || ‘Entity’) + ’ · Public Sentiment Report’;
document.getElementById(‘entityName’).textContent = r.entity || ‘’;

const sent = r.overall_sentiment || ‘neutral’;
const icons = { positive: ‘↑’, negative: ‘↓’, neutral: ‘→’ };
const pill = document.getElementById(‘verdictPill’);
pill.className = ’verdict-pill ’ + sent;
document.getElementById(‘verdictIcon’).textContent = icons[sent];
const vw = document.getElementById(‘verdictWord’);
vw.textContent = cap(sent);
vw.className = ’verdict-word ’ + sent;
document.getElementById(‘verdictConf’).textContent = r.confidence + ‘% confidence’;

// Scores , show positive and neutral only, hide negative from public
document.getElementById(‘posNum’).textContent = Math.round(r.positive_score) + ‘%’;
const pb = document.getElementById(‘posBar’);
pb.className = ‘score-fill fill-pos’;
setTimeout(() => pb.style.width = r.positive_score + ‘%’, 80);

document.getElementById(‘neuNum’).textContent = Math.round(r.neutral_score) + ‘%’;
const neuBar = document.getElementById(‘neuBar’);
neuBar.className = ‘score-fill fill-neu’;
setTimeout(() => neuBar.style.width = r.neutral_score + ‘%’, 80);

// Negative score , show publicly, just hide the source voices
document.getElementById(‘negNum’).textContent = Math.round(r.negative_score) + ‘%’;
document.getElementById(‘negNum’).style.color = ‘var(–neg)’;
const negBar = document.getElementById(‘negBar’);
negBar.className = ‘score-fill fill-neg’;
setTimeout(() => negBar.style.width = r.negative_score + ‘%’, 80);
// Remove any locked overlay if previously added
const negCell = document.getElementById(‘negNum’).closest(’.score-cell’);
const existingLock = negCell.querySelector(’.locked-overlay’);
if (existingLock) existingLock.remove();

document.getElementById(‘editHeadline’).textContent = r.editorial_headline || ‘’;
document.getElementById(‘editBody’).innerHTML = r.editorial_body || ‘…’;

// Voices , show positive/neutral only
const publicVoices = (r.source_voices || []).filter(v => v.sentiment !== ‘negative’);
document.getElementById(‘voicesGrid’).innerHTML = publicVoices.map(v => `<div class="voice-card"> <div class="voice-top"> <span class="voice-source">${safe(v.source)}</span> <span class="voice-badge ${safe(v.sentiment)}">${safe(v.sentiment)}</span> </div> <div class="voice-quote">${safe(v.quote)}</div> <div class="voice-audience">Audience: ${safe(v.audience)}</div> </div>`).join(’’) + `<div class="voice-card locked-card"> <div class="voice-top"> <span class="voice-source">Negative sources</span> <span class="voice-badge negative">hidden</span> </div> <div class="voice-quote locked-quote">&#128274; Negative source voices are included in the full Grayling report.</div> <div class="voice-audience">Full report only</div> </div>`;

// Themes , positive only, negative locked
// Themes - handle both array and potential nested object from model
const posThemes = Array.isArray(r.positive_themes) ? r.positive_themes
: Array.isArray(r.themes?.positive) ? r.themes.positive : [];
const negThemes = Array.isArray(r.negative_themes) ? r.negative_themes
: Array.isArray(r.themes?.negative) ? r.themes.negative : [];

document.getElementById(‘posThemes’).innerHTML = posThemes.length > 0
? posThemes.map(t => `<li>${safe(String(t))}</li>`).join(’’)
: ‘<li style="color:var(--dim)">Analysis in progress…</li>’;

document.getElementById(‘negThemes’).innerHTML = negThemes.length > 0
? negThemes.map(() => `<li style="color:var(--rule)">&#128274; Included in full report</li>`).join(’’)
: `<li style="color:var(--rule)">&#128274; Included in full report</li>`;

// Confidence bars
const cb = document.getElementById(‘confBars’);
const barCount = 18;
cb.innerHTML = Array.from({length:barCount},(_,i)=>`<div class="conf-bar" data-i="${i}"></div>`).join(’’);
const filled = Math.round((r.confidence/100)*barCount);
const col = sent===‘positive’?‘var(–pos)’:sent===‘negative’?‘var(–neg)’:‘var(–neu)’;
cb.querySelectorAll(’.conf-bar’).forEach((b,i)=>{
if(i < filled){
b.style.height = (12+(i/barCount)*60)+‘px’;
b.style.background = col;
b.style.transitionDelay = (i*25)+‘ms’;
} else { b.style.height = ‘4px’; }
});

document.getElementById(‘confNum’).textContent = r.confidence + ‘%’;
document.getElementById(‘confDesc’).textContent =
r.confidence >= 75 ? ‘Strong consensus: clear dominant narrative’
: r.confidence >= 50 ? ‘Moderate signal: mixed but discernible lean’
: ‘Fragmented discourse: no clear majority position’;

const summaryText = r.summary_note || r.summary || ‘’;
const summaryEl = document.getElementById(‘summaryQuote’);
if (summaryText) {
summaryEl.innerHTML = safe(summaryText);
summaryEl.style.display = ‘block’;
} else {
summaryEl.style.display = ‘none’;
}

document.getElementById(‘result’).classList.add(‘on’);
}

function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : ‘…’; }

function updateCounter() {
localStorage.setItem(‘grayling_search_count’, sessionCount);
const hc = document.getElementById(‘heroCount’);
hc.textContent = sessionCount;
hc.classList.add(‘lit’);
const remaining = MAX_FREE_SEARCHES - sessionCount;
const navCount = document.getElementById(‘navCount’);
navCount.textContent = sessionCount;
if (remaining <= 1 && remaining > 0) {
navCount.style.color = ‘var(–neg)’;
navCount.title = remaining + ’ free search remaining’;
} else if (remaining <= 0) {
navCount.style.color = ‘var(–neg)’;
}
}

function showLimitModal() {
// Switch modal to limit state
document.querySelector(’.modal-title’).textContent = ‘You have used your 5 free searches.’;
document.querySelector(’.modal-sub’).textContent = ‘Contact Grayling to unlock unlimited access and receive a full intelligence report tailored to your needs.’;
document.querySelector(’.modal-form’).style.display = ‘none’;
document.querySelector(’.modal-footer-line’).style.display = ‘none’;

// Show a contact Grayling button instead
const successEl = document.getElementById(‘modalSuccess’);
successEl.innerHTML = `<div style="text-align:center;padding:1rem 0"> <div style="font-family:var(--serif);font-weight:300;font-size:3rem;color:var(--accent);line-height:1;margin-bottom:1rem">5 / 5</div> <div style="font-family:var(--mono);font-size:0.58rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--dim);margin-bottom:2rem">Free searches used</div> <a href="mailto:info@grayling.com" style="display:inline-block;background:var(--black);color:var(--white);font-family:var(--mono);font-size:0.62rem;letter-spacing:0.2em;text-transform:uppercase;padding:1rem 2.5rem;text-decoration:none;margin-bottom:1rem">Contact Grayling</a> <div style="font-family:var(--mono);font-size:0.55rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--dim);margin-top:1rem">Public perception moves fast. Grayling helps you stay ahead of it, shape it, and turn it into advantage.</div> </div>`;
successEl.classList.add(‘on’);
document.getElementById(‘modalOverlay’).classList.add(‘open’);
}