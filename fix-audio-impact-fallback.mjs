import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rel = 'js/ui-manager.js';
const file = path.join(root, rel);

if (!fs.existsSync(file)) {
  throw new Error('Execute este hotfix na raiz C:\\dbclash.');
}

const backup = `${file}.audio-impact-hotfix.bak`;
if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);

let src = fs.readFileSync(file, 'utf8');

const oldBlock = `    if (typeof soundEngine.playImpact === 'function') {
      soundEngine.playImpact(attackType, damage);
    } else if (typeof soundEngine.playPunch === 'function') {
      soundEngine.playPunch();
    }`;

const newBlock = `    soundEngine.playImpact?.(attackType, damage);`;

if (src.includes(oldBlock)) {
  src = src.replace(oldBlock, newBlock);
} else if (!src.includes(newBlock)) {
  throw new Error('Bloco triggerImpactEffects em formato inesperado.');
}

fs.writeFileSync(file, src, 'utf8');

console.log('[OK] js/ui-manager.js - fallback generico playPunch removido');
console.log('AUDIO IMPACT HOTFIX APLICADO.');
