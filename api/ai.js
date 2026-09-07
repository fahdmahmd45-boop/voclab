const MAX_FILE_BYTES = 2500000;
const ALLOWED_EXT = new Set(['pdf','txt','csv','json','md','doc','docx']);

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    words: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          word: { type: 'string' },
          type: { type: 'string', enum: ['n','v','adj','adv','phr','conj','prep','pron','det','num','excl','modal','art'] },
          arabic: { type: 'string' },
          example: { type: 'string' }
        },
        required: ['word','type','arabic','example']
      }
    }
  },
  required: ['words']
};

const recent = new Map();
function rateLimited(key) {
  const now = Date.now();
  const arr = (recent.get(key) || []).filter(t => now - t < 60000);
  if (arr.length >= 12) return true;
  arr.push(now);
  recent.set(key, arr);
  return false;
}

function getOutputText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  for (const item of data.output || []) {
    for (const part of item.content || []) {
      if (part && part.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  return '';
}

function cleanWords(words) {
  const seen = new Set();
  const out = [];
  for (const x of Array.isArray(words) ? words : []) {
    const word = String(x.word || '').trim();
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      word,
      type: String(x.type || 'n'),
      arabic: String(x.arabic || '').trim(),
      example: String(x.example || '').trim()
    });
  }
  return out;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  res.setHeader('Cache-Control', 'no-store');

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'AI is not configured yet.', code: 'OPENAI_API_KEY_MISSING' });
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many AI requests. Please wait a minute.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON body.' }); }
  }
  body = body || {};
  const mode = body.mode === 'file' ? 'file' : 'word';

  const content = [];
  if (mode === 'word') {
    const word = String(body.word || '').trim();
    if (!word || word.length > 120) return res.status(400).json({ error: 'Enter a valid English word or phrase.' });
    content.push({
      type: 'input_text',
      text: `Create exactly one vocabulary entry for the English word or phrase: "${word}". Return JSON matching the schema. Keep the Arabic meaning concise and natural. Write one short, natural English example sentence that clearly demonstrates the meaning. Use the most common part of speech and one of the allowed type codes.`
    });
  } else {
    const filename = String(body.filename || '').replace(/[\\/]/g, '').slice(0, 160);
    const ext = (filename.split('.').pop() || '').toLowerCase();
    let fileData = String(body.fileData || '');
    if (fileData.includes(',')) fileData = fileData.split(',').pop();
    if (!filename || !ALLOWED_EXT.has(ext)) return res.status(400).json({ error: 'Unsupported file type. Use PDF, Word, TXT, CSV, JSON, or Markdown.' });
    if (!fileData) return res.status(400).json({ error: 'The file is empty.' });
    const approxBytes = Math.floor(fileData.length * 0.75);
    if (approxBytes > MAX_FILE_BYTES) return res.status(413).json({ error: 'File is too large. Maximum size is 2.5 MB.' });

    content.push({
      type: 'input_text',
      text: 'Extract the English vocabulary items that are explicitly present in this file. Do not invent words that are not in the file. Remove duplicates and ignore page numbers, isolated punctuation, URLs, and obvious non-vocabulary metadata. For every extracted item, provide its most suitable part-of-speech code, a concise natural Arabic meaning, and one short natural English example sentence. Return JSON matching the schema.'
    });
    content.push({ type: 'input_file', filename, file_data: fileData });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        reasoning: { effort: 'low' },
        store: false,
        max_output_tokens: mode === 'file' ? 24000 : 1200,
        input: [{ role: 'user', content }],
        text: {
          format: {
            type: 'json_schema',
            name: 'voclab_vocabulary',
            strict: true,
            schema
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI error', response.status, data?.error?.message || data);
      return res.status(response.status >= 500 ? 502 : 400).json({ error: data?.error?.message || 'AI request failed.' });
    }

    const text = getOutputText(data);
    if (!text) return res.status(502).json({ error: 'AI returned no vocabulary data.' });
    let parsed;
    try { parsed = JSON.parse(text); } catch { return res.status(502).json({ error: 'AI returned an unreadable response.' }); }
    const words = cleanWords(parsed.words);
    if (!words.length) return res.status(422).json({ error: mode === 'file' ? 'No English vocabulary was found in this file.' : 'Could not build this vocabulary entry.' });
    return res.status(200).json({ words });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'AI service is temporarily unavailable.' });
  }
};
