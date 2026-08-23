# ADR-001: hello-circle – julkinen salatun staattisen sivun esimerkki

**Status:** Accepted  
**Date:** 2026-08-24

---

## Context

Tarvitaan **julkinen** esimerkkirepo, joka näyttää miten:

1. Selväkielinen HTML pidetään erillään deploymentista.
2. Build / CI salaa sivun (AES-GCM + page-scoped PBKDF2-maskit).
3. Kaksi esimerkkikäyttäjää voi avata loaderin salasanalla.

Enroll-formaatti sama kuin `circle-enroll` / `private-circle-page`.

---

## Decision

| Osa | Valinta |
|-----|---------|
| Selväkielinen sivu | `content/index-plaintext.html` (gittissä oppimista varten) |
| Käyttäjät | `hashes/alice.json`, `hashes/bob.json` (julkiset demosalasanat README:ssä) |
| pageId | `hello-circle` |
| Salaus | `scripts/encrypt-page.mjs` → `dist/` (loader + ciphertext + masks) |
| Vercel | `buildCommand` = encrypt, `outputDirectory` = `dist` |
| CI | GitHub Action ajaa encryptin ja varmistaa ettei plaintext-marker ole `dist/index.html`:ssä |
| Repo | Public example |

### Miksi plaintext saa olla gitissä mutta ei Vercel-juuressa

Esimerkkiopetus: lukija näkee lähteen. Deploymentin **Output Directory** on vain `dist/`, joten Vercel ei julkaise `content/`-kansiota sivuston juurena. (Tiedostot voivat silti olla saatavilla GitHubista — se on tarkoituksellista tässä demossa.)

### Demokäyttäjät

- alice / `demo-alice-2026`
- bob / `demo-bob-2026`

---

## Consequences

- Helppo kokeilla ilman enroll-vaihetta.
- Julkiset demosalasanat → ei tuotantoturvaa.
- Oikeassa piirissä: private hashes, vahvat salasanat, ei README-salasanoja.

---

## Related

- https://github.com/kummahiih/circle-enroll  
- Skill: `private-circle-page`
---
