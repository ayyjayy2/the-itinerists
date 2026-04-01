const fs = require('fs');
const path = require('path');

const VERSION_NUMBER = '0.0.6'; // bump this manually on each release

const now = new Date();
const month = now.toLocaleString('en-US', { month: 'short' });
const day = now.getDate();
const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
const buildDate = `${month} ${day} @ ${time}`;

const content = `// Auto-generated at build time — do not edit manually.\nexport const APP_VERSION = '${VERSION_NUMBER}';\nexport const APP_BUILD_DATE = '${buildDate}';\n`;
fs.writeFileSync(path.join(__dirname, '../src/version.ts'), content);
console.log(`[version] ${VERSION_NUMBER} — ${buildDate}`);
