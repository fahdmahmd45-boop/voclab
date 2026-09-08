import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const root = process.cwd();
const cfg = JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const csp = cfg.headers.flatMap(r=>r.headers||[]).find(h=>String(h.key).toLowerCase()==='content-security-policy')?.value;
if (!csp) throw new Error('CSP header missing');

const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
const server = http.createServer((req,res)=>{
  let pathname = decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  if (pathname === '/') pathname = '/index.html';
  const file = path.normalize(path.join(root, pathname));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));

const candidates = ['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath = candidates.find(p=>fs.existsSync(p));
if (!executablePath) throw new Error('No system Chrome/Chromium found');
const browser = await chromium.launch({headless:true, executablePath, args:['--no-sandbox']});
const page = await browser.newPage({ viewport:{width:390,height:844} });
page.setDefaultTimeout(2000);
const bad=[];
page.on('pageerror', e=>bad.push('pageerror: '+e.message));
page.on('console', msg=>{
  const t=msg.text();
  if (msg.type()==='error' && (/content security policy|refused to|violat/i.test(t))) bad.push('console: '+t);
});
const violations=[];
await page.exposeFunction('__cspViolation', v=>violations.push(v));
await page.addInitScript(()=>document.addEventListener('securitypolicyviolation', e=>window.__cspViolation(`${e.violatedDirective} -> ${e.blockedURI}`)));
await page.goto('http://127.0.0.1:4173/', {waitUntil:'domcontentloaded', timeout:15000});
await page.waitForTimeout(2500);

const mainText = await page.locator('main').innerText().catch(()=> '');
if (mainText.trim().length < 250) bad.push(`main content too small (${mainText.trim().length} chars)`);
const visiblePanel = await page.locator('.panel.on').count();
if (!visiblePanel) bad.push('no active panel rendered');

for (const label of ['Browse','Flashcards','Quiz','Spelling','Add Word','Home']) {
  const b=page.getByRole('button',{name:label,exact:true});
  if (await b.count()) {
    await b.first().click({timeout:2000}).catch(()=>{});
    await page.waitForTimeout(100);
  }
}

for (const v of violations) {
  if (!/fonts\.gstatic\.com/.test(v)) bad.push('CSP violation: '+v);
}
await browser.close();
server.close();
if (bad.length) {
  console.error(bad.join('\n'));
  process.exit(1);
}
console.log('CSP browser smoke test passed.');
