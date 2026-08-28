const fs = require('fs');
const path = require('path');

const dir = 'd:/downloads/system/system/revenue-treasury-system/revenue-treasury-system/frontend/src/citizen-portal';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove {/* ... */}
  content = content.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  
  // Remove /* ... */
  content = content.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Remove // ... (only if it's not inside a URL like http://)
  // Look for // that is either at start of line, or preceded by whitespace
  content = content.replace(/(^|\s)\/\/.*$/gm, '');

  // Remove empty lines that might have been left behind
  content = content.replace(/^\s*[\r\n]/gm, '');

  fs.writeFileSync(filePath, content);
}
console.log('Done stripping comments from ' + files.length + ' files.');
