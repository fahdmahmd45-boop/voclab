'use strict';

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const turnstileSiteKey = String(
    process.env.TURNSTILE_SITE_KEY ||
    process.env.CLOUDFLARE_TURNSTILE_SITE_KEY ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    ''
  ).trim();

  if (!turnstileSiteKey) {
    return res.status(503).json({ error: 'Verification protection is not configured.' });
  }

  return res.status(200).json({ turnstileSiteKey });
};
