export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).json({ error: ‘Method not allowed’ });

const groqKey = process.env.GROQ_API_KEY;
if (!groqKey) return res.status(500).json({ error: ‘Groq API key not configured’ });

const { query } = req.body;
if (!query) return res.status(400).json({ error: ‘No query provided’ });

const prompt = `You are a world-class public sentiment analyst with comprehensive knowledge of media, culture, business, politics, music, sport, and current affairs up to early 2025.

Analyse the genuine public sentiment around “${query}”. Draw on everything you know , news coverage, social media discourse, reviews, controversies, achievements, public reputation. Be specific and accurate.

Return ONLY a valid JSON object. No markdown fences, no preamble, no trailing text:

{
“entity”: “${query}”,
“entity_type”: “<exactly one of: Company | Brand | Person | Concept | Technology | Organisation | Product | Country | Movement>”,
“overall_sentiment”: “<positive | negative | neutral>”,
“confidence”: <integer 0-100 reflecting how clearly one sentiment dominates>,
“positive_score”: <integer 0-100>,
“negative_score”: <integer 0-100>,
“neutral_score”: <integer 0-100>,
“editorial_headline”: “<punchy, specific headline referencing real known facts. Max 14 words, sentence case, no quotes>”,
“editorial_body”: “<2-3 sentences. Reference specific real events, achievements, controversies. Wrap 2-4 key facts in <strong> tags. Max 80 words. Be a journalist not a press officer.>”,
“source_voices”: [
{
“source”: “<platform: Reddit | Twitter/X | Financial Times | The Guardian | Bloomberg | Glassdoor | Trustpilot | TechCrunch | BBC | LinkedIn>”,
“sentiment”: “<positive | negative | neutral>”,
“quote”: “<realistic paraphrase of what that audience actually says. Specific to ${query}. Max 28 words.>”,
“audience”: “<specific audience: Fans | Customers | Investors | Employees | Critics | General Public | Industry Analysts>”
}
],
“positive_themes”: [”<specific real theme>”, “<theme>”, “<theme>”, “<theme>”],
“negative_themes”: [”<specific real theme>”, “<theme>”, “<theme>”, “<theme>”],
“summary_note”: “<one sharp editorial sentence referencing something specific and real. Max 20 words.>”
}

RULES:

- positive_score + negative_score + neutral_score = exactly 100
- Scores must reflect genuine public opinion , not safe round numbers
- Include exactly 6 source_voices with realistic mix of sentiments
- If “${query}” is a private individual with no public profile, set confidence to 15, scores to 40/10/50, and note limited public footprint in editorial_body
- Every field must be specific to “${query}” , no generic filler
- Never invent facts you are not confident about`;
  
  try {
  const response = await fetch(‘https://api.groq.com/openai/v1/chat/completions’, {
  method: ‘POST’,
  headers: {
  ‘Content-Type’: ‘application/json’,
  ‘Authorization’: `Bearer ${groqKey}`
  },
  body: JSON.stringify({
  model: ‘llama-3.3-70b-versatile’,
  messages: [
  {
  role: ‘system’,
  content: ‘You are a world-class public sentiment analyst. Return only valid JSON. Be specific, accurate and honest. Never invent facts.’
  },
  {
  role: ‘user’,
  content: prompt
  }
  ],
  temperature: 0.2,
  max_tokens: 2048,
  top_p: 0.9,
  response_format: { type: ‘json_object’ }
  })
  });
  
  if (!response.ok) {
  const err = await response.text();
  return res.status(response.status).json({ error: ‘Groq API error’, detail: err });
  }
  
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || ‘’;
  
  let cleaned = text.replace(/`json\n?/g, '').replace(/`\n?/g, ‘’).trim();
  const jsonMatch = cleaned.match(/{[\s\S]*}/);
  if (!jsonMatch) {
  return res.status(500).json({ error: ‘Could not parse model response’, raw: text });
  }
  
  let jsonStr = jsonMatch[0];
  jsonStr = jsonStr.replace(/,(\s*[]}])/g, ‘$1’);
  jsonStr = jsonStr.replace(/:\s*”([^”]*)\n([^”]*)”/g, ‘: “$1 $2”’);
  
  try {
  JSON.parse(jsonStr);
  } catch(e) {
  const opens = (jsonStr.match(/[/g) || []).length;
  const closes = (jsonStr.match(/]/g) || []).length;
  const openBrace = (jsonStr.match(/{/g) || []).length;
  const closeBrace = (jsonStr.match(/}/g) || []).length;
  jsonStr = jsonStr.replace(/,\s*$/, ‘’);
  jsonStr = jsonStr.replace(/,\s*”[^”]*$/, ‘’);
  for (let i = 0; i < opens - closes; i++) jsonStr += ‘]’;
  for (let i = 0; i < openBrace - closeBrace; i++) jsonStr += ‘}’;
  }
  
  const result = JSON.parse(jsonStr);
  return res.status(200).json(result);
  
  } catch (err) {
  return res.status(500).json({ error: err.message });
  }
  }