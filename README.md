# Simon Parker Therapy Website

Source for [simonparker.com](https://simonparker.com), the web presence for Simon Parker Therapy, LLC. Private practice based in Pittsburgh with telehealth across Pennsylvania, Texas, and California.

## What's here

- `website/` — the static site served to visitors. 9 HTML pages, `styles.css`, `robots.txt`, `sitemap.xml`, `_headers`, `favicon.svg`, and the `images/` folder (including the Open Graph card)
- `tools/` — build and verification scripts
  - `practice_constants.json` is the single source of truth for identity, licensing, contact, framework, and fee details
  - `practice_constants.js` and `practice_constants.py` expose the JSON to Node and Python build scripts
  - `build_website.js` re-renders shared nav and footer blocks into each HTML page
  - `build_clinical_forms.js` generates the `.docx` files in `clinical_forms/` (intake, screeners, ROI, superbill, treatment plan, progress note)
  - `build_docs.js` generates five `.docx` files in `compliance/` (GFE, NPP, IC, HIPAA Risk, Breach Plan). The Telehealth Consent currently lives in `compliance/` as a hand-built file; folding it into this script is a small follow-up.
  - `verify.py` runs 300+ consistency and integrity checks across the site
- `clinical_forms/` and `compliance/` — generated `.docx` paperwork the practice uses with clients
- `netlify.toml` — Netlify deploy configuration (publish directory is `website/`)

## Preview locally

The site is plain static HTML, no build step required to view.

```bash
# From the repo root
cd website && python3 -m http.server 8000
# Then visit http://localhost:8000
```

## Make a change

1. Edit content in `website/*.html` or the SSOT at `tools/practice_constants.json`.
2. If you touched the SSOT or shared nav/footer, rebuild:
   ```bash
   node tools/build_website.js
   ```
3. Run the verifier to catch drift:
   ```bash
   python3 tools/verify.py
   ```
4. Commit and push. Netlify auto-deploys within a minute.

## Stack

- Hosting: Netlify (static)
- DNS: Cloudflare
- Forms: Web3Forms, with clinical correspondence moving to the SimplePractice portal after intake
- Fonts: Google Fonts (Lora and Inter)
- Analytics: none yet (Cloudflare Web Analytics or Plausible planned)

## Content license

All copy and images © Simon Parker Therapy, LLC. Private repository.
