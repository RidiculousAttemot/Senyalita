const fs = require('fs');
const path = 'C:/Arwin/Thesis/SignLangVisual/src/app/admin/(auth)/login/page.tsx';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
console.log('Line 38:', lines[37]);
console.log('Has entity:', content.includes('"'));
console.log('Has double quote:', content.includes('"'));