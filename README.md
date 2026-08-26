# hello-circle

Public **example** of a small-circle gated static page, built with [`@kummahiih/private-circle`](https://www.npmjs.com/package/@kummahiih/private-circle).

- **Live demo:** https://hello-circle-demo.vercel.app/
- Clear HTML lives in `content/index-plaintext.html` (in git for learning).
- **Vercel serves only `dist/`**, produced by encrypting at build time.
- Loader uses **external** `gate.js` / `gate.css` + `gate-config.json` (strict CSP, no inline scripts).
- Two demo users (passwords below).

## Demo passwords

| User  | Password          | pageId         |
|-------|-------------------|----------------|
| alice | `demo-alice-2026` | `hello-circle` |
| bob   | `demo-bob-2026`   | `hello-circle` |

These are **intentionally public** for the demo. Do not reuse them for real secrets.

## Local build

```bash
npm install
npm run build
```

Open `dist/index.html` in a browser, enter a demo password.

## Deploy (Vercel)

1. Import this repo.
2. **Root directory:** repository root (default).
3. Build settings come from `vercel.json`:
   - **Build Command:** `npm run build` → `@kummahiih/private-circle` encrypt → `dist/`
   - **Output Directory:** `dist`
4. CSP headers omit `'unsafe-inline'` for scripts (`script-src 'self'`).

## GitHub Action

`.github/workflows/encrypt-check.yml` installs the package, encrypts, and checks that `dist/` has no plaintext and no inline scripts.

## Security notes

- Client-side gate only: ciphertext + masks are downloadable; weak passwords can be guessed offline.
- Demo hashes in `hashes/` are public on purpose.
- For a real circle: keep `hashes/` private, enroll via same-origin `enroll.html`, strong unique passwords or WebAuthn PRF.

## Related

- https://www.npmjs.com/package/@kummahiih/private-circle
- https://github.com/kummahiih/private-circle
- ADR: `docs/ADR-001-hello-circle.md`
