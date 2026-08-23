# hello-circle

Public **example** of a small-circle gated static page:

- **Live demo:** https://hello-circle-demo.vercel.app/
- Clear HTML lives in `content/index-plaintext.html` (in git for learning).
- **Vercel serves only `dist/`**, produced by encrypting at build time.
- Two demo users (passwords below). Enrollment format matches [circle-enroll](https://circle-enroll.vercel.app/).

## Demo passwords

| User  | Password         | pageId        |
|-------|------------------|---------------|
| alice | `demo-alice-2026` | `hello-circle` |
| bob   | `demo-bob-2026`   | `hello-circle` |

These are **intentionally public** for the demo. Do not reuse them for real secrets.

## Local build

```bash
node scripts/encrypt-page.mjs \
  --page-id hello-circle \
  --content content/index-plaintext.html \
  --hashes hashes \
  --out dist
```

Open `dist/index.html` in a browser, enter a demo password.

## Deploy (Vercel)

1. Import this repo.
2. **Root directory:** repository root (default).
3. Build settings come from `vercel.json`:
   - **Build Command:** encrypt script → `dist/`
   - **Output Directory:** `dist`
4. Plaintext under `content/` is **not** the Output Directory, so it is not the deployed site root.

## GitHub Action

`.github/workflows/encrypt-check.yml` runs the same encrypt step on push/PR and checks that the secret heading is not present as clear text in `dist/index.html`.

## Security notes

- Client-side gate only: ciphertext + masks are downloadable; weak passwords can be guessed offline.
- Demo hashes in `hashes/` are public on purpose.
- For a real circle: keep `hashes/` private, use [circle-enroll](https://github.com/kummahiih/circle-enroll), strong unique passwords.

## Related

- https://github.com/kummahiih/circle-enroll  
- ADR: `docs/ADR-001-hello-circle.md`
