'use strict';

const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');

const NETWORK_MINUTE_LIMIT = 5;
const NETWORK_DAILY_LIMIT = 100;
const MAX_CONTENT_LENGTH_BYTES = 3_600_000;
const ALLOWED_EXT = new Set(['pdf','txt','csv','json','md','doc','docx','ppt','pptx','xls','xlsx']);

let limiters;
const fallbackNetworkLimits = new Map();

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const real = String(req.headers['x-real-ip'] || '').trim();
  const socket = String(req.socket?.remoteAddress || '').trim();
  return (forwarded || real || socket || 'unknown').slice(0, 128);
}

function getLimiters() {
  if (limiters !== undefined) return limiters;
  const url = String(process.env.UPSTASH_REDIS_REST_URL || '').trim();
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url || !token) {
    limiters = null;
    return limiters;
  }

  const redis = new Redis({ url, token, enableTelemetry: false });
  limiters = {
    minute: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(NETWORK_MINUTE_LIMIT, '60 s'),
      prefix: 'voclab:ai:network:minute',
      analytics: false
    }),
    day: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(NETWORK_DAILY_LIMIT, '1 d'),
      prefix: 'voclab:ai:network:day',
      analytics: false
    })
  };
  return limiters;
}

function retryAfterSeconds(reset) {
  const resetMs = Number(reset || 0);
  if (!Number.isFinite(resetMs) || resetMs <= Date.now()) return 60;
  return Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
}

function enforceFallbackNetworkRateLimit(ip) {
  const now = Date.now();
  const minuteWindow = 60_000;
  const dayWindow = 86_400_000;
  let entry = fallbackNetworkLimits.get(ip);

  if (!entry) {
    entry = { minuteStart: now, minuteCount: 0, dayStart: now, dayCount: 0, touchedAt: now };
    fallbackNetworkLimits.set(ip, entry);
  }

  if (now - entry.minuteStart >= minuteWindow) {
    entry.minuteStart = now;
    entry.minuteCount = 0;
  }
  if (now - entry.dayStart >= dayWindow) {
    entry.dayStart = now;
    entry.dayCount = 0;
  }

  if (entry.minuteCount >= NETWORK_MINUTE_LIMIT) {
    return {
      ok: false,
      status: 429,
      code: 'AI_NETWORK_RATE_LIMIT',
      error: 'Too many AI requests from this network. Please wait a minute.',
      retryAfter: Math.max(1, Math.ceil((entry.minuteStart + minuteWindow - now) / 1000))
    };
  }
  if (entry.dayCount >= NETWORK_DAILY_LIMIT) {
    return {
      ok: false,
      status: 429,
      code: 'NETWORK_AI_LIMIT',
      error: 'AI usage limit reached for this network today. Please try again later.',
      retryAfter: Math.max(1, Math.ceil((entry.dayStart + dayWindow - now) / 1000))
    };
  }

  entry.minuteCount += 1;
  entry.dayCount += 1;
  entry.touchedAt = now;

  if (fallbackNetworkLimits.size > 5000) {
    for (const [key, value] of fallbackNetworkLimits) {
      if (now - value.touchedAt > dayWindow) fallbackNetworkLimits.delete(key);
      if (fallbackNetworkLimits.size <= 4000) break;
    }
  }

  return { ok: true, ip, fallback: true };
}

async function enforceNetworkRateLimit(req) {
  const active = getLimiters();
  const ip = getClientIp(req);

  if (!active) {
    console.warn('Upstash rate limit is not configured; using per-instance fallback limiter.');
    return enforceFallbackNetworkRateLimit(ip);
  }

  try {
    const minute = await active.minute.limit(ip);
    if (!minute.success) {
      return {
        ok: false,
        status: 429,
        code: 'AI_NETWORK_RATE_LIMIT',
        error: 'Too many AI requests from this network. Please wait a minute.',
        retryAfter: retryAfterSeconds(minute.reset)
      };
    }

    const day = await active.day.limit(ip);
    if (!day.success) {
      return {
        ok: false,
        status: 429,
        code: 'NETWORK_AI_LIMIT',
        error: 'AI usage limit reached for this network today. Please try again later.',
        retryAfter: retryAfterSeconds(day.reset)
      };
    }

    return { ok: true, ip };
  } catch (error) {
    console.error('Upstash rate limit error', error?.message || error);
    return enforceFallbackNetworkRateLimit(ip);
  }
}

function tooLargeByHeader(req) {
  const value = Number(req.headers['content-length'] || 0);
  return Number.isFinite(value) && value > MAX_CONTENT_LENGTH_BYTES;
}

function startsWithBytes(buffer, bytes) {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function isZip(buffer) {
  return startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(buffer, [0x50, 0x4b, 0x07, 0x08]);
}

function isOle(buffer) {
  return startsWithBytes(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
}

function looksLikeText(buffer) {
  if (!buffer.length) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 65536));
  let nul = 0;
  for (const byte of sample) if (byte === 0) nul++;
  if (nul > 0) return false;
  const text = sample.toString('utf8');
  const replacements = (text.match(/\uFFFD/g) || []).length;
  return replacements <= Math.max(2, Math.floor(text.length * 0.01));
}

function officeZipMatches(buffer, ext) {
  if (!isZip(buffer)) return false;
  const marker = ext === 'docx' ? 'word/' : ext === 'pptx' ? 'ppt/' : 'xl/';
  return buffer.includes(Buffer.from(marker, 'ascii')) &&
    buffer.includes(Buffer.from('[Content_Types].xml', 'ascii'));
}

function parseDataUrl(fileData) {
  const match = /^data:([^;,]*)(?:;[^,]*)*;base64,([A-Za-z0-9+/=]+)$/i.exec(fileData);
  if (!match) return null;
  const mime = String(match[1] || '').toLowerCase();
  const encoded = match[2];
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return null;
  let buffer;
  try { buffer = Buffer.from(encoded, 'base64'); } catch { return null; }
  return { mime, buffer };
}

function mimeIsReasonable(ext, mime) {
  if (!mime || mime === 'application/octet-stream') return true;
  const expected = {
    pdf: ['application/pdf'],
    txt: ['text/plain'],
    csv: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
    json: ['application/json', 'text/json', 'text/plain'],
    md: ['text/markdown', 'text/plain'],
    doc: ['application/msword', 'application/x-ole-storage'],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
    ppt: ['application/vnd.ms-powerpoint', 'application/x-ole-storage'],
    pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
    xls: ['application/vnd.ms-excel', 'application/x-ole-storage'],
    xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip']
  };
  return (expected[ext] || []).includes(mime);
}

function validateUploadedFile(filename, fileData, maxBytes) {
  const cleanName = String(filename || '').replace(/[\\/]/g, '').slice(0, 160);
  const ext = (cleanName.split('.').pop() || '').toLowerCase();
  if (!cleanName || !ALLOWED_EXT.has(ext)) {
    return { ok: false, status: 400, error: 'Unsupported file type. Use PDF, Word, PowerPoint, Excel, TXT, CSV, JSON, or Markdown.' };
  }

  const parsed = parseDataUrl(String(fileData || ''));
  if (!parsed || !parsed.buffer.length) {
    return { ok: false, status: 400, error: 'The uploaded file data is invalid. Please choose the file again.' };
  }
  if (parsed.buffer.length > maxBytes) {
    return { ok: false, status: 413, error: 'File is too large. Maximum size is 2.5 MB.' };
  }
  if (!mimeIsReasonable(ext, parsed.mime)) {
    return { ok: false, status: 400, error: 'The file content does not match its declared file type.' };
  }

  let valid = false;
  if (ext === 'pdf') valid = parsed.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  else if (ext === 'docx' || ext === 'pptx' || ext === 'xlsx') valid = officeZipMatches(parsed.buffer, ext);
  else if (ext === 'doc' || ext === 'ppt' || ext === 'xls') valid = isOle(parsed.buffer);
  else if (ext === 'json') {
    if (looksLikeText(parsed.buffer)) {
      try { JSON.parse(parsed.buffer.toString('utf8')); valid = true; } catch { valid = false; }
    }
  } else valid = looksLikeText(parsed.buffer);

  if (!valid) {
    return { ok: false, status: 400, error: 'The file content does not match the selected file type.' };
  }

  return { ok: true, filename: cleanName, ext, fileData };
}

module.exports = {
  NETWORK_MINUTE_LIMIT,
  NETWORK_DAILY_LIMIT,
  enforceNetworkRateLimit,
  tooLargeByHeader,
  validateUploadedFile
};
