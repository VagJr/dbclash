import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const rel = 'scripts/test-release-polish.mjs';
const file = path.join(ROOT, rel);

if (!fs.existsSync(file)) {
  throw new Error('Execute este hotfix na raiz C:\\dbclash.');
}

const backup = `${file}.raid-log-polish-hotfix.bak`;
if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);

let src = fs.readFileSync(file, 'utf8');

const oldAssertion = `  assert.ok(src.includes('escapeHtml(log.text)'));`;
const newAssertion = `  assert.match(src, /escapeHtml\\(log\\.text(?:\\s*\\|\\|\\s*['"][^'"]*['"])?\\)/);`;

if (src.includes(oldAssertion)) {
  src = src.replace(oldAssertion, newAssertion);
} else if (!src.includes(newAssertion)) {
  throw new Error('Assercao antiga de log do Raid nao foi encontrada.');
}

// Keep the security guarantee explicit: raw log.text interpolation is forbidden.
const raidTestMarker = "test('Raid escapa nomes e logs antes de templates HTML'";
const markerIndex = src.indexOf(raidTestMarker);
if (markerIndex < 0) {
  throw new Error('Teste de seguranca do Raid nao encontrado.');
}

const nextTest = src.indexOf('\ntest(', markerIndex + raidTestMarker.length);
const testEnd = nextTest >= 0 ? nextTest : src.length;
const block = src.slice(markerIndex, testEnd);

if (!block.includes("src.includes('${log.text}')")) {
  const injectBefore = block.lastIndexOf('\n});');
  if (injectBefore < 0) throw new Error('Fim do teste Raid nao encontrado.');
  const absolute = markerIndex + injectBefore;
  const guard = `
  assert.equal(src.includes('\${log.text}'), false);
`;
  src = src.slice(0, absolute) + guard + src.slice(absolute);
}

fs.writeFileSync(file, src, 'utf8');

console.log('[OK] teste polish de Raid aceita escapeHtml(log.text || \'\')');
console.log('[OK] protecao contra interpolacao crua de log.text preservada');
console.log('POLISH RAID LOG TEST HOTFIX APLICADO.');
