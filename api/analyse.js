// ── RATE LIMITER ──
const RATE_LIMIT = 20;
const WINDOW_MS  = 60 * 60 * 1000;
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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) {
    return { statusCode: 429, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Too many requests. Please try again later.' }) };
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'No API key configured' }) };
  }

  let query;
  try {
    const body = JSON.parse(event.body || '{}');
    query = body.query;
  } catch (e) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!query) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'No query provided' }) };
  }

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

STEP 1 — ASSESS DIGITAL FOOTPRINT SIZE FIRST:
Before anything else, estimate how large and visible this entity's public digital footprint is. This is the primary driver of your scores for private individuals.

Ask yourself:
- Can I find this person clearly in public sources — LinkedIn, press, portfolio, publications, speaking events?
- How many distinct public signals exist? One LinkedIn profile is minimal. Multiple press mentions, a portfolio site, speaking credits, published work = substantial.
- Are they a recognised name in their industry or largely unknown outside their immediate circle?
- How senior, long-tenured, or publicly active are they in their domain?

Then assign a FOOTPRINT LEVEL:
- EXTENSIVE: widely covered public figure, brand, or organisation — scores 65–95 confidence, positive_score reflects actual public sentiment
- STRONG: senior professional with clear press mentions, published work, active public presence — confidence 58–65, positive_score 55–68
- MODERATE: professional with solid LinkedIn, some mentions, known in their circle — confidence 50–57, positive_score 44–54
- LIMITED: professional with minimal public record, little beyond a LinkedIn profile — confidence 40–49, positive_score 32–43
- MINIMAL: virtually no discoverable public presence — confidence 30–39, positive_score 25–35

This footprint level must directly determine your scores. Two people at MODERATE will still differ from each other based on what specifically is known about them — do not apply identical scores to any two entities.

STEP 2 — SCORE PRECISELY FOR THIS SPECIFIC ENTITY:
- positive_score reflects both the sentiment quality AND the footprint size. A well-regarded person with LIMITED footprint scores lower than a well-regarded person with STRONG footprint — because less signal means less confirmable positive reputation.
- negative_score reflects documented criticism, controversy, or professional challenges specific to this person or their domain.
- neutral_score covers the portion of discourse that is observational, ambiguous, or unresolved.
- For MINIMAL and LIMITED footprint individuals: negative_score should be low (10–18%) because there is no documented criticism — unknown does not mean criticised. neutral_score should be high (35–55%) to absorb the uncertainty.
- For MODERATE footprint individuals: negative_score reflects real professional headwinds and competitive challenges in their domain (15–25%). neutral_score 20–35%.
- For STRONG footprint individuals: negative_score reflects documented professional criticism, setbacks, or scrutiny (18–30%). neutral_score 15–25%.
- For EXTENSIVE footprint public figures and brands: negative_score reflects actual public controversy, criticism, and opposition (varies — could be 10% for beloved brands or 60% for divisive figures). neutral_score reflects genuinely undecided discourse.
- Never let negative_score rise simply because someone is unknown or hard to find. Unknown = high neutral, not high negative.
- positive_score + negative_score + neutral_score = exactly 100.
- Use specific uneven numbers — never 40/30/30, 33/33/34, 50/25/25, or any round balanced split.

STEP 3 — WRITE RICH, DOMAIN-SPECIFIC CONTENT:
For private individuals especially, the editorial and source voices must be substantive and specific to their actual domain, role, and industry — not generic filler.

- Do NOT write: "Jayashree is known for her kindness" — this is useless filler.
- DO write about: their specific professional domain, what people in that industry actually value, what challenges professionals at their level face, what their public work or presence signals about their positioning.
- Source voices should reflect real stakeholder types who would genuinely have an opinion — industry peers, clients, employers, recruiters, community members in their specific field.
- Quotes should sound like something a real professional in that space would say — specific, grounded, not generic praise.

STEP 4 — CONFIDENCE:
- Confidence tracks directly with footprint size (see STEP 1 levels).
- Never give two people with clearly different visibility levels the same confidence score.

STEP 5 — NEGATIVES MUST BE REAL AND SPECIFIC:
- negative_themes must always be populated.
- For private individuals, negatives should reflect real professional challenges in their domain: market competition, visibility gaps, niche limitations, career transition risks, perception gaps between expertise and public profile.
- Do not invent personal controversies. Do reflect honest professional headwinds.

OUTPUT: valid JSON only. No markdown. No explanation. No preamble.`
          },
          {
            role: 'user',
            content: `Analyse public sentiment and reputation for: "${query}"

First assess their digital footprint size (Extensive / Strong / Moderate / Limited / Minimal) based on what you can determine about their public presence. Let that footprint level directly drive your confidence and positive_score before anything else.

Then build the full analysis around what is specifically known or inferable about this particular entity — their domain, role, industry, public work, and professional standing.

Return a JSON object with exactly these fields:

{
  "entity": "name of the entity",
  "entity_type": "one of: Person, Organisation, Brand, Product, Concept, Place",
  "overall_sentiment": "one of: positive, negative, neutral",
  "confidence": <integer 0-100>,
  "positive_score": <integer 0-100>,
  "negative_score": <integer 0-100>,
  "neutral_score": <integer 0-100>,
  "editorial_headline": "single neutral analyst-style headline specific to this entity and their domain",
  "editorial_body": "3-4 sentences specific to this entity — their actual industry, role, public work, and professional standing. Not generic. Must address both strengths and real professional limitations.",
  "source_voices": [
    {
      "source": "specific audience type relevant to this entity's domain and industry",
      "sentiment": "positive or negative or neutral",
      "quote": "realistic, domain-specific perspective — sounds like a real professional in this space, not generic praise or filler",
      "audience": "brief description of who this represents"
    }
  ],
  "positive_themes": ["specific positive driver grounded in their domain and public presence", "...up to 4"],
  "negative_themes": ["specific professional challenge, visibility gap, or domain headwind for this entity", "...up to 4 — must be populated"],
  "summary_note": "one honest sentence about where this specific entity's reputation stands, including any nuance"
}

Hard rules:
- positive_score + negative_score + neutral_score = 100 exactly
- Footprint size must drive scores — a person with minimal online presence scores lower than one with strong press coverage, even if both are well-regarded
- Scores must be specific and uneven — never a round balanced split
- source_voices: 4 to 6 entries, domain-specific, at least one critical or cautionary
- negative_themes must always be populated with real professional challenges
- No generic filler in quotes or editorial — every sentence must be specific to this entity`
          }
        ]
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return { statusCode: groqRes.status, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Groq error', detail: errText }) };
    }

    const data = await groqRes.json();
    const content = data.choices[0].message.content;
    const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(clean);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) };

  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
