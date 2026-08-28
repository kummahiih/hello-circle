/** Verify demo passwords decrypt dist/gate-config.json (alice + bob). */
import { pbkdf2Sync, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';

const ITER = 310000;
const PASSWORDS = [
  ['alice', 'demo-alice-2026'],
  ['bob', 'demo-bob-2026'],
];

function b64(s) {
  return Buffer.from(s, 'base64');
}

function xor(a, b) {
  const o = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i] ^ b[i];
  return o;
}

async function unlock(cfg, password) {
  const share1 = b64(cfg.share1);
  for (const e of cfg.entries || []) {
    if (e.alg && e.alg !== 'PBKDF2-SHA256') continue;
    if (!e.salt || !e.mask) continue;
    const salt = Buffer.concat([b64(e.salt), Buffer.from(cfg.pageId)]);
    const hash = pbkdf2Sync(password, salt, ITER, 32, 'sha256');
    const K = xor(share1, xor(hash, b64(e.mask)));
    try {
      const key = await webcrypto.subtle.importKey(
        'raw',
        K,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      const plain = await webcrypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64(cfg.iv) },
        key,
        b64(cfg.cipher)
      );
      return new TextDecoder().decode(plain);
    } catch {
      /* next entry */
    }
  }
  return null;
}

const cfg = JSON.parse(readFileSync(new URL('../dist/gate-config.json', import.meta.url), 'utf8'));
if (cfg.pageId !== 'hello-circle') {
  console.error('unexpected pageId', cfg.pageId);
  process.exit(1);
}

let failed = false;
for (const [label, pw] of PASSWORDS) {
  const html = await unlock(cfg, pw);
  if (!html || !html.includes('Hello, circle')) {
    console.error('FAIL', label);
    failed = true;
  } else {
    console.log('OK', label);
  }
}

const wrong = await unlock(cfg, 'not-the-demo-password');
if (wrong) {
  console.error('FAIL wrong password unexpectedly unlocked');
  failed = true;
} else {
  console.log('OK wrong password rejected');
}

process.exit(failed ? 1 : 0);
