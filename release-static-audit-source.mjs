import fs from 'node:fs';

const failures = [];
const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const checks = [
  ['server.js', /origin\s*:\s*['"]\*['"]/, 'CORS wildcard ainda presente'],
  ['index.html', /serviceWorker\.getRegistrations\(\)/, 'cache purge/service worker unregister ainda presente'],
  ['index.html', /caches\.delete\(name\)/, 'cache purge global ainda presente'],
  ['js/ui-manager.js', /MOCK_GLOBAL_LEADERBOARD/, 'leaderboard mock ainda presente'],
  ['js/ui-manager.js', /DOJO_RANKINGS/, 'dojo mock ainda presente'],
  ['js/ui-manager.js', /MODO RANQUEADO 2v2 EM BREVE/i, 'stub 2v2 ainda presente'],
  ['js/ui-manager.js', /bubble\.innerHTML\s*=/, 'chat ainda injeta innerHTML'],
  ['js/auth-database.js', /btoa\s*\(/, 'senha local btoa ainda presente'],
  ['js/auth-manager.js', /Online login failed/i, 'fallback de login falso ainda presente'],
  ['js/multiplayer-manager.js', /createRoom\(\)\s*\{\s*return null;/, 'stub createRoom ainda presente'],
  ['js/multiplayer-manager.js', /joinRoom\(\)\s*\{\s*return false;/, 'stub joinRoom ainda presente']
];

for (const [rel, pattern, message] of checks) {
  const src = read(rel);
  if (pattern.test(src)) failures.push(`${rel}: ${message}`);
}

const server = read('server.js');
const disconnectHandlers = (server.match(/socket\.on\(['"]disconnect['"]/g) || []).length;
if (disconnectHandlers > 1) {
  failures.push(`server.js: ${disconnectHandlers} handlers disconnect no socket principal`);
}

if (failures.length) {
  console.error('RELEASE STATIC AUDIT: FAIL');
  for (const failure of failures) console.error('-', failure);
  process.exit(1);
}

console.log('RELEASE STATIC AUDIT: PASS / 0 BLOCKERS');
