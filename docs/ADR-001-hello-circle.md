# ADR-001: hello-circle – julkinen salatun staattisen sivun esimerkki

**Status:** Accepted  
**Date:** 2026-08-24  
**Updated:** 2026-09-06 (enroll ilman `'unsafe-inline'`)

---

## Context

Tarvitaan **julkinen** esimerkkirepo, joka näyttää miten:

1. Selväkielinen HTML pidetään erillään deploymentista.
2. Build / CI salaa sivun (AES-GCM + page-scoped PBKDF2-maskit).
3. Kaksi esimerkkikäyttäjää voi avata loaderin salasanalla, ja yksi passkey (WebAuthn PRF) samalla pageId:llä.
4. Enroll-sivu toimii samalla originilla **ilman** `style-src 'unsafe-inline'`.

Enroll-formaatti sama kuin `@kummahiih/circle-enroll`.

---

## Decision

| Osa | Valinta |
|-----|---------|
| Selväkielinen sivu | `content/index-plaintext.html` (gittissä oppimista varten) |
| Käyttäjät | `hashes/alice.json`, `hashes/bob.json` (julkiset demosalasanat) + `hashes/enroll-prf-hello-circle-*.json` (WebAuthn PRF) |
| pageId | `hello-circle` |
| Salaus | `npm run build` → `circle-enroll copy` + `private-circle encrypt` → `dist/` |
| Loader | ulkoiset `gate.js` / `gate.css` / `gate-config.json` (ei inline-skriptejä) |
| Enroll | `enroll.html` + `enroll.css` + `enroll-*.js`; CSP `script-src 'self'; style-src 'self'` |
| Vercel | `buildCommand` = `npm run build`, `outputDirectory` = `dist` |
| CI | Encrypt + ei plaintext-markeria, ei inline `<script>`, ei enroll `<style>`, ei `'unsafe-inline'` |
| Repo | Public example |

### Miksi plaintext saa olla gitissä mutta ei Vercel-juuressa

Esimerkkiopetus: lukija näkee lähteen. Deploymentin **Output Directory** on vain `dist/`, joten Vercel ei julkaise `content/`-kansiota sivuston juurena. (Tiedostot voivat silti olla saatavilla GitHubista — se on tarkoituksellista tässä demossa.)

### Enroll-tiedostot ja encrypt-järjestys

`private-circle encrypt` kopioi ensin **työhakemiston** `enroll.html`:n, vasta sitten paketin assetit. Siksi tämän repon juuren enroll-tiedostojen on vastattava circle-enrollia (`enroll.css`, ei inline `<style>`). Vanha inline-CSS pakotti `/enroll`-headeriin `style-src 'unsafe-inline'` — se poistettiin.

Gate-sivun HTTP-CSP sallii lisäksi `blob:` (multifile-purku). Enroll ei tarvitse `blob:` eikä `'unsafe-inline'`.

### Demokäyttäjät

- alice / `demo-alice-2026`
- bob / `demo-bob-2026`
- passkey / WebAuthn PRF (`rpId`: `hello-circle-demo.vercel.app`)

---

## Consequences

- Helppo kokeilla ilman enroll-vaihetta.
- Julkiset demosalasanat → ei tuotantoturvaa.
- Oikeassa piirissä: private hashes, vahvat salasanat, ei README-salasanoja.
- Forkattu enroll.html vanhentuu helposti; pidä synkassa `@kummahiih/circle-enroll` -paketin kanssa tai poista juuren kopio.

---

## Related

- https://github.com/kummahiih/circle-enroll  
- https://github.com/kummahiih/private-circle  
- Skill: `private-circle-page`
---
