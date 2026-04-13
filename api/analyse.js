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

ENTITY TYPE HANDLING:

For PUBLIC FIGURES, BRANDS, and ORGANISATIONS:
- Draw on news coverage, industry press, analyst commentary, regulatory record, employee sentiment, consumer reviews, and social discourse.
- Represent both positive AND negative sentiment honestly. Almost every public entity has documented criticism — find it and include it.
- Do not default to positive framing. Do not soften or omit negatives.
- confidence: 65–95 depending on how clearly and consistently public sentiment can be determined.

For PRIVATE INDIVIDUALS with some public presence (professionals, executives, creatives, founders):
- Analyse their professional reputation based on discoverable public signals: LinkedIn presence, published articles or work, portfolio, industry mentions, speaking engagements, company affiliations, press coverage.
- Frame source_voices around professional stakeholder perspectives: Professional Network, Industry Peers, Clients or Collaborators, Published Work Audience, Employer or Agency Community.
- Be realistic and grounded — report what their public professional footprint suggests about their reputation.
- confidence: 45–65 range. Moderate confidence is appropriate — there is signal, but it is narrower than a public figure.
- Do not fabricate specific awards, statistics, or named incidents. Do generalise from their known professional domain and role.
- negative_themes for private individuals should reflect realistic professional challenges or perception gaps in their field — not invented controversies.

FOR ALL ENTITIES:
- Do not fabricate specific events, statistics, or named incidents you cannot verify from widely known public record.
- If uncertain about a specific detail, generalise it honestly rather than inventing it.
- Do not leave negative_themes empty — every professional or public entity faces some form of scrutiny, competition, or perception challenge. Identify it honestly.
- positive_score + negative_score + neutral_score must equal exactly 100.

SOURCE VOICES:
- Label by audience type appropriate to the entity: Industry Press, Employees, Customers, Investors, Regulators, General Public, Professional Network, Industry Peers, Clients, Published Work Audience.
- Include at least one critical or cautionary voice.
- Write quotes as realistic, candid perspectives — not press release language.

EDITORIAL:
- editorial_headline: one neutral factual headline. No superlatives.
- editorial_body: 3–4 sentences. Analyst register. Must address both positive reputation signals and real limitations, challenges, or areas of scrutiny.
- summary_note: one honest sentence capturing where reputation or sentiment actually stands.

OUTPUT: valid JSON only. No markdown. No explanation. No preamble.`
          },
          {
            role: 'user',
            content: `Analyse public sentiment and reputation for: "${query}"

First determine whether this is a public figure, brand, organisation, or private individual with a professional public presence, and calibrate your analysis accordingly.

Return a JSON object with exactly these fields:

{
  "entity": "name of the entity",
  "entity_type": "one of: Person, Organisation, Brand, Product, Concept, Place",
  "overall_sentiment": "one of: positive, negative, neutral",
  "confidence": <integer 0-100>,
  "positive_score": <integer 0-100>,
  "negative_score": <integer 0-100>,
  "neutral_score": <integer 0-100>,
  "editorial_headline": "single neutral analyst-style headline — no superlatives",
  "editorial_body": "3-4 sentence analyst briefing addressing both positive reputation signals and documented limitations, challenges, or areas of scrutiny",
  "source_voices": [
    {
      "source": "audience type label appropriate to this entity",
      "sentiment": "positive or negative or neutral",
      "quote": "realistic candid perspective from this audience based on known public or professional sentiment",
      "audience": "brief description of who this represents"
    }
  ],
  "positive_themes": ["documented positive reputation driver 1", "...up to 4"],
  "negative_themes": ["documented or realistic negative driver 1", "...up to 4 — must be populated"],
  "summary_note": "one honest sentence capturing where reputation stands including any nuance, limitation, or caveat"
}

Hard rules:
- positive_score + negative_score + neutral_score = 100 exactly
- source_voices: 4 to 6 entries, must include at least one critical or cautionary voice
- negative_themes must always be populated — reflect real criticism, competitive pressure, perception gaps, or professional challenges
- For private individuals: confidence between 45–65, frame around professional reputation not public fame
- For public figures and brands: confidence 65–95 based on clarity of public signal
- Do not invent facts. Do not omit real criticism. Do not default to positive.`
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
