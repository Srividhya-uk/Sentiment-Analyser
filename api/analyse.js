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
        `https://serpapi.com/search.json?q=${encodeURIComponent(query + ' public opinion news reputation')}&num=8&hl=en&gl=uk&api_key=${serpKey}`
      );
      if (serpRes.ok) {
        const serpData = await serpRes.json();
        const results = serpData.organic_results || [];
        // Extract titles and snippets to give Groq real context
        webContext = results
          .slice(0, 8)
          .map((r, i) => `[${i + 1}] ${r.title}: ${r.snippet || ''}`)
          .join('\n');
      }
    } catch (e) {
      // SerpAPI failed — continue without web context
      webContext = '';
    }
  }

  // ── STEP 2: BUILD PROMPT WITH WEB CONTEXT ──
  const contextBlock = webContext
    ? `\nREAL WEB SEARCH RESULTS (use these as your primary source of truth):\n${webContext}\n\nAnalyse sentiment based on these real results above. Do not invent facts not supported by these results.`
    : '\nNote: No web search results available. Use your training knowledge carefully and flag uncertainty.';

  const prompt = `You are a world-class public sentiment analyst. Analyse extensively to figure the REAL public sentiment around "${query}" right now.
${contextBlock}

Based on the search results above, return ONLY a valid JSON object. No markdown, no preamble:

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
