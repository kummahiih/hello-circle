# Threat Model — hello-circle

**Status:** Accepted  
**Date:** 2026-09-06  
**Scope:** This public demo repo and its deployment at `hello-circle-demo.vercel.app`.
Builds on the package-level model in [`@kummahiih/private-circle`](https://github.com/kummahiih/private-circle/blob/main/docs/THREAT_MODEL.md); this document covers the demo deployment specifics.

CSP source of truth for HTTP headers: `vercel.json`.

## System Overview

hello-circle is a statically built, client-side gated page. The build step
(`circle-enroll copy` then `private-circle encrypt`) consumes plaintext content
and enroll JSON, and emits `dist/` containing ciphertext, masks, loader assets,
gate UI, and enroll UI. Verification is fully client-side; there is no
server-side authentication or logging.

Key properties assumed throughout:

- PBKDF2-SHA256 with random 16-byte salt, salt bound to `pageId`
- `iterations >= 310000` enforced fail-closed by encrypt
- WebAuthn PRF passkeys origin-bound (`rpId` must match the deploy origin)
- Two CSPs (see `vercel.json`):
  - **Gate `/`:** `default-src 'none'; script-src 'self' blob:; style-src 'self' blob:; connect-src 'self'; img-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
  - **Enroll `/enroll`:** same except `script-src 'self'; style-src 'self'; connect-src 'none'` (no `blob:`)
  - Neither policy includes `'unsafe-inline'`
- CI asserts dist layout, absence of plaintext markers in `dist/index.html`,
  absence of `hashes/` under `dist/`, no enroll `<style>`, and no `'unsafe-inline'`
  in `vercel.json` / `dist/enroll.html`

Git may still contain a stale checked-in `dist/index.html` from an older loader.
Vercel builds `dist/` fresh; treat the Git copy as non-authoritative.

## Trust Boundaries

| Boundary | Trusted | Untrusted |
| --- | --- | --- |
| Build machine (CI runner) | Plaintext content, `hashes/`, `K` at build time | npm registry packages at install time |
| Vercel deploy pipeline | Operator GitHub + Vercel accounts | Anything the pipeline emits if those accounts are compromised |
| Public CDN | — | All deployed `dist/` files (ciphertext, masks, gate/enroll JS) |
| Visitor browser | Web Crypto / WebAuthn platform APIs | Page before unlock; extensions; other origins; anything injected into the page |
| Enroll origin | Same origin as gate for PRF | Cross-origin hosts and Vercel preview URLs |
| Operator-authored content | Input to encrypt (gate will decrypt and `document.write` it) | From a *visitor* view: that HTML runs with page-origin privileges after unlock |

## STRIDE Analysis

### Spoofing

| Threat | Mitigation | Residual |
| --- | --- | --- |
| Impersonating an enrolled user | Verification is possession-of-secret; PRF passkeys cryptographically bound to `rpId` | Anyone holding a valid password *is* that user. Accepted for demo |
| Phishing gate/enroll pages on lookalike domains | PRF enrollment and unlock fail on wrong origin | Password path has no origin binding — phishing a demo password is trivial, but demo secrets are public anyway |
| Extra enroll JSON slipped into the build | Encrypt rejects JSON whose `pageId` is not `hello-circle`. Only files the operator places in `hashes/` become unlockers | Anyone can *mint* a valid enroll file with their own password. That is not forgery of an existing identity; inclusion in `hashes/` is the control. pageId-bound salt only stops cross-page reuse of a hash |

### Tampering

| Threat | Mitigation | Residual |
| --- | --- | --- |
| Swapped/malicious `gate.js` or ciphertext in deploy | Strict CSP (`default-src 'none'`, no `'unsafe-inline'`), `X-Frame-Options: DENY`, `nosniff` | CSP cannot defend a fully compromised deploy pipeline — attacker serves their own files and headers. Out of model scope |
| Stale forked `enroll.html` in repo root | `encrypt` copies cwd `enroll.html` before the circle-enroll package. CI rejects `<style` and `'unsafe-inline'` | Fork can still drift in behavior if CI does not cover that path |
| Stray JSON / `hashes/` inside `dist/` | CI layout assertions; encrypt refuses dist containing `hashes/` | — |
| CSP regression reintroducing `'unsafe-inline'` | CI asserts the directive stays absent from `vercel.json` and `dist/enroll.html` | — |

### Repudiation

| Threat | Mitigation | Residual |
| --- | --- | --- |
| No proof of who unlocked a page or created an enroll file | `created` timestamp + optional label in enroll JSON | Timestamps are client-controlled; zero server logging is inherent to the static design |

### Information Disclosure

| Threat | Mitigation | Residual |
| --- | --- | --- |
| Offline PBKDF2 attack against public ciphertext + masks | 310k iterations; unique pageId-bound salts defeat precomputation/rainbow tables | No client-side rate limiting is possible. High severity for weak passwords; demo passwords are disclosed by design |
| Password reuse by demo visitors | README warning; demo secrets clearly labeled | Real exposure if someone uses a genuine password as a demo credential |
| Enroll JSON + published mask leak ⇒ direct recovery of build key `K` | Production rule: never commit *real* `hashes/`, vault or delete after deploy, rotate `K` on suspicion | **Critical for operational mistakes.** This demo repo *does* commit labeled throwaway hashes on purpose |
| Plaintext leaking into deployed `dist/` | CI grep for plaintext markers in `dist/index.html` | Content source remains public on GitHub by design (see ADR) |
| Post-unlock XSS via operator-controlled content | Content is repo-reviewed; single-operator demo | Malicious/compromised content runs with page origin privileges after unlock — inherited from private-circle trust boundary |
| Post-unlock inline CSS/JS in content | Gate HTTP CSP survives `document.write`. Current `content/index-plaintext.html` still has a `<style>` block and a `style="…"` attribute; those are blocked under `style-src 'self' blob:` | Content must use external (or blob-rewritten) CSS/JS, or it will render unstyled / scripts will not run |

### Denial of Service

| Threat | Mitigation | Residual |
| --- | --- | --- |
| Vercel outage / destroyed or incomplete dist | CI layout assertions on every push | Standard static-host availability |
| Lost sole PRF credential without password backup | Demo users have public password fallback | **Permanent lockout** is an accepted property of a PRF-only circle |
| Malformed enroll JSON breaking builds | Encrypt validation (iteration floor, format checks, pageId match) | — |

### Elevation of Privilege

| Threat | Mitigation | Residual |
| --- | --- | --- |
| XSS stealing typed password or derived key material | `'unsafe-inline'` excluded; `default-src 'none'`; enroll page `connect-src 'none'` isolates credential derivation from network | — |
| `blob:` abuse in gate `script-src` / `style-src` | Required for multifile decrypt (rewriting extra JS/CSS to blob URLs). Not a substitute for `enroll.css` / `gate.css` | Accepted; scope is same-origin blob URLs created by `gate.js` |
| npm supply-chain compromise at build time | `npm ci` uses `package-lock.json` (currently `circle-enroll@0.1.2`, `private-circle@0.3.3`). `package.json` ranges are `^0.1.2` / `^0.3.3` — a lockfile refresh can pull newer caret-compatible releases (0.1.3 is already on npm) | Compromised publish tokens upstream would reach CI on the next lock update. SRI for gate assets: deferred (same-origin + CSP cover the primary threat) |
| Misconfigured host serving wrong `Content-Type` | Operator runbook documents required headers (`gate.js` → `application/javascript`, etc.); CSP on all responses | Deployment-level, monitored via runbook |

## Accepted Risks

- Public demo passwords (`demo-alice-2026`, `demo-bob-2026`) are intentional;
  do not reuse real credentials on the demo page
- Public demo enroll hashes are labeled demo-only and live in this public repo;
  production circles must keep enroll JSON private (see private-circle "Hashes hygiene")
- Post-unlock, decrypted content runs with full page privileges — visitors
  extend the same trust to the circle author as to the site host
- Client-side verification cannot rate-limit guesses; documented in
  `assets/security.md` of private-circle
- Gate `blob:` is an intentional CSP relaxation for multifile unlock

## Prioritized Notes

1. Keep CI assertions green on CSP hygiene — they are the regression guard for EoP
2. If this pattern graduates beyond a demo: move `hashes/` out of public git,
   keep enroll JSON + `K` vaulted, rotate `K` on suspected leak
3. Consider SRI on `gate.js` only if third-party asset mirroring becomes common
4. Move leftover inline CSS out of `content/index-plaintext.html` if the unlocked
   page should actually pick up those styles under the published CSP
5. Documented in AI disclosure: this repo is AI-assisted; see `docs/AI_DISCLOSURE.md`

## Related

- `docs/ADR-001-hello-circle.md`
- `vercel.json` (HTTP CSP)
- `.github/workflows/encrypt-check.yml`
- [`@kummahiih/private-circle` THREAT_MODEL.md](https://github.com/kummahiih/private-circle/blob/main/docs/THREAT_MODEL.md)
- [`@kummahiih/circle-enroll` THREAT_MODEL.md](https://github.com/kummahiih/circle-enroll/blob/main/docs/THREAT_MODEL.md)
