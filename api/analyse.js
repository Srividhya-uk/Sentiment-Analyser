export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.NVIDIA_API_KEY || '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';

  const { query, model } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'No query provided' });
  }

  const prompt = `You are a senior public sentiment analyst. Produce a rigorous analysis of PUBLIC SENTIMENT around "${query}" based on real knowledge of news, social media, analyst commentary, consumer reviews, and public opinion.

Return ONLY a valid JSON object with no markdown fences, no preamble, no trailing text:

{
  "entity": "${query}",
  "entity_type": "<exactly one of: Company | Brand | Person | Concept | Technology | Organisation | Product | Country | Movement>",
  "overall_sentiment": "<positive | negative | neutral>",
  "confidence": <integer 0-100>,
  "positive_score": <integer 0-100>,
  "negative_score": <integer 0-100>,
  "neutral_score": <integer 0-100>,
  "editorial_headline": "<a sharp, editorial-style headline, max 14 words, sentence case, no quotes, captures the dominant public narrative>",
  "editorial_body": "<2-3 sentences of incisive editorial analysis. Wrap 2-4 key specific facts/phrases in <strong> tags. Cite real events, trends, or shifts. Max 80 words. Be precise, not generic.>",
  "source_voices": [
    {
      "source": "<realistic media/platform type e.g. Financial Times | Reddit | Bloomberg | The Guardian | LinkedIn | Trustpilot | Glassdoor | TechCrunch | Twitter/X | YouTube>",
      "sentiment": "<positive | negative | neutral>",
      "quote": "<a realistic, plausible 1 to 2 sentence paraphrase of how that platform audience discusses ${query}. Grounded in real discourse. Max 28 words.>",
      "audience": "<e.g. Investors | General Public | Tech Community | Employees | Customers | Analysts>"
    }
  ],
  "positive_themes": ["<theme 1>", "<theme 2>", "<theme 3>", "<theme 4>"],
  "negative_themes": ["<theme 1>", "<theme 2>", "<theme 3>", "<theme 4>"],
  "summary_note": "<One precise, evocative sentence, max 20 words, capturing the single most telling insight about current public perception>"
}

Hard rules:
- positive_score + negative_score + neutral_score must equal exactly 100
- Include exactly 6 source_voices with a realistic mix of sentiments
- All analysis must reflect genuine, accurate public opinion, not invented sentiment
- summary_note must read like an editor's note, not a report conclusion`;

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-4-340b-instruct',
        messages: [
          {
            role: 'system',
            content: 'You are a world-class public sentiment analyst. You return only valid JSON, never markdown, never explanation, never preamble.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: 'NVIDIA API error', detail: err });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    // Strip any markdown fences if model adds them
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(500).json({ error: 'Could not parse model response', raw: text });
    }

    const result = JSON.parse(jsonMatch[0]);

    // CORS header so the browser frontend can call this
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
