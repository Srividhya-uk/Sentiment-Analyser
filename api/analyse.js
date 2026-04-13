// ── RATE LIMITER ──
const RATE_LIMIT = 20;
const WINDOW_MS  = 60 * 60 * 1000; // 1 hour
const ipStore    = new Map();

function isRateLimited(ip) {
  const now   = Date.now();
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
        temperature: 0.1,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a precise, senior public sentiment and reputation analyst. You produce structured JSON intelligence briefings based on publicly available information — news coverage, industry reporting, LinkedIn presence, published work, portfolio signals, employee review platforms, regulatory history, social discourse, and analyst commentary.

STEP 1 — IDENTIFY THE ENTITY:
Before scoring anything, ask yourself these questions about this specific entity:
- Is this a public figure, a brand, an organisation, or a private professional?
- How prominent is their public digital footprint — are they widely covered or barely findable?
- What industry or domain are they in, and how much public discourse exists in that space?
- How senior or visible is their role — founder, C-suite, mid-level, emerging?
- Do they have published work, press mentions, speaking engagements, or awards on public record?
- Have they been involved in any controversy, criticism, or notable professional setbacks?
- What do people in their professional orbit — peers, clients, employers, the public — actually say or signal about them?

STEP 2 — SCORE BASED ON THIS SPECIFIC ENTITY ONLY:
Your scores must be derived entirely from your answers to the questions above — not from any category template.
- Two people who are both "senior creatives" will have completely different scores if one has a strong public presence and the other does not.
- Two brands in the same sector will score differently based on their specific controversy, trust, and reputation history.
- Do not apply a group score. Reason from the individual.
- positive_score + negative_score + neutral_score must equal exactly 100.
- Use specific, uneven numbers that reflect the actual signal — e.g. 62/18/20, 34/51/15, 71/8/21, 48/37/15, 57/23/20.
- Never output a balanced or round split. 40/30/30, 33/33/34, 40/20/40, 50/25/25 are signs you have not reasoned about the individual.

STEP 3 — CONFIDENCE:
- Confidence must reflect how much genuine public signal exists for this specific entity.
- A well-known controversial CEO: 80–90.
- A senior professional with solid LinkedIn presence and some press: 50–62.
- A mid-level professional with limited public footprint: 45–52.
- An emerging or junior figure with minimal public record: 38–47.
- Never assign the same confidence to two people with clearly different levels of public visibility.

STEP 4 — SOURCE VOICES:
- Choose audience types that are genuinely relevant to this specific entity.
- Do not use a generic list — think about who actually has an opinion on this person or entity.
- Include at least one critical or cautionary voice where any public scrutiny exists.
- Write quotes as realistic, candid perspectives — not press release language.

STEP 5 — EDITORIAL:
- editorial_headline: one neutral factual headline specific to this entity. No superlatives.
- editorial_body: 3–4 sentences. Analyst register. Specific to this entity — do not write generically. Must address both strengths and real limitations or challenges.
- negative_themes: must always be populated. Every entity has competitive pressure, perception gaps, or areas of scrutiny. Find them for this specific person or organisation.
- summary_note: one honest sentence capturing where this specific entity's reputation stands.

OUTPUT: valid JSON only. No markdown. No explanation. No preamble.`
          },
          {
            role: 'user',
            content: `Analyse public sentiment and reputation for: "${query}"

Work through what you know about this specific entity before assigning any scores. Do not apply a category template — reason from what is individually known or inferable about this particular person, brand, or organisation.

Return a JSON object with exactly these fields:

{
  "entity": "name of the entity",
  "entity_type": "one of: Person, Organisation, Brand, Product, Concept, Place",
  "overall_sentiment": "one of: positive, negative, neutral",
  "confidence": <integer 0-100>,
  "positive_score": <integer 0-100>,
  "negative_score": <integer 0-100>,
  "neutral_score": <integer 0-100>,
  "editorial_headline": "single neutral analyst-style headline specific to this entity",
  "editorial_body": "3-4 sentence analyst briefing specific to this entity — not generic — addressing both strengths and real limitations or criticism",
  "source_voices": [
    {
      "source": "audience type most relevant to this specific entity",
      "sentiment": "positive or negative or neutral",
      "quote": "realistic candid perspective from this audience based on what is known about this entity",
      "audience": "brief description of who this represents"
    }
  ],
  "positive_themes": ["specific positive driver for this entity", "...up to 4"],
  "negative_themes": ["specific negative driver or challenge for this entity", "...up to 4 — must be populated"],
  "summary_note": "one honest sentence about where this specific entity's reputation stands"
}

Hard rules:
- positive_score + negative_score + neutral_score = 100 exactly
- Scores must be specific and uneven — never a round balanced split
- Scores must be derived from reasoning about this individual entity, not a group template
- source_voices: 4 to 6 entries, at least one must be critical or cautionary
- negative_themes must always be populated
- Do not invent specific facts. Do not omit real criticism. Do not default to any preset pattern.`
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
