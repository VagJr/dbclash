import assert from 'node:assert/strict';
import fs from 'node:fs';

let passed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('PASS', name);
    passed += 1;
  } catch (err) {
    console.error('FAIL', name);
    throw err;
  }
}

test('AuthManager importa SocketManager para compartilhar URL do backend', () => {
  const src = fs.readFileSync(new URL('../js/auth-manager.js', import.meta.url), 'utf8');
  assert.ok(src.includes("import { socketManager } from './socket-config.js';"));
  assert.ok(src.includes('if (socketManager?.serverUrl) return socketManager.serverUrl;'));
});

test('SocketManager direciona localhost para porta 3000', () => {
  const src = fs.readFileSync(new URL('../js/socket-config.js', import.meta.url), 'utf8');
  assert.ok(src.includes("host === 'localhost'"));
  assert.ok(src.includes('return `http://${host}:3000`;'));
});

test('UI aguarda login e cadastro assincronos', () => {
  const src = fs.readFileSync(new URL('../js/ui-manager.js', import.meta.url), 'utf8');
  assert.ok(src.includes('const res = await authManager.login('));
  assert.ok(src.includes('const res = await authManager.signUp('));
});

test('service worker nunca devolve Promise que pode resolver null ao respondWith', () => {
  const src = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.ok(src.includes('async function staleWhileRevalidate(request, event)'));
  assert.ok(src.includes('const network = await update;'));
  assert.ok(src.includes('return network || Response.error();'));
  assert.ok(src.includes('event.respondWith(staleWhileRevalidate(request, event));'));
  assert.equal(src.includes('return cached || update || Response.error();'), false);
});

test('service worker mantem API e Socket.io fora do cache', () => {
  const src = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.ok(src.includes("url.pathname.startsWith('/api/')"));
  assert.ok(src.includes("url.pathname.startsWith('/socket.io/')"));
});

test('cadastro duplicado possui codigo estavel e mensagem de username', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes("code: 'ACCOUNT_EXISTS'"));
  assert.ok(src.includes("cleanEmail.endsWith('@dbtcg.local')"));
  assert.ok(src.includes('Este nome de usuario ja esta cadastrado!'));
});

console.log(`RC AUTH TESTS: ${passed} PASS / 0 FAIL`);
