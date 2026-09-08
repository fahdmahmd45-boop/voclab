module.exports = (req, res) => {
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const base = host ? `${proto}://${host}` : '';

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');

  const sitemap = base ? `\nSitemap: ${base}/sitemap.xml\n` : '\n';
  res.status(200).send(`User-agent: *\nAllow: /\nDisallow: /api/${sitemap}`);
};
