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
  if (!fs.existsSync(full)) throw new Error(`Arquivo ausente: ${rel}`);
  const bak = `${full}.rc1-mongoose9-hotfix.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(full, bak);
}

backup('server/user-model.js');
backup('package.json');

let userModel = read('server/user-model.js');

const oldHook = `UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});`;

const newHook = `UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});`;

if (userModel.includes(oldHook)) {
  userModel = userModel.replace(oldHook, newHook);
} else if (!userModel.includes("UserSchema.pre('save', async function () {")) {
  throw new Error('Hook pre(save) em formato inesperado. Nenhuma alteracao aplicada.');
}

write('server/user-model.js', userModel);
console.log('[OK] server/user-model.js - middleware Mongoose 9 corrigido');

const sourceDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const testSource = fs.readFileSync(path.join(sourceDir, 'test-rc-mongoose9-auth-source.mjs'), 'utf8');
write('scripts/test-rc-mongoose9-auth.mjs', testSource);
console.log('[OK] scripts/test-rc-mongoose9-auth.mjs');

const pkg = JSON.parse(read('package.json'));
pkg.scripts ||= {};
pkg.scripts['test:rc-mongoose9-auth'] = 'node scripts/test-rc-mongoose9-auth.mjs';

const currentRcCheck = pkg.scripts['rc:check'] || '';
if (!currentRcCheck.includes('test:rc-mongoose9-auth')) {
  if (currentRcCheck.includes('npm run rc:verify')) {
    pkg.scripts['rc:check'] = currentRcCheck.replace(
      'npm run rc:verify',
      'npm run test:rc-mongoose9-auth && npm run rc:verify'
    );
  } else {
    pkg.scripts['rc:check'] =
      'npm run release:check && npm run test:rc-auth && npm run test:rc-mongoose9-auth && npm run rc:verify && npm run rc:report';
  }
}

write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json - regression test conectado ao rc:check');

console.log('RC1 MONGOOSE 9 AUTH HOTFIX APLICADO.');
