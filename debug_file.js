const fs = require('fs');
const path = 'C:/Arwin/Thesis/SignLangVisual/src/app/admin/(auth)/login/page.tsx';
let content = fs.readFileSync(path, 'utf8');
// Show the exact bytes around the code tag
const idx = content.indexOf('app_metadata.role');
if (idx >= 0) {
  console.log('Found at:', idx);
  console.log('Context:', JSON.stringify(content.substring(idx-5, idx+40)));
}