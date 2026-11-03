'use strict';
const { validateUploadedFile, tooLargeByHeader, enforceNetworkRateLimit } = require('./_security');
const { extractFileText } = require('./_file-text');
module.exports = async function(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error:'POST only' });
  if (tooLargeByHeader(req)) return res.status(413).json({ error:'File is too large.' });
  const throttle = await enforceNetworkRateLimit(req);
  if (!throttle.ok) return res.status(throttle.status).json({ error: throttle.error });
  let body=req.body || {};
  if (typeof body === 'string') { try { body=JSON.parse(body); } catch { return res.status(400).json({ error:'Invalid request.' }); } }
  const file=validateUploadedFile(body.filename,body.fileData,2500000);
  if (!file.ok) return res.status(file.status || 400).json({ error:file.error });
  if (!['pdf','docx','txt'].includes(file.ext)) return res.status(400).json({ error:'Use a PDF, DOCX, or TXT file.' });
  const parsed=await extractFileText(file.ext,file.fileData,120000);
  if (!parsed.ok) return res.status(parsed.status||422).json({ error:parsed.error });
  const words=[...new Set((parsed.text.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g)||[]).map(x=>x.toLowerCase()).filter(x=>x.length>=3 && x.length<=45))].slice(0,800);
  return res.status(200).json({ words, sampled:parsed.sampled, sourceChars:parsed.sourceChars, previewLimit:800 });
};
