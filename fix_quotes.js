const fs = require('fs');
const path = 'C:/Arwin/Thesis/SignLangVisual/src/app/admin/(auth)/login/page.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/<code> app_metadata\.role = "admin" <\/code>/, '<code> app_metadata.role = "admin" </code>');
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed');