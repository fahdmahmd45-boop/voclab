'use strict';
// Retired: the old endpoint treated every token in explanations/questions as
// vocabulary. Reject stale clients rather than returning misleading results.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Deprecation', 'true');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  return res.status(410).json({
    code: 'IMPORT_PREVIEW_REPLACED',
    error: 'Import & Learn has been upgraded. Reload VOC LAB, choose an action, then analyze your file.'
  });
};
