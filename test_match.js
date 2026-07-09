const fs = require('fs');
const path = 'C:/Arwin/Thesis/SignLangVisual/src/app/admin/(auth)/login/page.tsx';
let content = fs.readFileSync(path, 'utf8');
console.log('Testing regex match:');
const match = content.match(/app_metadata\.role = "admin"/);
console.log('Match:', match);