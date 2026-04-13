export default async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'No query provided' });
  }

  const prompt = `You are a world-class public sentiment analyst with deep knowledge of media, social platforms, and public opinion. Analyse the REAL public sentiment around "${query}" right now.

CRITICAL: Think carefully about ${query} specifically. What do you actually know about how the public perceives this entity? What controversies, praise, criticism, or events have shaped opinion? Use that knowledge to produce ACCURATE, SPECIFIC scores — not generic averages.

Return ONLY a valid JSON object. No markdown, no preamble:

{
  "entity": "${query}",
  "entity_type": "<exactly one of: Company | Brand | Person | Concept | Technology | Organisation | Product | Country | Movement>",
  "overall_sentiment": "<positive | negative | neutral>",
  "confidence": <integer — how clearly one sentiment dominates. High polarisation = lower confidence. Very clear consensus = higher. Must reflect reality, not default to 80>,
  "positive_score": <integer — real percentage of positive public sentiment. Must NOT be a round number like 60, 70, 80 unless genuinely accurate>,
  "negative_score": <integer — real percentage of negative public sentiment>,
  "neutral_score": <integer — remaining percentage>,
  "editorial_headline": "<punchy, specific headline — name real events, controversies or trends. NOT generic. Max 14 words, sentence case>",
  "editorial_body": "<2-3 sentences. MUST reference specific real events, product launches, controversies, people, or data points about ${query}. Wrap 2-4 key facts in <strong> tags. Be a journalist, not a press release writer. Max 80 words.>",
  "source_voices": [
    {
      "source": "<specific platform: Financial Times | Reddit | Bloomberg | The Guardian | LinkedIn | Trustpilot | Glassdoor | TechCrunch | Twitter/X | Consumer Reports>",
      "sentiment": "<positive | negative | neutral>",
      "quote": "<write what that specific audience ACTUALLY says about ${query} — reference real concerns or praise. Max 28 words. Sound like a real person, not a survey.>",
      "audience": "<specific audience: Retail Investors | Gen Z Users | Enterprise Customers | Former Employees | Industry Analysts>"
    }
  ],
  "positive_themes": ["<specific theme with detail>", "<specific theme>", "<specific theme>", "<specific theme>"],
  "negative_themes": ["<specific theme with detail>", "<specific theme>", "<specific theme>", "<specific theme>"],
  "summary_note": "<One sharp sentence a seasoned editor would write. Reference something specific. Max 20 words.>"
}

- positive_score + negative_score + neutral_score = exactly 100
- NEVER use 80/10/10, 70/20/10 or other suspiciously round splits — derive scores from actual public opinion
- Include exactly 6 source_voices, mix of sentiments reflecting reality
- Confidence must reflect genuine certainty, not default to 80
- Every field must be specific to ${query}, never generic filler
- summary_note must name something real and specific about ${query}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
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

    // Clean markdown fences
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Extract JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Could not parse model response', raw: text });
    }

    let jsonStr = jsonMatch[0];

    // Repair common JSON issues from LLM output:
    // 1. Remove trailing commas before ] or }
    jsonStr = jsonStr.replace(/,(\s*[\]}])/g, '$1');
    // 2. Fix unescaped newlines inside strings
    jsonStr = jsonStr.replace(/:\s*"([^"]*)\n([^"]*)"/g, ': "$1 $2"');
    // 3. Truncate if model hit token limit mid-array — close open structures
    try {
      JSON.parse(jsonStr);
    } catch(e) {
      // Try to close any open arrays/objects by counting brackets
      const opens = (jsonStr.match(/\[/g) || []).length;
      const closes = (jsonStr.match(/\]/g) || []).length;
      const openBrace = (jsonStr.match(/\{/g) || []).length;
      const closeBrace = (jsonStr.match(/\}/g) || []).length;
      // Remove last incomplete element (trailing comma or partial string)
      jsonStr = jsonStr.replace(/,\s*$/, '');
      jsonStr = jsonStr.replace(/,\s*"[^"]*$/, '');
      // Close missing brackets
      for (let i = 0; i < opens - closes; i++) jsonStr += ']';
      for (let i = 0; i < openBrace - closeBrace; i++) jsonStr += '}';
    }

    const result = JSON.parse(jsonStr);
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
