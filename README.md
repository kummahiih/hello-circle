# hello-circle

Public **example** of a small-circle gated static page, built with [`@kummahiih/private-circle`](https://github.com/kummahiih/private-circle) and enroll assets from [`@kummahiih/circle-enroll`](https://github.com/kummahiih/circle-enroll).

- **Live demo:** https://hello-circle-demo.vercel.app/
- Clear HTML: `content/index-plaintext.html` (in git for learning).
- **Vercel serves only `dist/`**, encrypted at build time. Enroll UI is copied from `@kummahiih/circle-enroll`.
- Strict CSP: external `gate.js` / `gate.css` + `gate-config.json` (no inline scripts).

> **AI Disclosure**: This project has been developed with assistance from AI tools. See [`docs/AI_DISCLOSURE.md`](docs/AI_DISCLOSURE.md) for full transparency regarding the development process.

## Demo passwords

| User  | Password          | pageId         |
|-------|-------------------|----------------|
| alice | `demo-alice-2026` | `hello-circle` |
| bob   | `demo-bob-2026`   | `hello-circle` |

Intentionally public for the demo. Do not reuse for real secrets.

## Use the packages in another project

```bash
npm i -D @kummahiih/private-circle @kummahiih/circle-enroll

# scaffold (optional)
npx private-circle init

# encrypt → dist/ (also copies enroll assets)
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
    "build": "npx circle-enroll copy --out dist && private-circle encrypt --page-id my-site --content content/index.html --hashes hashes --out dist"
  },
  "devDependencies": {
    "@kummahiih/circle-enroll": "^0.1.0",
    "@kummahiih/private-circle": "^0.1.0"
  }
}
```

Vercel: set **Build Command** to `npm run build` and **Output Directory** to `dist` (see this repo's `vercel.json`).

## Local build (this repo)

```bash
npm install
npm run build
# open dist/index.html — try alice / demo-alice-2026
# enroll: dist/enroll.html
```

## Deploy (Vercel)

1. Import this repo.
2. Build settings from `vercel.json`:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. CSP: `script-src 'self'` (no `'unsafe-inline'` for scripts).

## CI

`.github/workflows/encrypt-check.yml` installs the packages, runs encrypt, and asserts:

- no plaintext markers in `dist/`
- no inline scripts
- **no `hashes/` directory under `dist/`**

## Security notes

- Client-side gate only: ciphertext + masks are downloadable.
- Demo `hashes/` are public on purpose (labeled demo passwords).
- **Real circle:** keep enroll JSON private; never commit real hashes or ship them with `dist/`; same-origin `enroll.html`; strong passwords or WebAuthn PRF.

## Related

- https://github.com/kummahiih/private-circle
- https://github.com/kummahiih/circle-enroll
- ADR: `docs/ADR-001-hello-circle.md`
