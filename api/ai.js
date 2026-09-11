const {
  NETWORK_DAILY_LIMIT,
  enforceNetworkRateLimit,
  tooLargeByHeader,
  validateUploadedFile
} = require('./_security');

const MAX_FILE_BYTES = 2500000;
const MAX_FILE_WORDS = 40;
const WORD_CREDIT_COST = 1;
const FILE_CREDIT_COST = 5;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hknecvleujjdyoqtwaar.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_9GOPoqC3kpfLVcvQoSXXFQ_gXcGK6om';

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

async function authenticateAndConsumeQuota(req, creditCost) {
  const auth = String(req.headers.authorization || '').trim();
  if (!/^Bearer\s+\S+$/i.test(auth)) {
    return { ok: false, status: 401, error: 'Sign in to use AI.', code: 'AUTH_REQUIRED' };
  }

  const commonHeaders = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: auth,
    'Content-Type': 'application/json'
  };

  let userResponse;
  try {
    userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: commonHeaders });
  } catch {
    return { ok: false, status: 503, error: 'Account verification is temporarily unavailable.', code: 'AUTH_UNAVAILABLE' };
  }
  if (!userResponse.ok) {
    return { ok: false, status: 401, error: 'Your sign-in session is invalid or expired. Please sign in again.', code: 'AUTH_INVALID' };
  }
  const user = await userResponse.json().catch(() => null);
  if (!user || !user.id) {
    return { ok: false, status: 401, error: 'Your sign-in session is invalid or expired. Please sign in again.', code: 'AUTH_INVALID' };
  }

  let quotaResponse;
  try {
    quotaResponse = await fetch(`${SUPABASE_URL}/functions/v1/consume-ai-quota`, {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify({ cost: creditCost })
    });
  } catch {
    return { ok: false, status: 503, error: 'AI usage protection is temporarily unavailable.', code: 'QUOTA_UNAVAILABLE' };
  }
  if (!quotaResponse.ok) {
    console.error('Quota RPC failed', quotaResponse.status, await quotaResponse.text().catch(() => ''));
    return { ok: false, status: 503, error: 'AI usage protection is temporarily unavailable.', code: 'QUOTA_UNAVAILABLE' };
  }
  const raw = await quotaResponse.json().catch(() => null);
  const quota = Array.isArray(raw) ? raw[0] : raw;
  const accountPlan = quota?.plan === 'pro' ? 'pro' : 'free';
  const monthlyLimit = Math.max(0, Number(quota?.monthly_limit || (accountPlan === 'pro' ? 300 : 30)));
  const remaining = Math.max(0, Number(quota?.remaining_monthly ?? quota?.remaining_today ?? 0));

  if (!quota || quota.allowed !== true) {
    const code = String(quota?.code || 'AI_RATE_LIMIT');
    const retryAfter = Math.max(1, Number(quota?.retry_after_seconds || 60));
    let error = 'Too many AI requests. Please wait a minute.';
    let status = 429;

    if (code === 'MONTHLY_AI_CREDIT_LIMIT') {
      error = accountPlan === 'pro'
        ? 'Your monthly Pro AI credits are used. They reset next month.'
        : 'Your free AI credits are used for this month. Free includes 30 credits per month. Contact @voclab_sa on Instagram to upgrade to Pro.';
    } else if (code === 'INVALID_AI_COST') {
      status = 500;
      error = 'AI usage protection rejected this request.';
    }

    return {
      ok: false,
      status,
      retryAfter,
      remaining,
      monthlyLimit,
      plan: accountPlan,
      cost: creditCost,
      code,
      error
    };
  }

  return {
    ok: true,
    userId: user.id,
    remaining,
    monthlyLimit,
    plan: accountPlan,
    cost: Math.max(1, Number(quota.cost || creditCost))
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'AI is not configured yet.', code: 'OPENAI_API_KEY_MISSING' });
  }

  if (tooLargeByHeader(req)) {
    return res.status(413).json({ error: 'Request is too large.' });
  }

  // Shared Upstash limits run before any user lookup/quota consumption so abuse is
  // rejected consistently across Vercel serverless instances.
  const network = await enforceNetworkRateLimit(req);
  if (!network.ok) {
    if (network.retryAfter) res.setHeader('Retry-After', String(network.retryAfter));
    res.setHeader('X-Network-RateLimit-Limit', String(NETWORK_DAILY_LIMIT));
    return res.status(network.status).json({ error: network.error, code: network.code });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON body.' }); }
  }
  body = body || {};
  const mode = body.mode === 'file' ? 'file' : 'word';
  const creditCost = mode === 'file' ? FILE_CREDIT_COST : WORD_CREDIT_COST;

  const content = [];
  if (mode === 'word') {
    const word = String(body.word || '').trim();
    if (!word || word.length > 120) return res.status(400).json({ error: 'Enter a valid English word or phrase.' });
    content.push({
      type: 'input_text',
      text: body.dialects === true
        ? `Create exactly one vocabulary entry for the English word or phrase: "${word}". Return JSON matching the schema. In the ipa field, give BOTH pronunciations in exactly this compact format: "US /.../ · UK /.../" using accurate General American and standard British IPA. Then give a short learner-friendly English definition, a concise natural Arabic meaning, one short natural English example sentence that clearly demonstrates the meaning, and an accurate natural Arabic translation of that example. Use the most common part of speech and one of the allowed type codes.`
        : `Create exactly one vocabulary entry for the English word or phrase: "${word}". Return JSON matching the schema. Give the standard IPA pronunciation for the most common English reading, a short learner-friendly English definition, a concise natural Arabic meaning, one short natural English example sentence that clearly demonstrates the meaning, and an accurate natural Arabic translation of that example. Use the most common part of speech and one of the allowed type codes.`
    });
  } else {
    const checked = validateUploadedFile(body.filename, body.fileData, MAX_FILE_BYTES);
    if (!checked.ok) return res.status(checked.status).json({ error: checked.error });

    content.push({
      type: 'input_text',
      text: `Read the attached file and extract up to ${MAX_FILE_WORDS} of the most useful English vocabulary words and phrases that are explicitly present in it. Do not invent vocabulary that is not in the file. Remove duplicates and ignore very common filler/function words, page numbers, isolated punctuation, URLs, and obvious metadata. Prioritize vocabulary that is useful for an English learner. For every extracted item return the standard IPA pronunciation, the most suitable part-of-speech code, a short learner-friendly English definition, a concise natural Arabic meaning, one short natural English example sentence, and an accurate natural Arabic translation of the example. Return JSON matching the schema.`
    });
    content.push({ type: 'input_file', filename: checked.filename, file_data: checked.fileData });
  }

  const quota = await authenticateAndConsumeQuota(req, creditCost);
  if (quota.monthlyLimit != null) {
    res.setHeader('X-RateLimit-Limit', String(quota.monthlyLimit));
    res.setHeader('X-AI-Credit-Limit', String(quota.monthlyLimit));
  }
  if (quota.remaining != null) {
    res.setHeader('X-RateLimit-Remaining', String(quota.remaining));
    res.setHeader('X-AI-Credits-Remaining', String(quota.remaining));
  }
  res.setHeader('X-AI-Credit-Cost', String(creditCost));
  if (quota.plan) res.setHeader('X-AI-Plan', quota.plan);

  if (!quota.ok) {
    if (quota.retryAfter) res.setHeader('Retry-After', String(quota.retryAfter));
    return res.status(quota.status).json({ error: quota.error, code: quota.code });
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
    return res.status(200).json({
      words,
      usage: {
        remaining_monthly: quota.remaining,
        monthly_limit: quota.monthlyLimit,
        credits_used: quota.cost,
        plan: quota.plan
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'AI service is temporarily unavailable.' });
  }
};
