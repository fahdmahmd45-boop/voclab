const crypto = require('crypto');

const MAX_FILE_BYTES = 2500000;
const MAX_FILE_WORDS = 40;
const DAILY_VISITOR_LIMIT = 10;
const MINUTE_IP_LIMIT = 5;
const DAILY_IP_SAFETY_LIMIT = 100;
const ALLOWED_EXT = new Set(['pdf','txt','csv','json','md','doc','docx','ppt','pptx','xls','xlsx']);

const VISITOR_COOKIE = 'voclab_ai_visitor';
const USAGE_COOKIE = 'voclab_ai_usage';

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    words: {
      type: 'array',
      maxItems: MAX_FILE_WORDS,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          word: { type: 'string' },
          type: { type: 'string', enum: ['n','v','adj','adv','phr','conj','prep','pron','det','num','excl','modal','art'] },
          ipa: { type: 'string' },
          english_definition: { type: 'string' },
          arabic: { type: 'string' },
          example: { type: 'string' },
          example_arabic: { type: 'string' }
        },
        required: ['word','type','ipa','english_definition','arabic','example','example_arabic']
      }
    }
  },
  required: ['words']
};

const recentByIp = new Map();
const dailyByIp = new Map();

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const key = part.slice(0, i).trim();
    let value = part.slice(i + 1).trim();
    try { value = decodeURIComponent(value); } catch {}
    if (key) out[key] = value;
  }
  return out;
}

function cookieLine(name, value, req, maxAge = 31536000) {
  const secure = process.env.NODE_ENV === 'production' || String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function secondsUntilUtcMidnight() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return Math.max(60, Math.ceil((next - now.getTime()) / 1000));
}

function signUsage(day, count, visitorId) {
  return crypto
    .createHmac('sha256', process.env.OPENAI_API_KEY)
    .update(`${day}|${count}|${visitorId}`)
    .digest('hex');
}

function readSignedUsage(raw, visitorId) {
  const day = todayUtc();
  const parts = String(raw || '').split('.');
  if (parts.length !== 3 || parts[0] !== day) return 0;
  const count = Number(parts[1]);
  if (!Number.isInteger(count) || count < 0 || count > 100000) return 0;
  const expected = signUsage(day, count, visitorId);
  const provided = parts[2];
  if (provided.length !== expected.length) return 0;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'))) return 0;
  } catch {
    return 0;
  }
  return count;
}

function makeUsageCookie(count, visitorId) {
  const day = todayUtc();
  return `${day}.${count}.${signUsage(day, count, visitorId)}`;
}

function getVisitor(cookies) {
  const existing = String(cookies[VISITOR_COOKIE] || '');
  if (/^[a-z0-9-]{20,80}$/i.test(existing)) return existing;
  return crypto.randomUUID();
}

function minuteRateLimited(ip) {
  const now = Date.now();
  const arr = (recentByIp.get(ip) || []).filter(t => now - t < 60000);
  if (arr.length >= MINUTE_IP_LIMIT) {
    recentByIp.set(ip, arr);
    return true;
  }
  arr.push(now);
  recentByIp.set(ip, arr);
  return false;
}

function dailyIpRateLimited(ip) {
  const day = todayUtc();
  const current = dailyByIp.get(ip);
  const count = current && current.day === day ? current.count : 0;
  if (count >= DAILY_IP_SAFETY_LIMIT) return true;
  dailyByIp.set(ip, { day, count: count + 1 });
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

function cleanWords(words, limit) {
  const seen = new Set();
  const out = [];
  for (const x of Array.isArray(words) ? words : []) {
    if (out.length >= limit) break;
    const word = String(x.word || '').trim();
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      word: word.slice(0, 120),
      type: String(x.type || 'n'),
      ipa: String(x.ipa || '').trim().slice(0, 100),
      english_definition: String(x.english_definition || '').trim().slice(0, 320),
      arabic: String(x.arabic || '').trim().slice(0, 220),
      example: String(x.example || '').trim().slice(0, 320),
      example_arabic: String(x.example_arabic || '').trim().slice(0, 320)
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
      text: `Create exactly one vocabulary entry for the English word or phrase: "${word}". Return JSON matching the schema. Give the standard IPA pronunciation for the most common English reading, a short learner-friendly English definition, a concise natural Arabic meaning, one short natural English example sentence that clearly demonstrates the meaning, and an accurate natural Arabic translation of that example. Use the most common part of speech and one of the allowed type codes.`
    });
  } else {
    const filename = String(body.filename || '').replace(/[\\/]/g, '').slice(0, 160);
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const fileData = String(body.fileData || '');

    if (!filename || !ALLOWED_EXT.has(ext)) {
      return res.status(400).json({ error: 'Unsupported file type. Use PDF, Word, PowerPoint, Excel, TXT, CSV, JSON, or Markdown.' });
    }
    if (!fileData) return res.status(400).json({ error: 'The file is empty.' });
    if (!/^data:[^,]*;base64,/i.test(fileData)) {
      return res.status(400).json({ error: 'The uploaded file data is invalid. Please choose the file again.' });
    }

    const comma = fileData.indexOf(',');
    const base64 = comma >= 0 ? fileData.slice(comma + 1) : '';
    const approxBytes = Math.floor(base64.length * 0.75);
    if (approxBytes > MAX_FILE_BYTES) return res.status(413).json({ error: 'File is too large. Maximum size is 2.5 MB.' });

    content.push({
      type: 'input_text',
      text: `Read the attached file and extract up to ${MAX_FILE_WORDS} of the most useful English vocabulary words and phrases that are explicitly present in it. Do not invent vocabulary that is not in the file. Remove duplicates and ignore very common filler/function words, page numbers, isolated punctuation, URLs, and obvious metadata. Prioritize vocabulary that is useful for an English learner. For every extracted item return the standard IPA pronunciation, the most suitable part-of-speech code, a short learner-friendly English definition, a concise natural Arabic meaning, one short natural English example sentence, and an accurate natural Arabic translation of the example. Return JSON matching the schema.`
    });
    content.push({ type: 'input_file', filename, file_data: fileData });
  }

  const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const cookies = parseCookies(req.headers.cookie);
  const visitorId = getVisitor(cookies);
  const usedToday = readSignedUsage(cookies[USAGE_COOKIE], visitorId);

  res.setHeader('X-RateLimit-Limit', String(DAILY_VISITOR_LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, DAILY_VISITOR_LIMIT - usedToday)));

  if (usedToday >= DAILY_VISITOR_LIMIT) {
    const retryAfter = secondsUntilUtcMidnight();
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Daily AI limit reached. You can use AI up to 10 times per day. Please try again tomorrow.',
      code: 'DAILY_AI_LIMIT'
    });
  }

  if (minuteRateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many AI requests. Please wait a minute.', code: 'AI_RATE_LIMIT' });
  }

  if (dailyIpRateLimited(ip)) {
    const retryAfter = secondsUntilUtcMidnight();
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'AI usage limit reached for this network today. Please try again tomorrow.', code: 'NETWORK_AI_LIMIT' });
  }

  const nextDailyCount = usedToday + 1;
  res.setHeader('Set-Cookie', [
    cookieLine(VISITOR_COOKIE, visitorId, req),
    cookieLine(USAGE_COOKIE, makeUsageCookie(nextDailyCount, visitorId), req, secondsUntilUtcMidnight() + 300)
  ]);
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, DAILY_VISITOR_LIMIT - nextDailyCount)));

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
        max_output_tokens: mode === 'file' ? 8000 : 1200,
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

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('OpenAI error', response.status, data?.error?.message || data);
      return res.status(response.status >= 500 ? 502 : 400).json({ error: data?.error?.message || 'AI request failed.' });
    }

    const text = getOutputText(data);
    if (!text) return res.status(502).json({ error: 'AI returned no vocabulary data.' });
    let parsed;
    try { parsed = JSON.parse(text); } catch { return res.status(502).json({ error: 'AI returned an unreadable response.' }); }
    const words = cleanWords(parsed.words, mode === 'file' ? MAX_FILE_WORDS : 1);
    if (!words.length) return res.status(422).json({ error: mode === 'file' ? 'No useful English vocabulary was found in this file.' : 'Could not build this vocabulary entry.' });
    return res.status(200).json({ words, usage: { remaining_today: Math.max(0, DAILY_VISITOR_LIMIT - nextDailyCount), daily_limit: DAILY_VISITOR_LIMIT } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'AI service is temporarily unavailable.' });
  }
};
