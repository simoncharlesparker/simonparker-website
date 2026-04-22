/*
 * practice_constants.js
 *
 * Loads practice_constants.json and exposes convenience strings used across
 * build_docs.js, build_clinical_forms.js, and build_website.js.
 *
 * Edit practice_constants.json — NOT this file — to change the practice's
 * focus, voice, fees, licences, or contact details. Then rerun:
 *
 *     npm --prefix tools run build
 *     node tools/build_website.js
 *     python3 tools/verify.py
 */

const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, 'practice_constants.json');
const C = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

// --- Derived strings ----------------------------------------------------

// "PA LCSW CW024575 · TX LCSW 103592 · CA LCSW 95685"
const licenseLine = C.licenses
  .map(l => `${l.abbr} ${l.profession} ${l.number}`)
  .join(' · ');

// Multiline form for letterheads / footers
const licenseLines = C.licenses
  .map(l => `${l.state} ${l.profession} #${l.number}`);

// "LCSW · PA CW024575, TX 103592, CA 95685"
const credentialsCompact =
  `${C.identity.clinician_credentials} · ` +
  C.licenses.map(l => `${l.abbr} ${l.number}`).join(', ');

// Money helpers
const money = n => (n === 0 ? 'Free' : `$${n}`);
const feeRow = (label, price) => `${label}: ${money(price)}`;

// Practice block used in document headers
const practiceHeaderBlock = [
  C.identity.legal_entity,
  `${C.identity.clinician_with_credentials}  |  NPI ${C.registry.npi}`,
  licenseLine,
  `${C.contact.email}  |  ${C.contact.phone}`,
];

// Footer line for compliance documents
const complianceFooter =
  `${C.identity.legal_entity} · NPI ${C.registry.npi} · ` +
  `${licenseLine} · ${C.contact.email}`;

// Website footer license column
const websiteFooterLicenses = licenseLines.concat([
  `NPI ${C.registry.npi}`,
  `Taxonomy ${C.registry.taxonomy_code}`,
]);

// Fee summary lines
const feeSummary = {
  consultation: `${C.fees.consultation_label} — ${money(C.fees.consultation_price_usd)}`,
  short:        `${C.fees.session_50min_label} — ${money(C.fees.session_50min_price_usd)}`,
};

// Full framework sentence used in intake / approach
const frameworksSentence =
  `I primarily draw on ${C.frameworks.cbc.short} (${C.frameworks.cbc.attribution}) ` +
  `and ${C.frameworks.ipt.short} (${C.frameworks.ipt.attribution}).`;

const frameworksCitations = [
  C.frameworks.cbc.citation,
  C.frameworks.ipt.citation,
];

// Niche sentence used in bios and landing pages
const nicheSentence =
  `I work with ${C.niche.track1_long}, and with ${C.niche.track2_long}.`;

// Crisis line used in every document footer and website footer
const crisisLine = C.crisis.line_full;

// --- Single export ------------------------------------------------------

module.exports = {
  // Raw
  ...C,
  raw: C,

  // Derived
  licenseLine,
  licenseLines,
  credentialsCompact,
  practiceHeaderBlock,
  complianceFooter,
  websiteFooterLicenses,
  feeSummary,
  frameworksSentence,
  frameworksCitations,
  nicheSentence,
  crisisLine,

  // Helpers
  money,
  feeRow,
};
