import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const file = rel => path.join(ROOT, rel);
const read = rel => fs.readFileSync(file(rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(file(rel), text, 'utf8');

function backup(rel) {
  const src = file(rel);
  if (!fs.existsSync(src)) throw new Error(`Arquivo ausente: ${rel}`);
  const bak = `${src}.capture-marker-hotfix.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(src, bak);
}

function requireNoCaptureMarkers(rel, text) {
  if (text.includes('$1') || text.includes('$2')) {
    throw new Error(`Marcador literal $1/$2 ainda presente em ${rel}`);
  }
}

// ---------------------------------------------------------------------
// 1) Repair server/tag-team-engine.js
// ---------------------------------------------------------------------
backup('server/tag-team-engine.js');
let tag = read('server/tag-team-engine.js');

const brokenTag = /username:\s*entry\.username,\s*\$1\s*isBot:\s*!!entry\.isBot,\s*botDifficulty:\s*entry\.botDifficulty\s*\|\|\s*'normal',\s*\$2/g;
let tagFixes = 0;
tag = tag.replace(brokenTag, () => {
  tagFixes++;
  return `username: entry.username,
        leader: entry.leader,
        isBot: !!entry.isBot,
        botDifficulty: entry.botDifficulty || 'normal',
        downed: false,`;
});

// Also normalize if a previous manual edit partially removed only one marker.
tag = tag.replace(
  /username:\s*entry\.username,\s*\$1\s*isBot:\s*!!entry\.isBot,/g,
  `username: entry.username,
        leader: entry.leader,
        isBot: !!entry.isBot,`
);
tag = tag.replace(
  /botDifficulty:\s*entry\.botDifficulty\s*\|\|\s*'normal',\s*\$2/g,
  `botDifficulty: entry.botDifficulty || 'normal',
        downed: false,`
);

requireNoCaptureMarkers('server/tag-team-engine.js', tag);

const botMetaCount = (tag.match(/isBot:\s*!!entry\.isBot/g) || []).length;
if (botMetaCount < 2) {
  throw new Error(`TagTeam: esperava metadados de bot nos dois times; encontrei ${botMetaCount}.`);
}
const leaderCount = (tag.match(/leader:\s*entry\.leader/g) || []).length;
if (leaderCount < 2) {
  throw new Error(`TagTeam: leader metadata incompleto; encontrei ${leaderCount}.`);
}
const downedCount = (tag.match(/downed:\s*false/g) || []).length;
if (downedCount < 2) {
  throw new Error(`TagTeam: downed metadata incompleto; encontrei ${downedCount}.`);
}

write('server/tag-team-engine.js', tag);
console.log(`[OK] server/tag-team-engine.js reparado (${tagFixes || 'normalizacao'} bloco(s))`);

// ---------------------------------------------------------------------
// 2) Repair server/product-modes.js if the same capture bug reached it.
// ---------------------------------------------------------------------
backup('server/product-modes.js');
let modes = read('server/product-modes.js');

let productFixes = 0;
modes = modes.replace(
  /side,\s*\$1\s*isBot:\s*!!entry\.isBot,\s*\$2/g,
  () => {
    productFixes++;
    return `side,
          connected: true,
          isBot: !!entry.isBot,
          reconnectTimer: null`;
  }
);

// Fallback form if whitespace/format differs.
modes = modes.replace(
  /\$1\s*isBot:\s*!!entry\.isBot,\s*\$2/g,
  () => {
    productFixes++;
    return `connected: true,
          isBot: !!entry.isBot,
          reconnectTimer: null`;
  }
);

requireNoCaptureMarkers('server/product-modes.js', modes);

if (!modes.includes('isBot: !!entry.isBot')) {
  // Insert safely into the Tag Team room slot structure.
  const anchor = `          side,
          connected: true,
          reconnectTimer: null`;
  if (!modes.includes(anchor)) {
    throw new Error('Product modes: nao encontrei slot Tag Team para inserir isBot.');
  }
  modes = modes.replace(
    anchor,
    `          side,
          connected: true,
          isBot: !!entry.isBot,
          reconnectTimer: null`
  );
}

write('server/product-modes.js', modes);
console.log(`[OK] server/product-modes.js reparado (${productFixes} captura(s) literal(is))`);

// ---------------------------------------------------------------------
// 3) Audit all files touched by the AI cycle for accidental capture text.
// ---------------------------------------------------------------------
const auditFiles = [
  'server/bot-ai.js',
  'server/server-engine.js',
  'server/tag-team-engine.js',
  'server/raid-room-engine.js',
  'server/product-modes.js',
  'server.js',
  'scripts/test-release-bot-ai.mjs'
];

for (const rel of auditFiles) {
  const src = read(rel);
  requireNoCaptureMarkers(rel, src);
}

console.log('[OK] auditoria: nenhum marcador literal $1/$2 restante');
console.log('AI FILL CAPTURE MARKER HOTFIX APLICADO.');
