const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
const tag = '<script src="/auth.js" defer></script>';

if (html.includes(tag)) {
  console.log('Auth loader already present.');
  process.exit(0);
}

if (!html.includes('</body>')) {
  throw new Error('Could not find </body> in index.html');
}

html = html.replace('</body>', `${tag}\n</body>`);
fs.writeFileSync(path, html);
console.log('Inserted VocLab auth loader.');
