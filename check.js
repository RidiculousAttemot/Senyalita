const fs = require('fs');
const path = 'C:/Arwin/Thesis/SignLangVisual/src/app/admin/(auth)/login/page.tsx';
let content = fs.readFileSync(path, 'utf8');
console.log('Line 38:', content.split('\n')[37]);
console.log('Has literal quote:', content.includes('app_metadata.role = "admin"'));