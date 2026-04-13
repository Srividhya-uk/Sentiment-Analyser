// ── RATE LIMITER ──
// Simple in-memory store: { ip -> { count, windowStart } }
// Resets per IP after WINDOW_MS. Serverless: resets on cold start (acceptable).
const RATE_LIMIT = 20;          // max requests per window per IP
const WINDOW_MS  = 60 * 60 * 1000; // 1 hour
const ipStore    = new Map();

function isRateLimited(ip) {
  const now  = Date.now();
  const entry = ipStore.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    ipStore.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit by IP (x-forwarded-for for proxied environments)
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0].trim();
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return res.status(500).json({ error: 'No API key' });

  const query = req.body && req.body.query;
  if (!query) return res.status(400).json({ error: 'No query' });

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + groqKey
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        max_tokens: 2048,
        messages: [
          {
            role: 'system',
            content: `You are a senior public sentiment analyst producing structured intelligence briefings. You have deep knowledge of public discourse, media coverage, and reputational signals up to your training cutoff.

ACCURACY RULES — these are non-negotiable:
- Only report on sentiment that is genuinely, widely documented in public discourse.
- Do not invent, fabricate, or extrapolate specific events, incidents, awards, statistics, dates, named campaigns, or quotes.
- Do not attribute quotes to specific publications or platforms unless you are certain that publication has covered this entity substantively.
- Do not assume positive sentiment for well-known brands. Report what is actually true.
- If an entity is a private individual, niche business, or otherwise not prominently covered in public discourse, you must reflect that honestly — do not fill gaps with plausible-sounding fiction.
- If you are uncertain about something, omit it. Never include it to make the output seem more complete.

SENTIMENT SCORING RULES:
- Scores must reflect the genuine balance of public discourse, not an idealised version.
- Controversial, divisive, or crisis-affected entities must have this reflected in their negative_score.
- confidence must reflect how clearly and consistently public sentiment can be determined. Private individuals, niche entities, or those with limited public coverage must score below 45. Do not default to high confidence.
- positive_score, negative_score, and neutral_score must sum to exactly 100.

SOURCE VOICES RULES:
- source_voices represent distinct audience or stakeholder perspectives — not fabricated quotes from named outlets.
- The source field should describe the audience type (e.g. 'Industry Media', 'Customers', 'Employees', 'Regulators', 'General Public', 'Investors') not a specific publication name.
- The quote field should be a plausible representative sentiment from that audience type — written in a neutral, realistic register, not promotional language.
- If a particular audience type has no meaningful documented sentiment toward this entity, omit that voice entirely rather than inventing one.

EDITORIAL RULES:
- editorial_headline must be a neutral, factual summary statement — not a marketing headline or superlative claim.
- editorial_body must read like an analyst briefing: measured, evidence-grounded, balanced. It should acknowledge complexity where it exists.
- summary_note must be an honest one-sentence characterisation of where public sentiment actually stands, including any ambiguity or division.

UNKNOWN OR LOW-PROFILE ENTITIES:
- If the entity is not sufficiently covered in public discourse to produce a reliable analysis, set overall_sentiment to 'neutral', confidence to below 35, and use summary_note to clearly state that public sentiment data is limited or unavailable for this entity.
- Do not fabricate analysis to fill the response.

Respond with valid JSON only. No markdown, no explanation, no preamble.`
          },
          {
            role: 'user',
            content: `Analyse public sentiment for: "${query}".

Return JSON with exactly these fields:
- entity (string): the name of the entity as you best understand it
- entity_type (string): one of — Person, Organisation, Brand, Product, Concept, Place
- overall_sentiment (string): one of — positive, negative, neutral
- confidence (integer 0–100): how clearly and consistently public sentiment can be determined; must be low for private, niche, or ambiguous entities
- positive_score (integer 0–100)
- negative_score (integer 0–100)
- neutral_score (integer 0–100)
- scores must sum to exactly 100
- editorial_headline (string): a single neutral analyst-style summary headline, no superlatives
- editorial_body (string): 2–4 sentence analyst briefing; balanced, grounded, acknowledges complexity; may use <strong> tags for key facts only
- source_voices (array of up to 6 objects): each with — source (audience type, not a publication name), sentiment (positive/negative/neutral), quote (realistic representative sentiment from that audience, not a fabricated citation), audience (brief description of who this perspective represents). Only include voices where genuine documented sentiment exists.
- positive_themes (array of up to 4 strings): real documented drivers of positive sentiment; omit if none are known
- negative_themes (array of up to 4 strings): real documented drivers of negative sentiment; omit if none are known
- summary_note (string): one honest sentence on where sentiment actually stands, including any significant ambiguity or division`
          }
        ]
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return res.status(groqRes.status).json({ error: 'Groq error', detail: errText });
    }

    const data = await groqRes.json();
    const content = data.choices[0].message.content;
    const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(clean);
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
