module.exports = async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).json({ error: ‘Method not allowed’ });

const groqKey = process.env.GROQ_API_KEY;
if (!groqKey) return res.status(500).json({ error: ‘No API key’ });

const query = req.body && req.body.query;
if (!query) return res.status(400).json({ error: ‘No query’ });

try {
const groqRes = await fetch(‘https://api.groq.com/openai/v1/chat/completions’, {
method: ‘POST’,
headers: {
‘Content-Type’: ‘application/json’,
‘Authorization’: ’Bearer ’ + groqKey
},
body: JSON.stringify({
model: ‘llama-3.3-70b-versatile’,
temperature: 0.2,
max_tokens: 2048,
messages: [
{
role: ‘system’,
content: ‘You are a public sentiment analyst. Always respond with valid JSON only. No markdown, no explanation.’
},
{
role: ‘user’,
content: ’Analyse public sentiment for: ’ + query + ‘. Return JSON with these exact fields: entity, entity_type, overall_sentiment (positive/negative/neutral), confidence (0-100), positive_score (0-100), negative_score (0-100), neutral_score (0-100), editorial_headline, editorial_body, source_voices (array of 6 objects each with source/sentiment/quote/audience), positive_themes (array of 4 strings), negative_themes (array of 4 strings), summary_note. Scores must sum to 100.’
}
]
})
});

```
if (!groqRes.ok) {
  const errText = await groqRes.text();
  return res.status(groqRes.status).json({ error: 'Groq error', detail: errText });
}

const data = await groqRes.json();
const content = data.choices[0].message.content;
const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
const result = JSON.parse(clean);
return res.status(200).json(result);
```

} catch (err) {
return res.status(500).json({ error: err.message });
}
};