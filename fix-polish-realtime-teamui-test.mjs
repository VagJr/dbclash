import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const rel = 'scripts/test-release-polish.mjs';
const file = path.join(ROOT, rel);

if (!fs.existsSync(file)) {
  throw new Error('Execute este hotfix na raiz C:\\dbclash.');
}

const backup = `${file}.realtime-teamui-polish-hotfix.bak`;
if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);

let src = fs.readFileSync(file, 'utf8');

const startMarker = "test('Tag Team nao usa innerHTML com username'";
const start = src.indexOf(startMarker);
if (start < 0) {
  throw new Error('Teste antigo de Tag Team nao encontrado.');
}

const nextTest = src.indexOf("\ntest(", start + startMarker.length);
const end = nextTest >= 0 ? nextTest : src.length;

const replacement = `test('Squad HUD realtime escapa dados dinamicos antes de usar innerHTML', () => {
  const src = fs.readFileSync(new URL('../js/team-ui.js', import.meta.url), 'utf8');

  assert.ok(src.includes("import { escapeHtml } from './safe-dom.js';"));

  // User-controlled strings must be escaped before entering template HTML.
  assert.ok(src.includes('escapeHtml(member.username)'));
  assert.ok(src.includes('escapeHtml(member.uid)'));
  assert.ok(src.includes("escapeHtml(member.leader?.name || '')"));
  assert.ok(src.includes("escapeHtml(you.username || 'Voce')"));
  assert.ok(src.includes("escapeHtml(you.leader?.name || '')"));
  assert.ok(src.includes("escapeHtml(card.name)"));
  assert.ok(src.includes("escapeHtml(log.text || '')"));

  // The old unsafe pattern must not return.
  assert.equal(src.includes('\${member.username}'), false);
  assert.equal(src.includes('\${you.username}'), false);
  assert.equal(src.includes('\${card.name}'), false);
});
`;

src = src.slice(0, start) + replacement + src.slice(end);

fs.writeFileSync(file, src, 'utf8');
console.log('[OK] scripts/test-release-polish.mjs atualizado para Squad HUD realtime');
console.log('POLISH REALTIME TEAM UI TEST HOTFIX APLICADO.');
