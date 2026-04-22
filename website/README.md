# Simon Parker Therapy: Website

Static placeholder site for Simon Parker Therapy, PLLC (Pittsburgh, opening summer 2026).

## Pages
- `index.html`: Home
- `about.html`: About Simon (with portrait)
- `approach.html`: The Approach (CBC + IPT)
- `fees.html`: Fees and payment
- `faq.html`: Frequently asked questions
- `contact.html`: Contact form and details

Shared styles live in `styles.css`. Fonts are loaded from Google Fonts (Lora + Inter). No build step required. Open any page in a browser.

## Images
The `/images/` folder contains three versions of Simon's headshot:
- `simon-parker.jpg`: full-size (1600px on longest edge), used as a reference.
- `simon-parker-portrait.jpg`: 720×960 (3:4) portrait for the About page.
- `simon-parker-thumb.jpg`: 480×480 square thumbnail for the Home page "About me" card.

To regenerate these from a new source photo, drop the new file at `images/source.jpg` and run the project's `process_headshot.py` script (in the session working folder). It crops, resizes, and saves all three variants with conservative JPEG quality.

## Positioning
The site speaks to two groups:
1. **High-functioning professionals** quietly unravelling.
2. **Veterans, active-duty service members, and first responders** carrying combat-related PTSD, complex trauma, moral injury, and burnout.

The tone is warm, direct, and British. See `Practice_Voice_and_Bio.md` for the voice guide and bio variants.

## Compliance & hosting notes
- Hosting: TBD. Any static host works (Cloudflare Pages, Netlify, GitHub Pages, Vercel static).
- The contact form posts via `mailto:` as a placeholder. Replace with a HIPAA-compliant intake form (e.g., SimplePractice widget, JotForm HIPAA, or a Cloudflare Worker with BAA) before launch.
- Before go-live, confirm `info@simonparker.com` routes correctly and the practice phone `(412) 444-8753` is live.
- All pages include a 988 crisis link and a statement that the practice is not a crisis service.

## Deploy checklist
- [ ] Swap `mailto:` form for SimplePractice secure intake
- [ ] Point domain at host and enable HTTPS
- [ ] Set up email forwarding for `info@simonparker.com`
- [ ] Add analytics only if HIPAA-safe (avoid Google Analytics on clinical pages)
- [ ] Test all pages on mobile and desktop
- [ ] Confirm CA/TX/PA license numbers display correctly in footer
