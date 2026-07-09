const fs = require('fs');
const path = 'C:/Arwin/Thesis/SignLangVisual/src/app/admin/(auth)/login/page.tsx';
let content = fs.readFileSync(path, 'utf8');
console.log('Before:', JSON.stringify(content.substring(1400, 1460)));
// Replace literal " with " entity
content = content.replace(/app_metadata\.role = "admin"/g, 'app_metadata.role = "admin"');
console.log('After:', JSON.stringify(content.substring(1400, 1460)));
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed');