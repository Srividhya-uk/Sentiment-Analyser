export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const groqKey = process.env.GROQ_API_KEY;
  const serpKey = process.env.SERP_API_KEY;

  if (!groqKey) return res.status(500).json({ error: 'Groq API key not configured' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'No query provided' });

  // ── STEP 1: SERP SEARCH ──
  let webContext = '';
  if (serpKey) {
    try {
      const serpRes = await fetch(
        `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=10&hl=en&gl=uk&api_key=${serpKey}`
      );
      if (serpRes.ok) {
        const serpData = await serpRes.json();
        const results = [
          ...(serpData.organic_results || []),
          ...(serpData.news_results || [])
        ].slice(0, 10);

        if (results.length > 0) {
          webContext = results
            .map((r, i) => `[${i + 1}] ${r.title} (${r.source || r.displayed_link || 'web'}): ${r.snippet || r.description || ''}`)
            .join('\n');
        }
      }
    } catch (e) {
      webContext = '';
    }
  }

  // ── STEP 2: BUILD PROMPT ──
  const hasContext = webContext.trim().length > 0;
  const contextBlock = hasContext
    ? `\nWEB SEARCH RESULTS for "${query}":\n${webContext}`
    : `\nNo web results found for "${query}".`;

  const prompt = `You are a world-class public sentiment analyst. Using the web search results below, analyse what the public search data reveals about "${query}".

${contextBlock}

Your job: read the search results and determine what overall sentiment the public has toward "${query}" based purely on what these results show. The results are the voice of public opinion — news coverage, reviews, discussions, and commentary all signal how people feel.

If the results show no meaningful public profile (private individual, unknown entity), say so honestly in editorial_body and return low confidence neutral scores.

Return ONLY a valid JSON object. No markdown, no preamble:

{
  "entity": "${query}",
  "entity_type": "<exactly one of: Company | Brand | Person | Concept | Technology | Organisation | Product | Country | Movement>",
  "overall_sentiment": "<positive | negative | neutral>",
  "confidence": <integer 0-100 — how clearly the search results signal one sentiment>,
  "positive_score": <integer — percentage of positive signals in search results>,
  "negative_score": <integer — percentage of negative signals in search results>,
  "neutral_score": <integer — percentage of neutral/factual signals>,
  "editorial_headline": "<what the search results tell us about ${query} in max 14 words, sentence case>",
  "editorial_body": "<2-3 sentences reading the search results as sentiment signals. Wrap 2-4 key facts in <strong> tags. Be specific about what the results show. Max 80 words.>",
  "source_voices": [
    {
      "source": "<platform suggested by search results e.g. Reddit | Twitter/X | BBC | Guardian | TrustPilot | LinkedIn | YouTube | TechCrunch>",
      "sentiment": "<positive | negative | neutral>",
      "quote": "<what that audience is saying based on search result snippets. Max 28 words.>",
      "audience": "<who is talking: Fans | Customers | Critics | General Public | Industry | Employees>"
    }
  ],
  "positive_themes": ["<theme from results>", "<theme>", "<theme>", "<theme>"],
  "negative_themes": ["<theme from results>", "<theme>", "<theme>", "<theme>"],
  "summary_note": "<One sentence summarising what the search data reveals. Max 20 words.>"
}

RULES:
- positive_score + negative_score + neutral_score = exactly 100
- Scores must reflect the actual balance of the search results — not assumptions
- Include exactly 6 source_voices derived from what the results suggest
- Never invent facts not present in or implied by the search results`;

{
  "entity": "${query}",
  "entity_type": "<exactly one of: Company | Brand | Person | Concept | Technology | Organisation | Product | Country | Movement>",
  "overall_sentiment": "<positive | negative | neutral>",
  "confidence": <integer — how clearly one sentiment dominates. Must reflect the search results, not default to 80>,
  "positive_score": <integer — real percentage based on search results. Not a round number unless accurate>,
  "negative_score": <integer — real percentage based on search results>,
  "neutral_score": <integer — remaining percentage>,
  "editorial_headline": "<punchy headline referencing real facts from search results. Max 14 words, sentence case>",
  "editorial_body": "<2-3 sentences grounded in the search results above. Wrap 2-4 key real facts in <strong> tags. Be specific. Max 80 words.>",
  "source_voices": [
    {
      "source": "<specific platform: Financial Times | Reddit | Bloomberg | The Guardian | LinkedIn | Trustpilot | Glassdoor | TechCrunch | Twitter/X | BBC>",
      "sentiment": "<positive | negative | neutral>",
      "quote": "<realistic paraphrase of what that audience actually says based on search results. Max 28 words.>",
      "audience": "<specific audience type>"
    }
  ],
  "positive_themes": ["<specific theme from search results>", "<theme>", "<theme>", "<theme>"],
  "negative_themes": ["<specific theme from search results>", "<theme>", "<theme>", "<theme>"],
  "summary_note": "<One sharp editorial sentence referencing a specific real fact from search results. Max 20 words.>"
}

RULES:
- positive_score + negative_score + neutral_score = exactly 100
- Derive all scores from the actual search results provided, not from assumptions
- Include exactly 6 source_voices with realistic mix of sentiments
- Never invent facts not supported by search results
- summary_note must reference something specific from the search results`;

  // ── STEP 3: GROQ ANALYSIS ──
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a world-class public sentiment analyst. You return only valid JSON based strictly on the web search results provided. Never invent facts.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2048,
        top_p: 0.9,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: 'Groq API error', detail: err });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Could not parse model response', raw: text });
    }

    let jsonStr = jsonMatch[0];
    jsonStr = jsonStr.replace(/,(\s*[\]}])/g, '$1');
    jsonStr = jsonStr.replace(/:\s*"([^"]*)\n([^"]*)"/g, ': "$1 $2"');

    try {
      JSON.parse(jsonStr);
    } catch(e) {
      const opens = (jsonStr.match(/\[/g) || []).length;
      const closes = (jsonStr.match(/\]/g) || []).length;
      const openBrace = (jsonStr.match(/\{/g) || []).length;
      const closeBrace = (jsonStr.match(/\}/g) || []).length;
      jsonStr = jsonStr.replace(/,\s*$/, '');
      jsonStr = jsonStr.replace(/,\s*"[^"]*$/, '');
      for (let i = 0; i < opens - closes; i++) jsonStr += ']';
      for (let i = 0; i < openBrace - closeBrace; i++) jsonStr += '}';
    }

    const result = JSON.parse(jsonStr);
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
