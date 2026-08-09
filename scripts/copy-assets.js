const fs = require('fs');
const path = require('path');

const assets = [
  'lib/login-page.html',
  'lib/login-page-client.js',
];

for (const asset of assets) {
  fs.cpSync(path.join('src', asset), path.join('dist', asset));
}
