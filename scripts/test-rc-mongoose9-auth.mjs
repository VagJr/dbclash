import assert from 'node:assert/strict';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { User } from '../server/user-model.js';

let passed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => {
        console.log('PASS', name);
        passed += 1;
      });
    }
    console.log('PASS', name);
    passed += 1;
  } catch (err) {
    console.error('FAIL', name);
    throw err;
  }
}

await test('pre save do User nao usa next() no Mongoose 9', () => {
  const src = fs.readFileSync(new URL('../server/user-model.js', import.meta.url), 'utf8');
  assert.ok(src.includes("UserSchema.pre('save', async function () {"));
  assert.equal(src.includes("async function (next)"), false);
  assert.equal(src.includes('return next()'), false);
  assert.equal(src.includes('next(err)'), false);
});

await test('hook continua usando bcrypt antes do save', () => {
  const src = fs.readFileSync(new URL('../server/user-model.js', import.meta.url), 'utf8');
  assert.ok(src.includes('bcrypt.genSalt(10)'));
  assert.ok(src.includes('bcrypt.hash(this.password, salt)'));
});

await test('comparePassword valida hash bcrypt', async () => {
  const password = 'TesteSeguro123';
  const hash = await bcrypt.hash(password, 10);
  const user = new User({
    uid: 'unit_mongoose9_auth',
    displayName: 'Unit Test',
    email: 'unit-mongoose9-auth@example.local',
    password: hash
  });

  user.password = hash;
  assert.equal(await user.comparePassword(password), true);
  assert.equal(await user.comparePassword('senha-errada'), false);
});

console.log(`RC MONGOOSE9 AUTH TESTS: ${passed} PASS / 0 FAIL`);
