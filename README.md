# hello-circle

Public **example** of a small-circle gated static page, built with [`@kummahiih/private-circle`](https://www.npmjs.com/package/@kummahiih/private-circle).

- **Live demo:** https://hello-circle-demo.vercel.app/
- Clear HTML: `content/index-plaintext.html` (in git for learning).
- **Vercel serves only `dist/`**, encrypted at build time by the npm package.
- Strict CSP: external `gate.js` / `gate.css` + `gate-config.json` (no inline scripts).

## Demo passwords

| User  | Password          | pageId         |
|-------|-------------------|----------------|
| alice | `demo-alice-2026` | `hello-circle` |
| bob   | `demo-bob-2026`   | `hello-circle` |

Intentionally public for the demo. Do not reuse for real secrets.

## Use the npm package in another project

```bash
npm i -D @kummahiih/private-circle

# scaffold (optional)
npx private-circle init

# encrypt → dist/
npx private-circle encrypt \
  --page-id my-site \
  --content content/index-plaintext.html \
  --hashes hashes \
  --out dist
```

Or in `package.json`:

```json
{
  "scripts": {
    "build": "private-circle encrypt --page-id my-site --content content/index.html --hashes hashes --out dist"
  },
  "devDependencies": {
    "@kummahiih/private-circle": "^0.1.0"
  }
}
```

Vercel: set **Build Command** to `npm run build` and **Output Directory** to `dist` (see this repo’s `vercel.json`).

Docs: [npm package](https://www.npmjs.com/package/@kummahiih/private-circle) · [source](https://github.com/kummahiih/private-circle)

## Local build (this repo)

```bash
npm install
npm run build
# open dist/index.html — try alice / demo-alice-2026
```

## Deploy (Vercel)

1. Import this repo.
2. Build settings from `vercel.json`:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. CSP: `script-src 'self'` (no `'unsafe-inline'` for scripts).

## CI

`.github/workflows/encrypt-check.yml` installs `@kummahiih/private-circle`, runs encrypt, and asserts no plaintext and no inline scripts in `dist/`.

## Security notes

- Client-side gate only: ciphertext + masks are downloadable.
- Demo `hashes/` are public on purpose.
- Real circle: private hashes, same-origin `enroll.html`, strong passwords or WebAuthn PRF.

## Related

- https://www.npmjs.com/package/@kummahiih/private-circle
- https://github.com/kummahiih/private-circle
- ADR: `docs/ADR-001-hello-circle.md`
