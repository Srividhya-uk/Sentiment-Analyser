module.exports = async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).json({ error: ‘Method not allowed’ });

const groqKey = process.env.GROQ_API_KEY;
if (!groqKey) return res.status(500).json({ error: ‘Groq API key not configured’ });

const { query } = req.body;
if (!query) return res.status(400).json({ error: ‘No query provided’ });

const prompt = ‘You are a world-class public sentiment analyst with comprehensive knowledge of media, culture, business, politics, music, sport, and current affairs up to early 2025.\n\n’
+ ‘Analyse the genuine public sentiment around “’ + query + ‘”. Draw on everything you know: news coverage, social media discourse, reviews, controversies, achievements, public reputation. Be specific and accurate.\n\n’
+ ‘Return ONLY a valid JSON object. No markdown fences, no preamble, no trailing text:\n\n’
+ ‘{\n’
+ ’  “entity”: “’ + query + ‘”,\n’
+ ’  “entity_type”: “<exactly one of: Company | Brand | Person | Concept | Technology | Organisation | Product | Country | Movement>”,\n’
+ ’  “overall_sentiment”: “<positive | negative | neutral>”,\n’
+ ’  “confidence”: <integer 0-100 reflecting how clearly one sentiment dominates>,\n’
+ ’  “positive_score”: <integer 0-100>,\n’
+ ’  “negative_score”: <integer 0-100>,\n’
+ ’  “neutral_score”: <integer 0-100>,\n’
+ ’  “editorial_headline”: “<punchy specific headline referencing real known facts. Max 14 words, sentence case, no quotes>”,\n’
+ ’  “editorial_body”: “<2-3 sentences. Reference specific real events, achievements, controversies. Wrap 2-4 key facts in strong tags. Max 80 words.>”,\n’
+ ’  “source_voices”: [\n’
+ ’    {\n’
+ ’      “source”: “<platform: Reddit | Twitter/X | Financial Times | The Guardian | Bloomberg | Glassdoor | Trustpilot | TechCrunch | BBC | LinkedIn>”,\n’
+ ’      “sentiment”: “<positive | negative | neutral>”,\n’
+ ’      “quote”: “<realistic paraphrase of what that audience actually says about ’ + query + ‘. Max 28 words.>”,\n’
+ ’      “audience”: “<specific audience: Fans | Customers | Investors | Employees | Critics | General Public | Industry Analysts>”\n’
+ ’    }\n’
+ ’  ],\n’
+ ’  “positive_themes”: [”<specific real theme>”, “<theme>”, “<theme>”, “<theme>”],\n’
+ ’  “negative_themes”: [”<specific real theme>”, “<theme>”, “<theme>”, “<theme>”],\n’
+ ’  “summary_note”: “<one sharp editorial sentence referencing something specific and real. Max 20 words.>”\n’
+ ‘}\n\n’
+ ‘RULES:\n’
+ ‘- positive_score + negative_score + neutral_score = exactly 100\n’
+ ‘- Scores must reflect genuine public opinion, not safe round numbers\n’
+ ‘- Include exactly 6 source_voices with realistic mix of sentiments\n’
+ ‘- If “’ + query + ‘” is a private individual with no public profile, set confidence to 15, scores to 40/10/50, and note limited public footprint in editorial_body\n’
+ ‘- Every field must be specific to “’ + query + ‘”, no generic filler\n’
+ ‘- Never invent facts you are not confident about’;

try {
const response = await fetch(‘https://api.groq.com/openai/v1/chat/completions’, {
method: ‘POST’,
headers: {
‘Content-Type’: ‘application/json’,
‘Authorization’: ’Bearer ’ + groqKey
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
top_p: 0.9
})
});

```
if (!response.ok) {
  const err = await response.text();
  return res.status(response.status).json({ error: 'Groq API error ' + response.status, detail: err });
}

const data = await response.json();
const text = data.choices[0].message.content || '';

var cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  return res.status(500).json({ error: 'Could not parse model response' });
}

var jsonStr = jsonMatch[0];
jsonStr = jsonStr.replace(/,(\s*[\]}])/g, '$1');

try {
  JSON.parse(jsonStr);
} catch(e) {
  var opens = (jsonStr.match(/\[/g) || []).length;
  var closes = (jsonStr.match(/\]/g) || []).length;
  var openBrace = (jsonStr.match(/\{/g) || []).length;
  var closeBrace = (jsonStr.match(/\}/g) || []).length;
  jsonStr = jsonStr.replace(/,\s*$/, '');
  for (var i = 0; i < opens - closes; i++) jsonStr += ']';
  for (var j = 0; j < openBrace - closeBrace; j++) jsonStr += '}';
}

var result = JSON.parse(jsonStr);
return res.status(200).json(result);
```

} catch (err) {
return res.status(500).json({ error: err.message });
}
};