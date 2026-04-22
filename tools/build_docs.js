// Build all five compliance documents for Simon Parker Therapy, PLLC.
// Sources ALL practice strings (names, licences, NPI, fees, framework
// attributions, phone, email, niche language) from tools/practice_constants.json
// via the practice_constants.js helper. To edit the practice's focus, voice,
// licences, fees, or contact details, edit practice_constants.json — NOT this
// file — then rerun `npm --prefix tools run build`.
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, TabStopType, TabStopPosition
} = require('docx');

const C = require('./practice_constants');

const OUT = path.join(__dirname, '..', 'compliance');
fs.mkdirSync(OUT, { recursive: true });

// ---------- convenience values drawn from constants ----------
const LICENSE_SENTENCE = C.licenses
  .map(l => `${l.state} (${l.number})`)
  .join(', ');
const PRIVACY_EMAIL = `privacy@${C.contact.website}`;
const CBC_SENTENCE = `Beckian Cognitive Behavioral Therapy combined with Rational Emotive Behavior Therapy (following ${C.frameworks.cbc.attribution})`;
const IPT_SENTENCE = `Interpersonal Psychotherapy (following ${C.frameworks.ipt.attribution})`;
const STATE_ABBRS = C.licenses.map(l => l.abbr).join(', ');
const FEE_50 = `$${C.fees.session_50min_price_usd}`;

// ---------- shared helpers ----------
const PAGE = { width: 12240, height: 15840 };
const MARGIN = { top: 1440, right: 1440, bottom: 1440, left: 1440 };
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right; // 9360

const STYLES = {
  default: { document: { run: { font: 'Arial', size: 22 } } },
  paragraphStyles: [
    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 32, bold: true, font: 'Arial' },
      paragraph: { spacing: { before: 320, after: 180 }, outlineLevel: 0 } },
    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 26, bold: true, font: 'Arial' },
      paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 } },
    { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 23, bold: true, font: 'Arial' },
      paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
  ],
};

const NUMBERING = {
  config: [
    { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
  ],
};

function p(text, opts = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text, ...opts })];
  return new Paragraph({
    children: runs,
    spacing: { after: 140, line: 300 },
    alignment: opts.align || AlignmentType.LEFT,
  });
}
function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, bold: true })] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, bold: true })] }); }
function h3(t) { return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: t, bold: true })] }); }
function bullet(t) { return new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun(t)], spacing: { after: 80, line: 300 } }); }
function num(t)    { return new Paragraph({ numbering: { reference: 'numbers', level: 0 }, children: [new TextRun(t)], spacing: { after: 80, line: 300 } }); }
function spacer()  { return new Paragraph({ children: [new TextRun('')] }); }
function hr() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '7A8B6F', space: 1 } },
    children: [new TextRun('')],
    spacing: { before: 120, after: 120 },
  });
}

function signatureBlock(label) {
  return [
    new Paragraph({
      children: [
        new TextRun({ text: `${label}: ` }),
        new TextRun({ text: '_______________________________________________' }),
        new TextRun({ text: '\tDate: ' }),
        new TextRun({ text: '_______________' }),
      ],
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      spacing: { before: 300, after: 140 },
    }),
  ];
}

// Standard header: practice identity
function makeHeader(docTitle) {
  return new Header({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: C.identity.legal_entity, bold: true }),
          new TextRun({ text: `\t${docTitle}`, color: '555555' }),
        ],
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      }),
    ],
  });
}

function makeFooter() {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: 'Confidential — for internal/practice use', color: '777777', size: 18 }),
          new TextRun({ text: '\tPage ', size: 18, color: '777777' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '777777' }),
          new TextRun({ text: ' of ', size: 18, color: '777777' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '777777' }),
        ],
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      }),
    ],
  });
}

function buildDoc(title, children) {
  return new Document({
    styles: STYLES,
    numbering: NUMBERING,
    creator: C.identity.legal_entity,
    title,
    sections: [{
      properties: { page: { size: PAGE, margin: MARGIN } },
      headers: { default: makeHeader(title) },
      footers: { default: makeFooter() },
      children,
    }],
  });
}

async function writeDoc(filename, doc) {
  const buf = await Packer.toBuffer(doc);
  const p = path.join(OUT, filename);
  fs.writeFileSync(p, buf);
  console.log(`Wrote ${p} (${buf.length.toLocaleString()} bytes)`);
}

// ---------- 1) Informed Consent ----------
function consentChildren() {
  return [
    h1('Informed Consent for Psychotherapy'),
    p(`${C.identity.legal_entity} ("the Practice")`),
    p(`This document describes the services ${C.identity.clinician_with_credentials} ("the Therapist") provides, your rights as a client, and the mutual expectations that shape our work together. Please read it in full, raise any questions, and sign below. Therapy begins only when consent is informed.`),

    h2('1. About the therapist'),
    p(`${C.identity.clinician_with_credentials} — licensed clinical social worker in ${LICENSE_SENTENCE}. NPI ${C.registry.npi}. Trained in ${CBC_SENTENCE} and ${IPT_SENTENCE}.`),

    h2('2. Therapeutic services'),
    p(`The Therapist provides outpatient psychotherapy to adults, primarily for anxiety, depression, PTSD, complex trauma, moral injury, burnout, and life transitions. Services are offered by telehealth (${STATE_ABBRS}) and, from ${C.contact.office_open_from}, in-person at the ${C.contact.office_city}, ${C.contact.office_state_abbr} office.`),
    p('Therapy is a collaborative process. Benefits may include reduced distress, improved relationships, and new skills for managing difficulty. Risks may include the temporary resurfacing of difficult memories or emotions. Progress varies; the Therapist cannot guarantee a specific outcome.'),

    h2('3. Appointments, cancellation, and lateness'),
    bullet('Sessions are 50 minutes unless otherwise agreed.'),
    bullet(`Please cancel or reschedule at least ${C.billing.late_cancel_hours} hours in advance; later cancellations and no-shows are billed at the full fee.`),
    bullet('If the Therapist runs late, the remaining session time is honored; if the full length cannot be completed, a prorated credit applies.'),

    h2('4. Fees and payment'),
    bullet(`Individual session (50 min): ${FEE_50}. Initial 15-minute consultation: free.`),
    bullet('Payment is due at the time of service. A valid credit or debit card is kept on file via a HIPAA-compliant processor.'),
    bullet('The Practice is out-of-network for insurance. A monthly superbill is provided on request for possible out-of-network reimbursement.'),
    bullet('Under the federal No Surprises Act, a Good Faith Estimate of expected charges is provided in writing before the first session.'),

    h2('5. Telehealth'),
    p('Telehealth sessions are conducted via a HIPAA-compliant video platform. You are responsible for ensuring a private, stable connection on your end, and for being in a jurisdiction in which the Therapist is licensed. Telehealth is not appropriate for all presentations — the Therapist may recommend in-person care or a higher level of care if clinically indicated.'),

    h2('6. Confidentiality'),
    p('Communications are confidential and protected by federal and state law, with the following exceptions:'),
    bullet('Imminent risk of serious harm to yourself or another identifiable person.'),
    bullet('Suspected abuse or neglect of a child, dependent adult, or elder — mandated reporting.'),
    bullet('A valid court order that compels disclosure.'),
    bullet('Coordination of care with other providers, only with your signed release.'),
    p('When reasonable, the Therapist will discuss any disclosure with you beforehand and release only the minimum information necessary.'),

    h2('7. Records, electronic communication, and social media'),
    bullet('Clinical records are maintained in a HIPAA-compliant electronic health record system and retained per state law (minimum 7 years for adults).'),
    bullet('Email and text are suitable for scheduling only, not for clinical content. Secure messaging is available through the client portal.'),
    bullet('The Therapist does not accept "friend" or connection requests from clients on social media, and does not view clients\' social media profiles.'),

    h2('8. Emergency and crisis care'),
    p(`The Practice is not a crisis service. ${C.crisisLine} Between-session contact for clinical urgency goes through the portal and receives a response within one business day.`),

    h2('9. Dual relationships'),
    p('To preserve the integrity of your care, the Therapist does not enter non-therapeutic relationships with clients (personal, business, or social). If a conflict of interest arises — shared social circles, workplaces, or similar — the Therapist will address it openly with you.'),

    h2('10. Ending therapy'),
    p('You may end therapy at any time. The Therapist may recommend referral to another provider if your needs fall outside the Therapist\'s scope or if ethical concerns arise. Where possible, a final session is scheduled to close the work well and, if helpful, to coordinate onward care.'),

    h2('11. Complaints'),
    p('If you are dissatisfied, please raise it with the Therapist first. You also retain the right to contact the state licensing board in the jurisdiction where services are rendered.'),

    h2('12. Contacting the practice'),
    p('For scheduling, administrative questions, or to raise a concern between sessions:'),
    bullet(`Phone: ${C.contact.phone}`),
    bullet(`Email (scheduling and administrative only — not for clinical content): ${C.contact.email}`),
    bullet(`Secure messaging for clinical questions: via the client portal.`),

    hr(),
    h2('Acknowledgment and consent'),
    p(`I have read this document, I have had the opportunity to ask questions, and I voluntarily consent to receive psychotherapy from ${C.identity.clinician_with_credentials} under the terms above.`),
    ...signatureBlock('Client printed name'),
    ...signatureBlock('Client signature'),
    ...signatureBlock('Therapist signature'),
  ];
}

// ---------- 2) Notice of Privacy Practices ----------
function nppChildren() {
  return [
    h1('Notice of Privacy Practices'),
    p([
      new TextRun({ text: 'Effective date: ', bold: true }),
      new TextRun('August 1, 2026'),
    ]),
    p('This notice describes how health information about you may be used and disclosed, and how you can get access to this information. Please review it carefully.'),

    h2('Our commitment'),
    p(`${C.identity.legal_entity} ("we," "us") is committed to protecting the privacy of your protected health information ("PHI"). This notice is provided in accordance with the Health Insurance Portability and Accountability Act (HIPAA) and the HITECH Act.`),

    h2('Uses and disclosures for treatment, payment, and operations'),
    bullet('Treatment: coordination with other providers you authorize, or in emergency situations.'),
    bullet('Payment: sharing the minimum information necessary to secure payment (e.g., superbills you authorize).'),
    bullet('Healthcare operations: quality improvement, case consultation with PHI de-identified where possible, legal and compliance review.'),

    h2('Uses and disclosures that require your written authorization'),
    p('Except as described below, we will not use or disclose your PHI without your written authorization. You may revoke an authorization at any time, in writing, for uses or disclosures that have not already occurred.'),
    bullet('Psychotherapy notes beyond what is required for routine operations.'),
    bullet('Marketing communications.'),
    bullet('Sale of PHI — we do not and will not sell PHI.'),

    h2('Uses and disclosures permitted or required without your authorization'),
    bullet('When required by law (e.g., valid court order, subpoena with appropriate legal process).'),
    bullet('Public health activities and reporting of abuse, neglect, or domestic violence as required by state law.'),
    bullet('Serious threat to health or safety — disclosure to those reasonably able to prevent or lessen the threat.'),
    bullet('Workers\' compensation, as authorized by applicable law.'),
    bullet('Health oversight activities, coroners, law enforcement, and specialized government functions per HIPAA.'),

    h2('Your rights'),
    bullet('Right to request restrictions on uses and disclosures. We will try to accommodate reasonable requests but are not required to agree.'),
    bullet('Right to confidential communications by alternative means or at alternative locations.'),
    bullet('Right to access and obtain a copy of your PHI within 30 days (a reasonable fee may apply).'),
    bullet('Right to request an amendment of your PHI if you believe it is incorrect or incomplete.'),
    bullet('Right to an accounting of certain disclosures made in the six years prior to your request.'),
    bullet('Right to a paper copy of this notice even if you agreed to receive it electronically.'),
    bullet('Right to be notified following a breach of your unsecured PHI.'),

    h2('Our duties'),
    p('We are required by law to maintain the privacy and security of your PHI, provide this notice, abide by its terms currently in effect, and notify you of any breach of unsecured PHI. We reserve the right to change this notice and to make the revised notice effective for all PHI we maintain. Revised notices will be posted on our website and made available in the office and through the client portal.'),

    h2('How to contact us or file a complaint'),
    p('To exercise any of the rights above, or if you believe your privacy rights have been violated, contact the Practice Privacy Officer:'),
    bullet(`${C.identity.clinician_with_credentials} — Privacy Officer`),
    bullet(`Email: ${PRIVACY_EMAIL} (use the secure portal for PHI)`),
    bullet(`Phone: ${C.contact.phone}`),
    p('You may also file a complaint with the U.S. Department of Health and Human Services, Office for Civil Rights, at www.hhs.gov/ocr/privacy. No client will be retaliated against for filing a complaint.'),

    hr(),
    h2('Acknowledgment of receipt'),
    p(`I acknowledge that I have received a copy of the Notice of Privacy Practices for ${C.identity.legal_entity}.`),
    ...signatureBlock('Client signature'),
  ];
}

// ---------- 3) Good Faith Estimate ----------
function gfeChildren() {
  const gfeTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    rows: [
      ['Client name', '_________________________________________'],
      ['Date of birth', '_______________________'],
      ['Date estimate provided', '_______________________'],
      ['Expected diagnosis/reason (if known)', '_________________________________________'],
      ['Service location', `Telehealth / ${C.contact.office_city}, ${C.contact.office_state_abbr} office`],
    ].map(([a, b]) => new TableRow({ children: [
      new TableCell({
        borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
        width: { size: 4680, type: WidthType.DXA },
        shading: { fill: 'F2EEE6', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: a, bold: true })] })],
      }),
      new TableCell({
        borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
        width: { size: 4680, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun(b)] })],
      }),
    ] })),
  });

  const feeTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [1800, 4560, 1200, 1800],
    rows: [
      [
        { t: 'CPT code', bold: true },
        { t: 'Service description', bold: true },
        { t: 'Qty', bold: true },
        { t: 'Fee per session', bold: true },
      ],
      [{ t: C.cpt_codes.diagnostic_eval },    { t: 'Psychiatric diagnostic evaluation (intake, 50 min)' }, { t: '1' }, { t: FEE_50 }],
      [{ t: C.cpt_codes.individual_60min },   { t: 'Psychotherapy, 60 minutes (50-min session)' },         { t: '—' }, { t: FEE_50 }],
      [{ t: C.cpt_codes.individual_45min },   { t: 'Psychotherapy, 45 minutes' },                           { t: '—' }, { t: '$140' }],
      [{ t: C.cpt_codes.family_with_patient },{ t: 'Family/couple therapy with client (50 min)' },         { t: '—' }, { t: '$180' }],
    ].map((row, rowIdx) => new TableRow({ children: row.map((c, i) => new TableCell({
      borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
      width: { size: [1800, 4560, 1200, 1800][i], type: WidthType.DXA },
      shading: rowIdx === 0 ? { fill: '7A8B6F', type: ShadingType.CLEAR } : { fill: 'FFFFFF', type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: c.t, bold: !!c.bold, color: rowIdx === 0 ? 'FFFFFF' : '222222' })] })],
    })) })),
  });

  return [
    h1('Good Faith Estimate'),
    p('Federal No Surprises Act — estimate of expected charges for out-of-network psychotherapy services.'),
    p('Under the federal No Surprises Act (effective January 1, 2022), health care providers need to give clients who don\'t have insurance, or who are not using insurance, an estimate of the expected charges for medical items and services. This Good Faith Estimate is based on information known at the time it is created and is an estimate, not a contract. Actual charges may differ based on the services you actually receive.'),

    h2('Provider information'),
    bullet(`Practice: ${C.identity.legal_entity}`),
    bullet(`Provider: ${C.identity.clinician_with_credentials}`),
    bullet(`NPI: ${C.registry.npi}`),
    bullet(`Taxonomy: ${C.registry.taxonomy_code} (${C.registry.taxonomy_label})`),
    bullet(`Licensure: ${LICENSE_SENTENCE}`),
    bullet(`Contact: ${C.contact.phone} · ${C.contact.email}`),
    bullet(`Service location: telehealth (${STATE_ABBRS}) and, from ${C.contact.office_open_from}, in-person at ${C.contact.office_city}, ${C.contact.office_state_abbr}.`),

    h2('Client and session information'),
    gfeTable,

    spacer(),
    h2('Expected services and fees'),
    feeTable,

    spacer(),
    h2('Expected course of care'),
    p([
      new TextRun({ text: 'Estimated number of sessions: ', bold: true }),
      new TextRun('_______  (typical range 10–24 over the first six months; longer courses are not uncommon.)'),
    ]),
    p([
      new TextRun({ text: 'Expected total across the estimate period: ', bold: true }),
      new TextRun('$________________'),
    ]),

    h2('Your right to dispute'),
    p('If you receive a bill that is at least $400 more than your Good Faith Estimate, you can dispute the bill.'),
    bullet('You may contact the Practice to let us know the billed charges are higher than the estimate. You can ask us to update the bill, negotiate the bill, or ask if there is financial assistance available.'),
    bullet('You may also start a dispute resolution process with the U.S. Department of Health and Human Services. If you choose to use the dispute resolution process, you must start the dispute process within 120 calendar days of the date on the original bill. There is a $25 fee to use the dispute process. If the agency reviewing your dispute agrees with you, you will have to pay the price on this Good Faith Estimate. If the agency disagrees with you and agrees with the Practice, you will have to pay the higher amount.'),
    bullet('To learn more and get a form to start the process, go to www.cms.gov/nosurprises or call 1-800-985-3059.'),
    p('For questions or more information about your right to a Good Faith Estimate, visit www.cms.gov/nosurprises.'),
    p('Keep a copy of this Good Faith Estimate in a safe place.'),

    hr(),
    h2('Therapist acknowledgment'),
    ...signatureBlock('Therapist signature'),
    h2('Client acknowledgment'),
    p('I acknowledge receipt of this Good Faith Estimate.'),
    ...signatureBlock('Client signature'),
  ];
}

// ---------- 4) HIPAA Security Risk Assessment ----------
function riskChildren() {
  function rankRow(area, threat, likelihood, impact, rating, controls) {
    return new TableRow({ children: [area, threat, likelihood, impact, rating, controls].map((t, i) => new TableCell({
      borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
      width: { size: [1400, 2400, 1000, 1000, 1160, 2400][i], type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: t, size: 20 })] })],
    })) });
  }
  const headerRow = new TableRow({ children: ['Area', 'Threat / vulnerability', 'Likelihood', 'Impact', 'Risk rating', 'Existing / planned controls'].map((t, i) => new TableCell({
    borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
    width: { size: [1400, 2400, 1000, 1000, 1160, 2400][i], type: WidthType.DXA },
    shading: { fill: '7A8B6F', type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, color: 'FFFFFF', size: 20 })] })],
  })) });

  const rows = [
    ['Workstation', 'Unauthorized physical access to Mac while unattended', 'Low', 'High', 'Medium', 'FileVault enabled; auto-lock 5 min; strong passphrase; screen privacy filter'],
    ['Workstation', 'Malware or unauthorized software', 'Low', 'High', 'Medium', 'OS auto-updates; XProtect; minimal third-party apps; least-privilege user'],
    ['Credentials', 'Weak or reused passwords', 'Medium', 'High', 'High', '1Password (Business) vault; unique strong passphrases; MFA on every account holding PHI'],
    ['EHR / PM', 'Unauthorized access to SimplePractice', 'Low', 'High', 'Medium', 'SimplePractice with BAA; MFA; role-based access (solo practice); session auto-logout'],
    ['Email', 'PHI sent to wrong recipient', 'Medium', 'Medium', 'Medium', 'Email reserved for scheduling only; clinical via portal; recipient confirmation for any identifying info'],
    ['Telehealth', 'Session interception / unauthorized join', 'Low', 'High', 'Medium', 'HIPAA-compliant platform (SimplePractice video or Doxy); unique meeting links; waiting room on'],
    ['Mobile devices', 'Lost or stolen phone containing PHI', 'Low', 'High', 'Medium', 'Phone passcode; Face ID; Find My with Remote Wipe; no PHI stored locally outside encrypted apps'],
    ['Backups', 'Loss of records', 'Low', 'High', 'Medium', 'SimplePractice hosted records; encrypted Time Machine local backup; offsite encrypted copy'],
    ['Physical records', 'Lost or improperly disposed paper', 'Low', 'Medium', 'Low', 'Minimal paper use; locked drawer; cross-cut shredding for disposal'],
    ['Vendors / BAAs', 'BAA gap with a covered vendor', 'Medium', 'High', 'High', 'BAA log; review before onboarding any new tool; annual BAA audit'],
    ['Breach detection', 'Delay in noticing a breach', 'Low', 'High', 'Medium', 'Monthly access log review; alerting on SimplePractice; Incident & Breach Response Plan'],
    ['Training', 'Stale HIPAA / security knowledge', 'Medium', 'Medium', 'Medium', 'Annual HIPAA refresher; periodic phishing self-tests'],
  ];

  return [
    h1('HIPAA Security Risk Assessment'),
    p([
      new TextRun({ text: 'Covered entity: ', bold: true }),
      new TextRun(C.identity.legal_entity),
    ]),
    p([
      new TextRun({ text: 'Assessment date: ', bold: true }),
      new TextRun('April 17, 2026'),
    ]),
    p([
      new TextRun({ text: 'Next review: ', bold: true }),
      new TextRun('Annually, or upon any material change in environment, staff, or vendors.'),
    ]),

    h2('1. Scope'),
    p('This assessment covers administrative, physical, and technical safeguards for all electronic and physical Protected Health Information (PHI) created, received, maintained, or transmitted by the Practice. The Practice is a solo LCSW tele-/in-person practice. There are no workforce members other than the owner at the time of this assessment.'),

    h2('2. Methodology'),
    p('Assets, data flows, and third-party vendors were inventoried. Potential threats and vulnerabilities were identified and rated on a Low / Medium / High scale for likelihood and impact. Existing controls were documented, and remediation items were added to the practice tracker.'),

    h2('3. Data flows (summary)'),
    bullet('Client intake: website contact form → encrypted email → SimplePractice (HIPAA-compliant).'),
    bullet('Sessions: SimplePractice telehealth or in-person. Notes recorded in SimplePractice EHR.'),
    bullet('Billing: SimplePractice; superbills generated and delivered via secure portal.'),
    bullet('Support: HIPAA-compliant platforms only. No PHI over SMS, personal email, or consumer chat apps.'),

    h2('4. Risk register'),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [1400, 2400, 1000, 1000, 1160, 2400],
      rows: [headerRow, ...rows.map(r => rankRow(...r))],
    }),

    spacer(),
    h2('5. Remediation plan'),
    num('Confirm 1Password Business subscription and vault-wide MFA enforcement by May 1, 2026.'),
    num('Verify FileVault enabled and escrow recovery key before first client session.'),
    num('Execute SimplePractice Business Associate Agreement (BAA) before go-live.'),
    num('Publish Incident & Breach Response Plan and rehearse tabletop by July 15, 2026.'),
    num('Schedule annual HIPAA refresher and risk assessment review for April 2027.'),

    h2('6. Approval'),
    ...signatureBlock(`Privacy / Security Officer (${C.identity.clinician_with_credentials})`),
  ];
}

// ---------- 5) Incident & Breach Response Plan ----------
function irpChildren() {
  return [
    h1('Incident & Breach Response Plan'),
    p(C.identity.legal_entity),
    p([
      new TextRun({ text: 'Version 1.0 — effective ', bold: true }),
      new TextRun('August 1, 2026. Reviewed annually.'),
    ]),

    h2('1. Purpose'),
    p('This Plan describes how the Practice detects, contains, investigates, documents, and reports security incidents and breaches of Protected Health Information (PHI) in compliance with the HIPAA Security Rule, the HIPAA Breach Notification Rule, and applicable state laws.'),

    h2('2. Definitions'),
    bullet('Security incident: any attempted or successful unauthorized access, use, disclosure, modification, or destruction of information, or interference with system operations.'),
    bullet('Breach: an acquisition, access, use, or disclosure of PHI in a manner not permitted by the Privacy Rule that compromises the security or privacy of the PHI, unless demonstrated by a low probability of compromise following a documented risk assessment.'),

    h2('3. Roles'),
    bullet(`Privacy Officer and Security Officer: ${C.identity.clinician_with_credentials}.`),
    bullet('Legal counsel: to be identified and on retainer before practice go-live.'),
    bullet('Business Associates: any vendor handling PHI (e.g., SimplePractice) — contact information maintained in vendor register.'),

    h2('4. Detection'),
    p('Possible signs of an incident include: unexpected SimplePractice login alerts, portal or email account lockouts, lost or stolen devices, unusual document access, client reports of suspicious communications, malware warnings, or failed backup alerts.'),

    h2('5. Response procedure'),
    h3('Step 1 — Contain (within 1 hour of detection)'),
    bullet('Isolate the affected device (airplane mode, disconnect from network).'),
    bullet('Rotate credentials for any account involved (1Password).'),
    bullet('If a device is lost or stolen, trigger Find My > Mark as Lost > Remote Wipe.'),

    h3('Step 2 — Assess (within 24 hours)'),
    bullet('Document what happened, when, and what PHI was potentially involved.'),
    bullet('Identify the data elements affected (names, DOBs, diagnoses, session content, etc.).'),
    bullet('Conduct a four-factor breach risk assessment: (a) nature and extent of PHI; (b) unauthorized person who used the PHI or to whom disclosed; (c) whether PHI was actually acquired or viewed; (d) extent to which risk has been mitigated.'),

    h3('Step 3 — Decide (within 72 hours)'),
    bullet('Using the assessment, decide if the event meets the legal definition of a breach.'),
    bullet('Consult legal counsel before finalizing any breach determination.'),
    bullet('Log the decision and rationale in the Incident Register, regardless of outcome.'),

    h3('Step 4 — Notify (per HIPAA timeline)'),
    bullet('Affected individuals: written notice without unreasonable delay, no later than 60 calendar days after discovery. Notice includes: what happened, the PHI involved, steps individuals should take, what the Practice is doing, contact information.'),
    bullet('HHS Office for Civil Rights: if breach affects fewer than 500 individuals, report annually via the OCR portal; if 500 or more, report within 60 days of discovery.'),
    bullet('Media: if breach affects 500 or more individuals in a single state/jurisdiction, notify prominent media outlets in the region within 60 days of discovery.'),
    bullet(`State notification: follow applicable state laws in ${STATE_ABBRS}.`),

    h3('Step 5 — Remediate and learn'),
    bullet('Apply technical or procedural fixes (e.g., new vendor, new policy, targeted training).'),
    bullet('Update the Risk Assessment and this Plan to reflect lessons learned.'),
    bullet('Record the incident and remediation in the Incident Register.'),

    h2('6. Contact tree'),
    bullet(`Privacy/Security Officer: ${C.identity.clinician_with_credentials} — ${PRIVACY_EMAIL} / ${C.contact.phone}.`),
    bullet('SimplePractice support and breach line: per current BAA contact sheet.'),
    bullet('Legal counsel: [to be added before go-live].'),
    bullet('Cyber liability carrier: [to be added before go-live].'),

    h2('7. Tabletop exercise'),
    p('The Privacy Officer will run at least one tabletop exercise per year, walking through a simulated incident against this Plan. The first exercise is scheduled for July 15, 2026. Outcomes and any updates to the Plan are logged.'),

    h2('8. Incident register (template)'),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [1400, 3200, 1600, 1600, 1560],
      rows: [
        new TableRow({ children: ['Date', 'Description', 'Classification', 'Notifications', 'Resolution'].map((t, i) => new TableCell({
          borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
          width: { size: [1400, 3200, 1600, 1600, 1560][i], type: WidthType.DXA },
          shading: { fill: '7A8B6F', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, color: 'FFFFFF' })] })],
        })) }),
        ...Array.from({ length: 3 }, () => new TableRow({ children: ['', '', '', '', ''].map((_, i) => new TableCell({
          borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
          width: { size: [1400, 3200, 1600, 1600, 1560][i], type: WidthType.DXA },
          margins: { top: 120, bottom: 120, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun('')] })],
        })) })),
      ],
    }),

    spacer(),
    hr(),
    ...signatureBlock('Privacy Officer'),
  ];
}

// ---------- run ----------
(async () => {
  await writeDoc('Informed_Consent.docx', buildDoc('Informed Consent', consentChildren()));
  await writeDoc('Notice_of_Privacy_Practices.docx', buildDoc('Notice of Privacy Practices', nppChildren()));
  await writeDoc('Good_Faith_Estimate.docx', buildDoc('Good Faith Estimate', gfeChildren()));
  await writeDoc('HIPAA_Security_Risk_Assessment.docx', buildDoc('HIPAA Security Risk Assessment', riskChildren()));
  await writeDoc('Incident_and_Breach_Response_Plan.docx', buildDoc('Incident & Breach Response Plan', irpChildren()));
})();
