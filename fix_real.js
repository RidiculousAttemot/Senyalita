const fs = require('fs');
const path = 'C:/Arwin/Thesis/SignLangVisual/src/app/admin/(auth)/login/page.tsx';
let content = fs.readFileSync(path, 'utf8');
// Replace literal double quotes with HTML entity
content = content.replace(/app_metadata\.role = "admin"/g, 'app_metadata.role = "admin"');
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed');