import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function write(rel, text) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text, 'utf8');
}
function backup(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Arquivo obrigatorio nao encontrado: ${rel}`);
  const bak = `${full}.release-candidate-01.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(full, bak);
}

for (const rel of ['package.json']) backup(rel);

if (!fs.existsSync(path.join(root, 'scripts', 'test-release-polish.mjs'))) {
  throw new Error('Release Fix 07 nao detectado.');
}
if (!fs.existsSync(path.join(root, 'scripts', 'release-static-audit.mjs'))) {
  throw new Error('Release Static Audit nao detectado.');
}

const sourceDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

for (const [src, dest] of [
  ['rc-verify-source.mjs', 'scripts/rc-verify.mjs'],
  ['rc-report-source.mjs', 'scripts/rc-report.mjs'],
  ['RELEASE_CANDIDATE_SMOKE_TESTS.md', 'RELEASE_CANDIDATE_SMOKE_TESTS.md']
]) {
  const content = fs.readFileSync(path.join(sourceDir, src), 'utf8');
  write(dest, content);
  console.log(`[OK] ${dest}`);
}

const pkg = JSON.parse(read('package.json'));
pkg.version = '1.0.0-rc.1';
pkg.scripts ||= {};
pkg.scripts['rc:verify'] = 'node scripts/rc-verify.mjs';
pkg.scripts['rc:verify:prod'] = 'node scripts/rc-verify.mjs --production';
pkg.scripts['rc:report'] = 'node scripts/rc-report.mjs';
pkg.scripts['rc:check'] = 'npm run release:check && npm run rc:verify && npm run rc:report';

write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json -> 1.0.0-rc.1');
console.log('RELEASE CANDIDATE 01 PREPARED.');
