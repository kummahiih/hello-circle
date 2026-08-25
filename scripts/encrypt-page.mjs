#!/usr/bin/env node
/**
 * Build gated static page from clear HTML + enrollment hash JSON files.
 * Passwords are never read. Hashes are page-scoped via pageId.
 *
 * Usage:
 *   node encrypt-page.mjs --page-id metsa-piiri --content content/index.html --hashes hashes/ --out dist/
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function parseArgs(argv) {
  const out = { content: 'content/index.html', hashes: 'hashes', outDir: 'dist', pageId: '' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--content') out.content = argv[++i];
    else if (argv[i] === '--hashes') out.hashes = argv[++i];
    else if (argv[i] === '--out') out.outDir = argv[++i];
    else if (argv[i] === '--page-id') out.pageId = argv[++i];
  }
  return out;
}

function normalizePageId(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '-');
}

function b64(buf) {
  return Buffer.from(buf).toString('base64');
}

function xorBuf(a, b) {
  if (a.length !== b.length) throw new Error('xor length mismatch');
  const o = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i] ^ b[i];
  return o;
}

/** Same as enroll.html: PBKDF2 salt = randomSalt || UTF-8(pageId) */
function buildPbkdf2Salt(randomSalt, pageId) {
  return Buffer.concat([randomSalt, Buffer.from(pageId, 'utf8')]);
}

function loadHashes(dir, pageId) {
  if (!fs.existsSync(dir)) throw new Error('hashes dir missing: ' + dir);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (!files.length) throw new Error('no .json enroll files in ' + dir);
  const list = [];
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (raw.v !== 1 || !raw.hash) {
      throw new Error('invalid enroll file (missing v or hash): ' + f);
    }
    const alg = raw.alg || 'PBKDF2-SHA256';
    if (alg !== 'PBKDF2-SHA256' && alg !== 'WebAuthn-PRF') {
      throw new Error('unsupported alg in ' + f + ': ' + alg);
    }
    if (alg === 'PBKDF2-SHA256' && !raw.salt) {
      throw new Error('PBKDF2 enroll missing salt: ' + f);
    }
    const filePage = normalizePageId(raw.pageId || '');
    if (!filePage) {
      throw new Error('missing pageId in enroll file: ' + f + ' (re-enroll with pageId)');
    }
    if (filePage !== pageId) {
      console.warn('skip (pageId mismatch):', f, 'has', filePage, 'expected', pageId);
      continue;
    }
    if (alg === 'PBKDF2-SHA256' && (raw.iterations || 0) < 310000) {
      console.warn('warning: iterations < 310000 in', f);
    }
    const hashBuf = Buffer.from(raw.hash, 'base64');
    if (hashBuf.length !== 32) {
      throw new Error('hash must be 32 bytes: ' + f);
    }
    list.push({
      file: f,
      alg,
      salt: alg === 'PBKDF2-SHA256' ? Buffer.from(raw.salt, 'base64') : null,
      hash: hashBuf,
      label: raw.label || f,
      pageId: filePage
    });
  }
  if (!list.length) {
    throw new Error('no enroll files matched pageId=' + pageId);
  }
  return list;
}

function buildLoader({ pageId, share1B64, ivB64, cipherB64, entries }) {
  const entriesJson = JSON.stringify(entries);
  const pageIdJson = JSON.stringify(pageId);
  const hasPrf = entries.some((e) => e.alg === 'WebAuthn-PRF');
  const hasPbkdf = entries.some((e) => e.alg === 'PBKDF2-SHA256' || !e.alg);
  return `<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Kirjaudu</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 24rem; margin: 3rem auto; padding: 0 1rem; }
    input, button { font-size: 16px; width: 100%; padding: 0.6rem; box-sizing: border-box; }
    button { margin-top: 0.75rem; cursor: pointer; }
    .hint { color: #555; font-size: 0.85rem; }
    .err { color: #b00020; }
    .sep { margin: 1.25rem 0 0.5rem; font-size: 0.8rem; color: #888; text-align: center; }
  </style>
</head>
<body>
  <h1>Kirjaudu</h1>
  <p class="hint">Sivu on salattu (<span id="pid"></span>).</p>
  ${hasPbkdf ? `<input id="pw" type="password" autocomplete="current-password" placeholder="Salasana" />
  <button type="button" id="go">Avaa salasanalla</button>` : ''}
  ${hasPrf ? `${hasPbkdf ? '<p class="sep">tai</p>' : ''}
  <button type="button" id="go-prf">Avaa passkeyllä (WebAuthn PRF)</button>` : ''}
  <p id="status" class="hint"></p>
  <script>
(function () {
  var PAGE_ID = ${pageIdJson};
  var SHARE1 = "${share1B64}";
  var IV = "${ivB64}";
  var CIPHER = "${cipherB64}";
  var ENTRIES = ${entriesJson};
  var ITER = 310000;
  document.getElementById("pid").textContent = PAGE_ID;

  function b64ToU8(b64) {
    var s = atob(b64);
    var u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  function xorU8(a, b) {
    var o = new Uint8Array(a.length);
    for (var i = 0; i < a.length; i++) o[i] = a[i] ^ b[i];
    return o;
  }
  function buildPbkdf2Salt(randomSaltU8, pageId) {
    var pageBytes = new TextEncoder().encode(pageId);
    var out = new Uint8Array(randomSaltU8.length + pageBytes.length);
    out.set(randomSaltU8, 0);
    out.set(pageBytes, randomSaltU8.length);
    return out;
  }
  function prfSaltForPage(pageId) {
    return new TextEncoder().encode("circle-prf:v1:" + pageId);
  }

  async function deriveHash(password, saltU8, pageId) {
    var pbkdf2Salt = buildPbkdf2Salt(saltU8, pageId);
    var key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    var bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: pbkdf2Salt, iterations: ITER, hash: "SHA-256" },
      key,
      256
    );
    return new Uint8Array(bits);
  }

  async function tryDecryptWithHash(hashU8) {
    var share1 = b64ToU8(SHARE1);
    var iv = b64ToU8(IV);
    var cipher = b64ToU8(CIPHER);
    for (var i = 0; i < ENTRIES.length; i++) {
      var e = ENTRIES[i];
      var mask = b64ToU8(e.mask);
      if (hashU8.length !== mask.length) continue;
      var share2 = xorU8(hashU8, mask);
      var K = xorU8(share1, share2);
      try {
        var key = await crypto.subtle.importKey("raw", K, { name: "AES-GCM" }, false, ["decrypt"]);
        var plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, cipher);
        return new TextDecoder().decode(plain);
      } catch (err) { /* next */ }
    }
    return null;
  }

  async function tryUnlockPassword(password) {
    for (var i = 0; i < ENTRIES.length; i++) {
      var e = ENTRIES[i];
      if (e.alg && e.alg !== "PBKDF2-SHA256") continue;
      if (!e.salt) continue;
      var salt = b64ToU8(e.salt);
      var hash = await deriveHash(password, salt, PAGE_ID);
      var html = await tryDecryptWithHash(hash);
      if (html) return html;
    }
    return null;
  }

  async function tryUnlockPrf() {
    if (!window.PublicKeyCredential) throw new Error("Selain ei tue WebAuthn");
    var salt = prfSaltForPage(PAGE_ID);
    var challenge = crypto.getRandomValues(new Uint8Array(32));
    var cred = await navigator.credentials.get({
      publicKey: {
        challenge: challenge.buffer,
        rpId: location.hostname,
        userVerification: "preferred",
        timeout: 60000,
        extensions: { prf: { eval: { first: salt } } }
      }
    });
    if (!cred) return null;
    var ext = cred.getClientExtensionResults();
    if (!ext || !ext.prf || !ext.prf.results || !ext.prf.results.first) {
      throw new Error("PRF-tulos puuttuu (authenticator ei tue tai ei palauttanut)");
    }
    var prfHash = new Uint8Array(ext.prf.results.first);
    return tryDecryptWithHash(prfHash);
  }

  function showHtml(html) {
    document.open();
    document.write(html);
    document.close();
  }

  var goBtn = document.getElementById("go");
  if (goBtn) {
    goBtn.addEventListener("click", function () {
      var status = document.getElementById("status");
      var pwEl = document.getElementById("pw");
      var pw = pwEl ? pwEl.value : "";
      status.className = "hint";
      status.textContent = "Avataan…";
      if (!pw) { status.textContent = "Syötä salasana."; status.className = "hint err"; return; }
      tryUnlockPassword(pw).then(function (html) {
        if (!html) {
          status.textContent = "Virheellinen salasana tai vioittunut data.";
          status.className = "hint err";
          return;
        }
        showHtml(html);
      }).catch(function () {
        status.textContent = "Purku epäonnistui.";
        status.className = "hint err";
      });
    });
  }

  var prfBtn = document.getElementById("go-prf");
  if (prfBtn) {
    prfBtn.addEventListener("click", function () {
      var status = document.getElementById("status");
      status.className = "hint";
      status.textContent = "Odota passkey-vahvistusta…";
      tryUnlockPrf().then(function (html) {
        if (!html) {
          status.textContent = "Passkey ei avannut sivua (väärä credential tai data).";
          status.className = "hint err";
          return;
        }
        showHtml(html);
      }).catch(function (e) {
        status.textContent = "PRF-virhe: " + (e && e.message ? e.message : e);
        status.className = "hint err";
      });
    });
  }
})();
  </script>
</body>
</html>
`;
}

function main() {
  const args = parseArgs(process.argv);
  const pageId = normalizePageId(args.pageId);
  if (!pageId || pageId.length < 2) {
    console.error('Required: --page-id <id>  (e.g. --page-id metsa-piiri)');
    process.exit(1);
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(pageId)) {
    console.error('Invalid pageId. Use a-z, 0-9, ".", "_", "-"');
    process.exit(1);
  }

  const clear = fs.readFileSync(args.content);
  const enrolls = loadHashes(args.hashes, pageId);

  const K = crypto.randomBytes(32);
  const share1 = crypto.randomBytes(32);
  const share2 = xorBuf(K, share1);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', K, iv);
  const encBody = Buffer.concat([cipher.update(clear), cipher.final()]);
  const tag = cipher.getAuthTag();
  const cipherFull = Buffer.concat([encBody, tag]);

  const entries = enrolls.map((e) => {
    const mask = xorBuf(e.hash, share2);
    const entry = {
      alg: e.alg,
      mask: b64(mask),
      label: e.label
    };
    if (e.alg === 'PBKDF2-SHA256') {
      entry.salt = b64(e.salt);
    }
    return entry;
  });

  fs.mkdirSync(args.outDir, { recursive: true });
  const loader = buildLoader({
    pageId,
    share1B64: b64(share1),
    ivB64: b64(iv),
    cipherB64: b64(cipherFull),
    entries
  });
  fs.writeFileSync(path.join(args.outDir, 'index.html'), loader, 'utf8');
  fs.writeFileSync(
    path.join(args.outDir, 'robots.txt'),
    'User-agent: *\nDisallow: /\n',
    'utf8'
  );

  // Copy public enrollment page into dist/ so it is served from the same origin.
  // Looks for enroll.html in project root or assets/.
  const enrollCandidates = [
    path.join(process.cwd(), 'enroll.html'),
    path.join(process.cwd(), 'assets', 'enroll.html'),
    path.resolve(path.dirname(args.content || '.'), '..', 'enroll.html'),
  ];
  let enrollCopied = false;
  for (const src of enrollCandidates) {
    if (fs.existsSync(src) && fs.statSync(src).isFile()) {
      const dest = path.join(args.outDir, 'enroll.html');
      fs.copyFileSync(src, dest);
      console.log('Copied public enroll page →', dest);
      enrollCopied = true;
      break;
    }
  }
  if (!enrollCopied) {
    console.log('Note: no enroll.html found in project root or assets/ (optional)');
  }

  console.log('pageId:', pageId);
  console.log('Wrote', path.join(args.outDir, 'index.html'));
  console.log('Entries:', entries.length);
}

main();
