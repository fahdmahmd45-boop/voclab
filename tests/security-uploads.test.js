'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { validateUploadedFile } = require('../api/_security');

const asData = (mime, bytes) => 'data:' + mime + ';base64,' + Buffer.from(bytes).toString('base64');

test('real PDF signature is required even with a .pdf extension', () => {
  const file = asData('application/pdf', Buffer.from('MZ' + 'a'.repeat(40)));
  assert.equal(validateUploadedFile('malware.pdf', file, 2500000).ok, false);
});

test('SVG active content is not a supported format', () => {
  const file = asData('image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.equal(validateUploadedFile('danger.svg', file, 2500000).ok, false);
});

test('traversal filenames are rejected without rewriting them', () => {
  const file = asData('text/plain', 'these are simple study vocabulary terms');
  assert.equal(validateUploadedFile('../../x.txt', file, 2500000).ok, false);
  assert.equal(validateUploadedFile('..\\..\\x.txt', file, 2500000).ok, false);
});

test('double extensions and bidirectional Unicode are rejected', () => {
  const file = asData('text/plain', 'these are simple study vocabulary terms');
  assert.equal(validateUploadedFile('evil.php.txt', file, 2500000).ok, false);
  assert.equal(validateUploadedFile('word\u202Etxt.pdf', file, 2500000).ok, false);
});

test('active PDF dictionaries are blocked', () => {
  const file = asData('application/pdf', '%PDF-1.4\n1 0 obj << /OpenAction 2 0 R >> endobj\n%%EOF');
  assert.equal(validateUploadedFile('example.pdf', file, 2500000).ok, false);
});

test('text file supports Arabic names and only plain text', () => {
  const file = asData('text/plain', 'these are simple study vocabulary terms');
  const checked = validateUploadedFile('مفردات 8A&B.txt', file, 2500000);
  assert.equal(checked.ok, true);
  assert.equal(checked.ext, 'txt');
});

test('hard limit is enforced on decoded bytes and on encoded request string', () => {
  const huge = asData('text/plain', Buffer.alloc(2500001, 65));
  assert.equal(validateUploadedFile('large.txt', huge, 2500000).status, 413);
});

test('reject missing server-side limiter configuration in production', async () => {
  // Run with a fresh process so limiter memoization does not hide missing env.
  const { spawnSync } = require('node:child_process');
  const script = "const x=require('./api/_security');x.enforceNetworkRateLimit({headers:{},socket:{}}).then(r=>{if(r.status!==503)process.exit(3)});";
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: require('node:path').resolve(__dirname, '..'),
    env: { ...process.env, VERCEL_ENV:'production', UPSTASH_REDIS_REST_URL:'', UPSTASH_REDIS_REST_TOKEN:'' },
    encoding:'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
});
