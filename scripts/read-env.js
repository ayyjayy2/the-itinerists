/**
 * read-env.js — minimal .env parser shared by the seed scripts.
 * Same format rules as gen-env.js: KEY=VALUE lines, # comments ignored.
 */
const fs = require('fs');
const path = require('path');

function readEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    console.error(`ERROR: .env not found at ${envPath}`);
    console.error('Copy .env.example to .env and fill in the values.');
    process.exit(1);
  }
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key.trim()] = rest.join('=').trim();
  }
  return env;
}

module.exports = { readEnv };
