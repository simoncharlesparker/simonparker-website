// Build / regenerate the Simon Parker Therapy website pages from
// practice_constants.json.
//
// Each of the 7 pages (index/about/approach/fees/for-teams/faq/contact) is
// edited IN PLACE. The build script looks for three kinds of markers and
// regenerates only the content between them:
//
//   <!--@c:KEY-->TEXT<!--/@c-->                  (inline single-value)
//   <!--@block:nav-->...<!--/@block:nav-->       (nav bar — sets active class)
//   <!--@block:footer-->...<!--/@block:footer--> (shared site footer)
//
// Everything outside these markers is left untouched, so page-specific
// prose and structure is safe to hand-edit.

const fs = require('fs');
const path = require('path');
const C = require('./practice_constants');

const WEB = path.join(__dirname, '..', 'website');
const PAGES = ['index.html', 'about.html', 'approach.html', 'fees.html', 'for-teams.html', 'faq.html', 'contact.html', 'privacy.html', 'thank-you.html'];

const NAV_ITEMS = [
  { href: 'index.html',      label: 'Home' },
  { href: 'about.html',      label: 'About' },
  { href: 'approach.html',   label: 'Approach' },
  { href: 'fees.html',       label: 'Fees' },
  { href: 'for-teams.html',  label: C.training.nav_label },
  { href: 'faq.html',        label: 'FAQ' },
  { href: 'contact.html',    label: 'Get in touch', cta: true },
];

// Map of KEY → current value, for <!--@c:KEY-->...<!--/@c--> replacements.
// Keys are intentionally a small, explicit vocabulary.
const INLINE = {
  legal_entity:       C.identity.legal_entity,
  clinician_full:     C.identity.clinician_with_credentials,
  npi:                C.registry.npi,
  lic_pa_full:        `${C.licenses.find(l=>l.abbr==='PA').profession} ${C.licenses.find(l=>l.abbr==='PA').number}`,
  lic_tx_full:        `${C.licenses.find(l=>l.abbr==='TX').profession} ${C.licenses.find(l=>l.abbr==='TX').number}`,
  lic_ca_full:        `${C.licenses.find(l=>l.abbr==='CA').profession} ${C.licenses.find(l=>l.abbr==='CA').number}`,
  lic_pa_number:      C.licenses.find(l=>l.abbr==='PA').number,
  lic_tx_number:      C.licenses.find(l=>l.abbr==='TX').number,
  lic_ca_number:      C.licenses.find(l=>l.abbr==='CA').number,
  phone:              C.contact.phone,
  email:              C.contact.email,
  email_mailto:       `mailto:${C.contact.email}`,
  office_city:        C.contact.office_city,
  office_open_from:   C.contact.office_open_from,
  base_url:           C.contact.base_url,
  copyright_year:     String(C.brand.copyright_year_start),
  cbc_attribution:    C.frameworks.cbc.attribution,
  ipt_attribution:    C.frameworks.ipt.attribution,
  cbc_short:          C.frameworks.cbc.short,
  ipt_short:          C.frameworks.ipt.short,
  fee_50:             `$${C.fees.session_50min_price_usd}`,
  fee_consultation:   C.fees.consultation_label,
  // Training (B2B) line
  training_tagline:            C.training.positioning_tagline,
  training_half_day_price:     `$${C.training.workshop_half_day_price_usd.toLocaleString('en-US')}`,
  training_half_day_hours:     String(C.training.workshop_half_day_hours),
  training_full_day_price:     `$${C.training.workshop_full_day_price_usd.toLocaleString('en-US')}`,
  training_full_day_hours:     String(C.training.workshop_full_day_hours),
  training_max_participants:   String(C.training.workshop_max_participants),
  training_program_name:       C.training.program_name,
  training_program_sessions:   String(C.training.program_sessions),
  training_program_minutes:    String(C.training.program_session_minutes),
  training_program_group_max:  String(C.training.program_group_size_max),
  training_program_price:      `$${C.training.program_price_usd.toLocaleString('en-US')}`,
  training_program_pricing_note: C.training.program_pricing_note,
  training_in_person_metro:    C.training.delivery_in_person_metro,
  training_scoping_minutes:    String(C.training.scoping_call_minutes),
  states_short:       C.licenses.map(l=>l.abbr).join(', '),
  states_long:        C.licenses.map(l=>l.state).join(', ').replace(/, ([^,]*)$/, ', and $1'),
  footer_tagline:     C.taglines.footer_tagline,
  crisis_line:        '988', // just the digits (used inside tel: link and prose)
  licenses_string:    (() => {
                        const parts = C.licenses.map(l=>`${l.state} (${l.profession} ${l.number})`);
                        if (parts.length <= 1) return parts.join('');
                        return parts.slice(0,-1).join(', ') + ', and ' + parts.slice(-1);
                      })(),
};

// Block generators ---------------------------------------------------------

function buildNav(activeHref) {
  const items = NAV_ITEMS.map(n => {
    const cls = [];
    if (n.href === activeHref) cls.push('active');
    if (n.cta) cls.push('nav-cta');
    const attr = cls.length ? ` class="${cls.join(' ')}"` : '';
    return `        <li><a href="${n.href}"${attr}>${n.label}</a></li>`;
  }).join('\n');
  return [
    '<header class="site-header">',
    '  <div class="container">',
    '    <nav class="nav" aria-label="Primary">',
    `      <a href="index.html" class="brand">${C.identity.display_name}</a>`,
    '      <button class="nav-toggle" aria-expanded="false" aria-controls="nav-links" onclick="this.nextElementSibling.classList.toggle(\'open\');this.setAttribute(\'aria-expanded\',this.nextElementSibling.classList.contains(\'open\'));">Menu</button>',
    '      <ul class="nav-links" id="nav-links">',
    items,
    '      </ul>',
    '    </nav>',
    '  </div>',
    '</header>',
  ].join('\n');
}

function buildFooter() {
  const licenseLinks = C.licenses
    .map(l => `        <span class="footer-item">${l.state} ${l.profession} ${l.number}</span>`)
    .join('\n');
  return [
    '<footer class="site-footer">',
    '  <div class="container">',
    '    <div class="footer-grid">',
    '      <div>',
    `        <h3>${C.identity.legal_entity}</h3>`,
    `        <p>${C.taglines.footer_tagline}</p>`,
    '      </div>',
    '      <div>',
    '        <h3>Explore</h3>',
    '        <a href="about.html">About</a>',
    '        <a href="approach.html">Approach</a>',
    '        <a href="fees.html">Fees</a>',
    `        <a href="for-teams.html">${C.training.nav_label}</a>`,
    '        <a href="faq.html">FAQ</a>',
    '        <a href="contact.html">Contact</a>',
    '      </div>',
    '      <div>',
    '        <h3>Licenses</h3>',
    licenseLinks,
    '      </div>',
    '    </div>',
    '    <div class="footer-bottom">',
    `      <div>© ${C.brand.copyright_year_start} ${C.identity.legal_entity}. All rights reserved.</div>`,
    '      <div>In a crisis? Call or text <a href="tel:988">988</a> (Suicide &amp; Crisis Lifeline).</div>',
    '    </div>',
    '  </div>',
    '</footer>',
  ].join('\n');
}

// Marker-based replacement ------------------------------------------------

function replaceInline(html) {
  const pattern = /<!--@c:([a-z0-9_]+)-->([\s\S]*?)<!--\/@c-->/g;
  const unknown = new Set();
  const out = html.replace(pattern, (_m, key) => {
    if (!(key in INLINE)) {
      unknown.add(key);
      return `<!--@c:${key}-->??<!--/@c-->`;
    }
    return `<!--@c:${key}-->${INLINE[key]}<!--/@c-->`;
  });
  return { out, unknown: [...unknown] };
}

// HTML comments cannot appear inside attribute values. For constants that
// appear in attribute values (mailto:EMAIL, meta description prose, etc.)
// we do targeted, whole-string replacements. Patterns are distinctive
// enough that collisions with prose are unlikely.
function replaceAttributeValues(html) {
  const rules = [
    // mailto: any form action or href using the practice email.
    // Matches both the current domain and the legacy simonparkertherapy.com
    // domain so any stale hardcoded href values get rewritten on rebuild.
    { from: /mailto:[A-Za-z0-9._%+-]+@(?:simonparker|simonparkertherapy)\.com/g, to: `mailto:${C.contact.email}` },
    // Framework attributions can appear in <meta name="description">
    // (Old "Trower, Jones, and Dryden" retained as a migration fallback in
    //  case any legacy prose is rediscovered; current attribution is
    //  Beck and Ellis, driven from practice_constants.json.)
    { from: /Trower,\s*Jones,?\s*and\s*Dryden/g, to: C.frameworks.cbc.attribution },
    { from: /Beck\s+and\s+Ellis/g, to: C.frameworks.cbc.attribution },
    { from: /Weissman,\s*Markowitz,?\s*and\s*Klerman/g, to: C.frameworks.ipt.attribution },
  ];
  let out = html;
  for (const r of rules) out = out.replace(r.from, r.to);
  return out;
}

function replaceBlock(html, name, content) {
  const pattern = new RegExp(
    `<!--@block:${name}-->[\\s\\S]*?<!--\\/@block:${name}-->`,
    'g',
  );
  if (!pattern.test(html)) return { out: html, touched: false };
  const replacement = `<!--@block:${name}-->\n${content}\n<!--/@block:${name}-->`;
  return { out: html.replace(pattern, replacement), touched: true };
}

// Main --------------------------------------------------------------------

function buildPage(filename) {
  const full = path.join(WEB, filename);
  const before = fs.readFileSync(full, 'utf8');

  // 1. inline replacements
  const { out: afterInline, unknown } = replaceInline(before);
  if (unknown.length) {
    console.error(`  ✗ ${filename}: unknown inline keys: ${unknown.join(', ')}`);
    process.exitCode = 1;
  }

  // 2. attribute-value replacements (for places HTML comments aren't allowed)
  const afterAttrs = replaceAttributeValues(afterInline);

  // 3. nav block
  const { out: afterNav, touched: navTouched } = replaceBlock(afterAttrs, 'nav', buildNav(filename));

  // 4. footer block
  const { out: afterFooter, touched: footerTouched } = replaceBlock(afterNav, 'footer', buildFooter());

  if (afterFooter === before) {
    console.log(`  ✓ ${filename}  (unchanged)`);
  } else {
    fs.writeFileSync(full, afterFooter);
    const flags = [];
    if (navTouched) flags.push('nav');
    if (footerTouched) flags.push('footer');
    console.log(`  ✓ ${filename}  (updated${flags.length ? `: ${flags.join(' + ')}` : ''})`);
  }
}

console.log(`Building website pages in ${WEB}`);
PAGES.forEach(buildPage);
console.log('Done.');
