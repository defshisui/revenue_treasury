const fs = require('fs');
const path = require('path');

const dir = 'd:/downloads/system/system/revenue-treasury-system/revenue-treasury-system/frontend/src/citizen-portal';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  content = content.replace(/\/\*[\s\S]*?\*\//g, '');


  content = content.replace(/(^|\s)\/\/.*$/gm, '');

  content = content.replace(/^\s*[\r\n]/gm, '');

  fs.writeFileSync(filePath, content);
}
console.log('Done stripping comments from ' + files.length + ' files.');
