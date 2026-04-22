// Build clinical forms (intake packet) for Simon Parker Therapy, PLLC.
// Output into ../clinical_forms/
//
// 8 files:
//   1. Intake_Questionnaire.docx
//   2. PHQ-9.docx                    (depression screen, public domain)
//   3. GAD-7.docx                    (anxiety screen, public domain)
//   4. PCL-5.docx                    (PTSD checklist, public domain via NCPTSD)
//   5. Treatment_Plan_Template.docx
//   6. Progress_Note_Template.docx
//   7. Superbill_Template.docx
//   8. Release_of_Information.docx
//
// To rebuild: cd tools && node build_clinical_forms.js
// (Run `npm install` once to fetch docx-js if not already done.)
//
// All practice strings (name, licences, NPI, fees, frameworks, phone,
// email) are sourced from tools/practice_constants.json via the
// practice_constants.js helper. Edit that JSON — NOT this file — to
// change the practice's focus, voice, or contact details.

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, TabStopType, TabStopPosition, PageBreak,
} = require('docx');

const C = require('./practice_constants');

const OUT = path.join(__dirname, '..', 'clinical_forms');
fs.mkdirSync(OUT, { recursive: true });

// Convenience values drawn from constants
const LIC = Object.fromEntries(C.licenses.map(l => [l.abbr, l.number]));
const PRACTICE_CONTACT_LINE = `${C.contact.phone}  ·  ${C.contact.email}`;
const FRAMEWORK_CHECKBOX_LINE =
  `Framework: ☐ ${C.frameworks.cbc.name} ` +
  `(${C.frameworks.cbc.attribution.replace(/, and /g, ' / ').replace(/, /g, ' / ')})` +
  `    ☐ ${C.frameworks.ipt.name} ` +
  `(${C.frameworks.ipt.attribution.replace(/, and /g, ' / ').replace(/, /g, ' / ')})` +
  '    ☐ Other: __________';

// ---------- shared layout ----------
const PAGE = { width: 12240, height: 15840 };           // US Letter, DXA
const MARGIN = { top: 1080, right: 1080, bottom: 1080, left: 1080 }; // 0.75"
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;       // 10080

const STYLES = {
  default: { document: { run: { font: 'Arial', size: 22 } } },
  paragraphStyles: [
    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 30, bold: true, font: 'Arial' },
      paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 0 } },
    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 24, bold: true, font: 'Arial' },
      paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
    { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 22, bold: true, font: 'Arial' },
      paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
  ],
};

const NUMBERING = {
  config: [
    { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
    { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
  ],
};

// ---------- helpers ----------
function p(text, opts = {}) {
  const runs = Array.isArray(text)
    ? text
    : [new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size })];
  return new Paragraph({
    children: runs,
    spacing: { after: opts.after ?? 120, line: opts.line ?? 280 },
    alignment: opts.align || AlignmentType.LEFT,
  });
}
function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, bold: true })] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, bold: true })] }); }
function h3(t) { return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: t, bold: true })] }); }
function bullet(t) { return new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun(t)], spacing: { after: 60, line: 280 } }); }
function num(t)    { return new Paragraph({ numbering: { reference: 'numbers', level: 0 }, children: [new TextRun(t)], spacing: { after: 60, line: 280 } }); }
function spacer(after = 80) { return new Paragraph({ children: [new TextRun('')], spacing: { after } }); }

// horizontal rule using paragraph border
function hr() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } },
    spacing: { before: 80, after: 120 },
    children: [new TextRun('')],
  });
}

// underlined fill-in line: a paragraph with a bottom border, of fixed-ish height
function fillLine(label, after = 100) {
  return new Paragraph({
    children: [new TextRun({ text: label || '', bold: true })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } },
    spacing: { after, line: 320 },
  });
}

// border helper for cells
const border = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(width, children, opts = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: opts.valign,
    columnSpan: opts.span,
    children: children.map(c => typeof c === 'string'
      ? new Paragraph({ children: [new TextRun({ text: c, bold: opts.bold })] })
      : c),
  });
}

// build a 2-col label/blank row (label cell shaded)
function labelRow(label, widthLabel, widthBlank) {
  return new TableRow({
    children: [
      cell(widthLabel, [label], { shade: 'F0F2F5', bold: true }),
      cell(widthBlank, ['']),
    ],
  });
}

// ---------- header / footer ----------
function practiceHeader() {
  return new Header({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: C.identity.legal_entity, bold: true, size: 22 }),
          new TextRun({ text: `\t${C.identity.clinician_with_credentials} · NPI ${C.registry.npi}`, size: 18 }),
        ],
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        spacing: { after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2E75B6', space: 4 } },
      }),
    ],
  });
}

function practiceFooter(extraLeft) {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: extraLeft || C.identity.legal_entity, size: 16, color: '666666' }),
          new TextRun({ text: '\tPage ', size: 16, color: '666666' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '666666' }),
          new TextRun({ text: ' of ', size: 16, color: '666666' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '666666' }),
        ],
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      }),
    ],
  });
}

function makeDoc(children, footerLeft) {
  return new Document({
    styles: STYLES,
    numbering: NUMBERING,
    sections: [{
      properties: { page: { size: PAGE, margin: MARGIN } },
      headers: { default: practiceHeader() },
      footers: { default: practiceFooter(footerLeft) },
      children,
    }],
  });
}

async function write(name, doc) {
  const buf = await Packer.toBuffer(doc);
  const outpath = path.join(OUT, name);
  fs.writeFileSync(outpath, buf);
  console.log(`  ✓ ${name}  (${buf.length.toLocaleString()} bytes)`);
}

// ===========================================================================
// 1. Intake Questionnaire
// ===========================================================================
function buildIntake() {
  const c = [];
  c.push(h1('Client Intake Questionnaire'));
  c.push(p('Please complete this form before our first session. If a question does not apply, write N/A. If you would prefer to discuss something in person rather than write it down, write "in person" — that is a fine answer for any item.', { italics: true, after: 200 }));

  // ---- A. About you ----
  c.push(h2('A. About you'));
  const aTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 7080],
    rows: [
      labelRow('Full legal name', 3000, 7080),
      labelRow('Preferred name', 3000, 7080),
      labelRow('Pronouns', 3000, 7080),
      labelRow('Date of birth', 3000, 7080),
      labelRow('Mailing address', 3000, 7080),
      labelRow('Phone (mobile)', 3000, 7080),
      labelRow('Email', 3000, 7080),
      labelRow('Preferred contact method', 3000, 7080),
      labelRow('OK to leave a voicemail?', 3000, 7080),
      labelRow('OK to send appointment emails?', 3000, 7080),
      labelRow('Occupation / employer', 3000, 7080),
    ],
  });
  c.push(aTbl);
  c.push(spacer());

  // ---- B. Emergency contact ----
  c.push(h2('B. Emergency contact'));
  c.push(p('Someone we can reach if there is a serious concern about your safety. Choosing this person is not consent for me to discuss your treatment with them — only to contact them if I am worried for your wellbeing.', { italics: true }));
  const bTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 7080],
    rows: [
      labelRow('Name', 3000, 7080),
      labelRow('Relationship to you', 3000, 7080),
      labelRow('Phone', 3000, 7080),
    ],
  });
  c.push(bTbl);
  c.push(spacer());

  // ---- C. Referral and payment ----
  c.push(h2('C. Referral and payment'));
  c.push(fillLine('How did you hear about the practice?'));
  c.push(fillLine('Who, if anyone, referred you?'));
  c.push(p('I am an out-of-network provider. I do not bill insurance directly. On request, I provide a monthly superbill you can submit to your insurer for possible reimbursement under your out-of-network mental-health benefits.', { italics: true }));
  c.push(fillLine('Will you be requesting a monthly superbill?  (Yes / No / Decide later)'));
  c.push(spacer());

  // ---- D. What brings you here ----
  c.push(h2('D. What brings you here'));
  c.push(p('Briefly, in your own words: what is going on, and what would you like to be different?', { italics: true }));
  for (let i = 0; i < 6; i++) c.push(fillLine(''));
  c.push(fillLine('When did this start, or when did it get noticeably worse?'));
  c.push(fillLine('What have you already tried?'));
  c.push(spacer());

  // ---- E. Mental health history ----
  c.push(h2('E. Mental health history'));
  c.push(fillLine('Previous therapy or counselling (when, with whom, what was it for, was it helpful?)'));
  for (let i = 0; i < 3; i++) c.push(fillLine(''));
  c.push(fillLine('Psychiatric medications (current or past — name, prescriber, dates, effect)'));
  for (let i = 0; i < 3; i++) c.push(fillLine(''));
  c.push(fillLine('Psychiatric hospitalisations (when, where, reason)'));
  for (let i = 0; i < 2; i++) c.push(fillLine(''));
  c.push(p('Have you ever had thoughts of suicide or self-harm? (Never / In the past / Recently / Currently)', { bold: true }));
  c.push(fillLine(''));
  c.push(p('If recently or currently, please describe briefly. We will discuss this together in session.', { italics: true }));
  for (let i = 0; i < 2; i++) c.push(fillLine(''));
  c.push(spacer());

  // ---- F. Medical history ----
  c.push(h2('F. Medical history'));
  c.push(fillLine('Primary care provider (name, practice, phone)'));
  c.push(fillLine('Current medical conditions'));
  for (let i = 0; i < 2; i++) c.push(fillLine(''));
  c.push(fillLine('Current medications (prescription, OTC, supplements — name, dose, purpose)'));
  for (let i = 0; i < 3; i++) c.push(fillLine(''));
  c.push(fillLine('Allergies'));
  c.push(fillLine('History of head injury, concussion, or loss of consciousness?'));
  c.push(spacer());

  // ---- G. Substance use ----
  c.push(h2('G. Substance use'));
  c.push(p('A brief, honest answer here is more useful than a careful one. Nothing here is reported to anyone outside the practice except as required by law (see Informed Consent).', { italics: true }));
  const gTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 3540, 3540],
    rows: [
      new TableRow({ children: [
        cell(3000, [''], { shade: 'F0F2F5' }),
        cell(3540, ['Frequency'], { shade: 'F0F2F5', bold: true }),
        cell(3540, ['Typical amount'], { shade: 'F0F2F5', bold: true }),
      ]}),
      new TableRow({ children: [ cell(3000, ['Alcohol'], { shade: 'F0F2F5', bold: true }), cell(3540, ['']), cell(3540, ['']) ]}),
      new TableRow({ children: [ cell(3000, ['Tobacco / nicotine'], { shade: 'F0F2F5', bold: true }), cell(3540, ['']), cell(3540, ['']) ]}),
      new TableRow({ children: [ cell(3000, ['Cannabis'], { shade: 'F0F2F5', bold: true }), cell(3540, ['']), cell(3540, ['']) ]}),
      new TableRow({ children: [ cell(3000, ['Caffeine'], { shade: 'F0F2F5', bold: true }), cell(3540, ['']), cell(3540, ['']) ]}),
      new TableRow({ children: [ cell(3000, ['Other (please specify)'], { shade: 'F0F2F5', bold: true }), cell(3540, ['']), cell(3540, ['']) ]}),
    ],
  });
  c.push(gTbl);
  c.push(fillLine('Have you ever been concerned about your use, or has anyone close to you been concerned?'));
  c.push(spacer());

  // ---- H. Family history ----
  c.push(h2('H. Family history'));
  c.push(fillLine('Mental health diagnoses in close family (parents, siblings, children)'));
  for (let i = 0; i < 2; i++) c.push(fillLine(''));
  c.push(fillLine('Substance use issues in close family'));
  c.push(fillLine('Suicide in family or close circle'));
  c.push(spacer());

  // ---- I. Relationships and support ----
  c.push(h2('I. Relationships and support'));
  c.push(fillLine('Relationship status'));
  c.push(fillLine('Who lives in your household?'));
  c.push(fillLine('Children or other dependents'));
  c.push(fillLine('People you can rely on when things are hard'));
  c.push(spacer());

  // ---- J. Trauma ----
  c.push(h2('J. Trauma history'));
  c.push(p('You do not need to write anything detailed here. A short note, or "discuss in person", is fine. If any of the items in section L apply, please flag them too.', { italics: true }));
  c.push(fillLine('Significant difficult or traumatic experiences (childhood, adulthood, occupational)'));
  for (let i = 0; i < 4; i++) c.push(fillLine(''));
  c.push(spacer());

  // ---- K. Service / first responder ----
  c.push(h2('K. Military service or first responder background (optional)'));
  c.push(p('Complete this section if it applies. The practice has particular experience with veterans, active-duty service members, and first responders, and this background context is useful — but only share what you are comfortable sharing.', { italics: true }));
  const kTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3500, 6580],
    rows: [
      labelRow('Branch / agency', 3500, 6580),
      labelRow('Dates of service', 3500, 6580),
      labelRow('MOS / specialty / rank', 3500, 6580),
      labelRow('Deployments (where, when)', 3500, 6580),
      labelRow('Combat exposure (yes / no / prefer not to say)', 3500, 6580),
      labelRow('Discharge status (if applicable)', 3500, 6580),
      labelRow('Current status (active / reserve / retired / separated)', 3500, 6580),
      labelRow('Service-connected disability rating (if applicable)', 3500, 6580),
      labelRow('Current or prior VA care', 3500, 6580),
    ],
  });
  c.push(kTbl);
  c.push(spacer());

  // ---- L. Goals ----
  c.push(h2('L. Goals'));
  c.push(p('If we did good work together over the next several months, what would be different?', { italics: true }));
  for (let i = 0; i < 5; i++) c.push(fillLine(''));
  c.push(spacer());

  // ---- M. Anything else ----
  c.push(h2('M. Anything you would like me to know'));
  for (let i = 0; i < 4; i++) c.push(fillLine(''));
  c.push(spacer());

  // ---- Acknowledgement ----
  c.push(h2('Acknowledgement'));
  c.push(p('I confirm that the information above is accurate to the best of my knowledge, and I understand that I can update or expand any of it during the course of treatment.'));
  c.push(spacer(160));
  const sigTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [6080, 4000],
    rows: [
      new TableRow({ children: [
        cell(6080, [new Paragraph({ children: [new TextRun({ text: 'Client signature', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
        cell(4000, [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
      ]}),
    ],
  });
  c.push(sigTbl);
  c.push(spacer(120));
  c.push(p('In a crisis? Call or text 988 (Suicide and Crisis Lifeline). Veterans: press 1 after 988 for the Veterans Crisis Line. If you are in immediate danger, call 911.', { italics: true }));

  return makeDoc(c, 'Intake Questionnaire');
}

// ===========================================================================
// 2. PHQ-9
// ===========================================================================
function buildPHQ9() {
  const c = [];
  c.push(h1('Patient Health Questionnaire (PHQ-9)'));
  c.push(p('A standard, self-administered measure used to screen for and track symptoms of depression. It takes about two minutes. Please complete it before each session, or as your clinician asks.', { italics: true }));
  c.push(spacer());

  // client info row
  const idTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [5040, 5040],
    rows: [
      new TableRow({ children: [
        cell(5040, [new Paragraph({ children: [new TextRun({ text: 'Name', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
        cell(5040, [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
      ]}),
    ],
  });
  c.push(idTbl);
  c.push(spacer());

  c.push(p('Over the last 2 weeks, how often have you been bothered by any of the following problems?', { bold: true }));
  c.push(spacer(60));

  const items = [
    'Little interest or pleasure in doing things',
    'Feeling down, depressed, or hopeless',
    'Trouble falling or staying asleep, or sleeping too much',
    'Feeling tired or having little energy',
    'Poor appetite or overeating',
    'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
    'Trouble concentrating on things, such as reading the newspaper or watching television',
    'Moving or speaking so slowly that other people could have noticed. Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
    'Thoughts that you would be better off dead or of hurting yourself in some way',
  ];

  // header row
  const COL_NUM = 540, COL_ITEM = 4540, COL_OPT = 1250; // 540 + 4540 + 4*1250 = 10080
  const hdrShade = '2E75B6';
  const hdr = new TableRow({ children: [
    cell(COL_NUM, [new Paragraph({ children: [new TextRun({ text: '#', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
    cell(COL_ITEM, [new Paragraph({ children: [new TextRun({ text: 'In the last two weeks…', bold: true, color: 'FFFFFF' })] })], { shade: hdrShade }),
    cell(COL_OPT, [new Paragraph({ children: [new TextRun({ text: 'Not at all', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
    cell(COL_OPT, [new Paragraph({ children: [new TextRun({ text: 'Several days', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
    cell(COL_OPT, [new Paragraph({ children: [new TextRun({ text: 'More than half the days', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
    cell(COL_OPT, [new Paragraph({ children: [new TextRun({ text: 'Nearly every day', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
  ]});

  const rows = [hdr];
  items.forEach((it, i) => {
    rows.push(new TableRow({ children: [
      cell(COL_NUM, [new Paragraph({ children: [new TextRun(String(i + 1))], alignment: AlignmentType.CENTER })]),
      cell(COL_ITEM, [it]),
      cell(COL_OPT, [new Paragraph({ children: [new TextRun('☐  0')], alignment: AlignmentType.CENTER })]),
      cell(COL_OPT, [new Paragraph({ children: [new TextRun('☐  1')], alignment: AlignmentType.CENTER })]),
      cell(COL_OPT, [new Paragraph({ children: [new TextRun('☐  2')], alignment: AlignmentType.CENTER })]),
      cell(COL_OPT, [new Paragraph({ children: [new TextRun('☐  3')], alignment: AlignmentType.CENTER })]),
    ]}));
  });

  c.push(new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [COL_NUM, COL_ITEM, COL_OPT, COL_OPT, COL_OPT, COL_OPT],
    rows,
  }));
  c.push(spacer(160));

  c.push(h2('Functional impairment'));
  c.push(p('If you checked any problems above, how difficult have they made it for you to do your work, take care of things at home, or get along with other people?'));
  c.push(p('☐  Not difficult at all      ☐  Somewhat difficult      ☐  Very difficult      ☐  Extremely difficult', { after: 160 }));

  c.push(h2('For clinician use'));
  const scoreTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 7080],
    rows: [
      labelRow('Total score (sum of items 1–9)', 3000, 7080),
      labelRow('Severity category', 3000, 7080),
      labelRow('Item 9 endorsement (yes/no, plan, intent)', 3000, 7080),
      labelRow('Action taken / risk plan', 3000, 7080),
      labelRow('Clinician initials & date', 3000, 7080),
    ],
  });
  c.push(scoreTbl);
  c.push(spacer(120));

  c.push(h3('Severity scoring'));
  c.push(bullet('0–4    None / minimal'));
  c.push(bullet('5–9    Mild depression'));
  c.push(bullet('10–14  Moderate depression'));
  c.push(bullet('15–19  Moderately severe depression'));
  c.push(bullet('20–27  Severe depression'));
  c.push(spacer(80));
  c.push(p('Item 9 is a screen for suicidal ideation. Any positive endorsement is reviewed in session and addressed in the risk note.', { italics: true }));
  c.push(spacer());

  c.push(p('PHQ-9 © Pfizer Inc. Developed by Drs. Robert L. Spitzer, Janet B. W. Williams, Kurt Kroenke, and colleagues, with an educational grant from Pfizer Inc. No permission required to reproduce, translate, display, or distribute.', { italics: true, size: 18 }));
  c.push(p('In a crisis? Call or text 988 (Suicide and Crisis Lifeline). Veterans: press 1 after 988. If you are in immediate danger, call 911.', { italics: true, size: 18 }));

  return makeDoc(c, 'PHQ-9');
}

// ===========================================================================
// 3. GAD-7
// ===========================================================================
function buildGAD7() {
  const c = [];
  c.push(h1('Generalized Anxiety Disorder (GAD-7)'));
  c.push(p('A standard, self-administered measure used to screen for and track symptoms of generalised anxiety. It takes about a minute. Please complete it before each session, or as your clinician asks.', { italics: true }));
  c.push(spacer());

  const idTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [5040, 5040],
    rows: [
      new TableRow({ children: [
        cell(5040, [new Paragraph({ children: [new TextRun({ text: 'Name', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
        cell(5040, [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
      ]}),
    ],
  });
  c.push(idTbl);
  c.push(spacer());

  c.push(p('Over the last 2 weeks, how often have you been bothered by the following problems?', { bold: true }));
  c.push(spacer(60));

  const items = [
    'Feeling nervous, anxious, or on edge',
    'Not being able to stop or control worrying',
    'Worrying too much about different things',
    'Trouble relaxing',
    'Being so restless that it is hard to sit still',
    'Becoming easily annoyed or irritable',
    'Feeling afraid as if something awful might happen',
  ];

  const COL_NUM = 540, COL_ITEM = 4540, COL_OPT = 1250;
  const hdrShade = '2E75B6';
  const hdr = new TableRow({ children: [
    cell(COL_NUM, [new Paragraph({ children: [new TextRun({ text: '#', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
    cell(COL_ITEM, [new Paragraph({ children: [new TextRun({ text: 'In the last two weeks…', bold: true, color: 'FFFFFF' })] })], { shade: hdrShade }),
    cell(COL_OPT, [new Paragraph({ children: [new TextRun({ text: 'Not at all', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
    cell(COL_OPT, [new Paragraph({ children: [new TextRun({ text: 'Several days', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
    cell(COL_OPT, [new Paragraph({ children: [new TextRun({ text: 'More than half the days', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
    cell(COL_OPT, [new Paragraph({ children: [new TextRun({ text: 'Nearly every day', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
  ]});

  const rows = [hdr];
  items.forEach((it, i) => {
    rows.push(new TableRow({ children: [
      cell(COL_NUM, [new Paragraph({ children: [new TextRun(String(i + 1))], alignment: AlignmentType.CENTER })]),
      cell(COL_ITEM, [it]),
      cell(COL_OPT, [new Paragraph({ children: [new TextRun('☐  0')], alignment: AlignmentType.CENTER })]),
      cell(COL_OPT, [new Paragraph({ children: [new TextRun('☐  1')], alignment: AlignmentType.CENTER })]),
      cell(COL_OPT, [new Paragraph({ children: [new TextRun('☐  2')], alignment: AlignmentType.CENTER })]),
      cell(COL_OPT, [new Paragraph({ children: [new TextRun('☐  3')], alignment: AlignmentType.CENTER })]),
    ]}));
  });

  c.push(new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [COL_NUM, COL_ITEM, COL_OPT, COL_OPT, COL_OPT, COL_OPT],
    rows,
  }));
  c.push(spacer(160));

  c.push(h2('Functional impairment'));
  c.push(p('If you checked any problems above, how difficult have they made it for you to do your work, take care of things at home, or get along with other people?'));
  c.push(p('☐  Not difficult at all      ☐  Somewhat difficult      ☐  Very difficult      ☐  Extremely difficult', { after: 160 }));

  c.push(h2('For clinician use'));
  const scoreTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 7080],
    rows: [
      labelRow('Total score (sum of items 1–7)', 3000, 7080),
      labelRow('Severity category', 3000, 7080),
      labelRow('Notes', 3000, 7080),
      labelRow('Clinician initials & date', 3000, 7080),
    ],
  });
  c.push(scoreTbl);
  c.push(spacer(120));

  c.push(h3('Severity scoring'));
  c.push(bullet('0–4    Minimal anxiety'));
  c.push(bullet('5–9    Mild anxiety'));
  c.push(bullet('10–14  Moderate anxiety'));
  c.push(bullet('15–21  Severe anxiety'));
  c.push(spacer(80));
  c.push(p('Cut-off of 10 or higher is the typical threshold for further evaluation.', { italics: true }));
  c.push(spacer());

  c.push(p('GAD-7 © Pfizer Inc. Developed by Drs. Robert L. Spitzer, Kurt Kroenke, Janet B. W. Williams, and Bernd Löwe, with an educational grant from Pfizer Inc. No permission required to reproduce, translate, display, or distribute.', { italics: true, size: 18 }));

  return makeDoc(c, 'GAD-7');
}

// ===========================================================================
// 4. PCL-5
// ===========================================================================
function buildPCL5() {
  const c = [];
  c.push(h1('PTSD Checklist for DSM-5 (PCL-5)'));
  c.push(p('A standard, self-administered measure used to screen for and track symptoms of post-traumatic stress disorder. Please complete with reference to the past month. It takes about five minutes.', { italics: true }));
  c.push(spacer());

  const idTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [5040, 5040],
    rows: [
      new TableRow({ children: [
        cell(5040, [new Paragraph({ children: [new TextRun({ text: 'Name', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
        cell(5040, [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
      ]}),
    ],
  });
  c.push(idTbl);
  c.push(spacer());

  c.push(p('Below is a list of problems that people sometimes have in response to a very stressful experience. Please read each problem carefully and indicate how much you have been bothered by that problem in the past month.', { bold: true }));
  c.push(spacer(60));

  // PCL-5 items (DSM-5 ordering)
  const items = [
    'Repeated, disturbing, and unwanted memories of the stressful experience',
    'Repeated, disturbing dreams of the stressful experience',
    'Suddenly feeling or acting as if the stressful experience were actually happening again (as if you were actually back there reliving it)',
    'Feeling very upset when something reminded you of the stressful experience',
    'Having strong physical reactions when something reminded you of the stressful experience (for example, heart pounding, trouble breathing, sweating)',
    'Avoiding memories, thoughts, or feelings related to the stressful experience',
    'Avoiding external reminders of the stressful experience (for example, people, places, conversations, activities, objects, or situations)',
    'Trouble remembering important parts of the stressful experience',
    'Having strong negative beliefs about yourself, other people, or the world (for example: I am bad, there is something seriously wrong with me, no one can be trusted, the world is completely dangerous)',
    'Blaming yourself or someone else for the stressful experience or what happened after it',
    'Having strong negative feelings such as fear, horror, anger, guilt, or shame',
    'Loss of interest in activities that you used to enjoy',
    'Feeling distant or cut off from other people',
    'Trouble experiencing positive feelings (for example, being unable to feel happiness or have loving feelings for people close to you)',
    'Irritable behaviour, angry outbursts, or acting aggressively',
    'Taking too many risks or doing things that could cause you harm',
    'Being “superalert” or watchful or on guard',
    'Feeling jumpy or easily startled',
    'Having difficulty concentrating',
    'Trouble falling or staying asleep',
  ];

  const COL_NUM = 540, COL_ITEM = 4140, COL_OPT = 1080; // 540 + 4140 + 5*1080 = 10080
  const hdrShade = '2E75B6';
  const hdr = new TableRow({ children: [
    cell(COL_NUM, [new Paragraph({ children: [new TextRun({ text: '#', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
    cell(COL_ITEM, [new Paragraph({ children: [new TextRun({ text: 'In the past month, how much were you bothered by…', bold: true, color: 'FFFFFF' })] })], { shade: hdrShade }),
    cell(COL_OPT, [new Paragraph({ children: [new TextRun({ text: 'Not at all', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
    cell(COL_OPT, [new Paragraph({ children: [new TextRun({ text: 'A little bit', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
    cell(COL_OPT, [new Paragraph({ children: [new TextRun({ text: 'Moderately', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
    cell(COL_OPT, [new Paragraph({ children: [new TextRun({ text: 'Quite a bit', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
    cell(COL_OPT, [new Paragraph({ children: [new TextRun({ text: 'Extremely', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], { shade: hdrShade }),
  ]});

  const rows = [hdr];
  items.forEach((it, i) => {
    rows.push(new TableRow({ children: [
      cell(COL_NUM, [new Paragraph({ children: [new TextRun(String(i + 1))], alignment: AlignmentType.CENTER })]),
      cell(COL_ITEM, [it]),
      cell(COL_OPT, [new Paragraph({ children: [new TextRun('☐  0')], alignment: AlignmentType.CENTER })]),
      cell(COL_OPT, [new Paragraph({ children: [new TextRun('☐  1')], alignment: AlignmentType.CENTER })]),
      cell(COL_OPT, [new Paragraph({ children: [new TextRun('☐  2')], alignment: AlignmentType.CENTER })]),
      cell(COL_OPT, [new Paragraph({ children: [new TextRun('☐  3')], alignment: AlignmentType.CENTER })]),
      cell(COL_OPT, [new Paragraph({ children: [new TextRun('☐  4')], alignment: AlignmentType.CENTER })]),
    ]}));
  });

  c.push(new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [COL_NUM, COL_ITEM, COL_OPT, COL_OPT, COL_OPT, COL_OPT, COL_OPT],
    rows,
  }));
  c.push(spacer(160));

  c.push(h2('For clinician use'));
  const scoreTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 7080],
    rows: [
      labelRow('Total symptom severity (sum of all 20 items)', 3000, 7080),
      labelRow('Cluster B — Intrusion (items 1–5)', 3000, 7080),
      labelRow('Cluster C — Avoidance (items 6–7)', 3000, 7080),
      labelRow('Cluster D — Negative alterations in cognition/mood (items 8–14)', 3000, 7080),
      labelRow('Cluster E — Alterations in arousal/reactivity (items 15–20)', 3000, 7080),
      labelRow('Provisional PTSD diagnosis (DSM-5 cluster rule met?)', 3000, 7080),
      labelRow('Index event (brief description)', 3000, 7080),
      labelRow('Clinician initials & date', 3000, 7080),
    ],
  });
  c.push(scoreTbl);
  c.push(spacer(120));

  c.push(h3('Scoring notes'));
  c.push(bullet('Cut-off of 31–33 is suggestive of probable PTSD; clinical interview confirms diagnosis.'));
  c.push(bullet('Provisional diagnosis: at least one Cluster B item (1–5), one Cluster C item (6–7), two Cluster D items (8–14), and two Cluster E items (15–20) rated at 2 (Moderately) or higher.'));
  c.push(bullet('Pair with the Life Events Checklist (LEC-5) and a clinical interview when establishing diagnosis.'));
  c.push(spacer());

  c.push(p('PCL-5 developed by Weathers, Litz, Keane, Palmieri, Marx, and Schnurr (2013). National Center for PTSD, U.S. Department of Veterans Affairs. Public domain — no permission required to reproduce or use.', { italics: true, size: 18 }));
  c.push(p('In a crisis? Call or text 988 (Suicide and Crisis Lifeline). Veterans: press 1 after 988 for the Veterans Crisis Line. If you are in immediate danger, call 911.', { italics: true, size: 18 }));

  return makeDoc(c, 'PCL-5');
}

// ===========================================================================
// 5. Treatment Plan Template
// ===========================================================================
function buildTreatmentPlan() {
  const c = [];
  c.push(h1('Treatment Plan'));

  const idTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 7080],
    rows: [
      labelRow('Client name', 3000, 7080),
      labelRow('Client ID / record #', 3000, 7080),
      labelRow('Date of birth', 3000, 7080),
      labelRow('Plan date', 3000, 7080),
      labelRow('Plan number (initial / 90-day review / etc.)', 3000, 7080),
      labelRow('Clinician', 3000, 7080),
      labelRow('Modality (individual / couples / family)', 3000, 7080),
      labelRow('Frequency (e.g., weekly 50 min)', 3000, 7080),
    ],
  });
  c.push(idTbl);
  c.push(spacer());

  c.push(h2('Diagnosis'));
  const dxTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [2000, 6080, 2000],
    rows: [
      new TableRow({ children: [
        cell(2000, ['ICD-10'], { shade: 'F0F2F5', bold: true }),
        cell(6080, ['Description'], { shade: 'F0F2F5', bold: true }),
        cell(2000, ['Primary / 2°'], { shade: 'F0F2F5', bold: true }),
      ]}),
      new TableRow({ children: [ cell(2000, ['']), cell(6080, ['']), cell(2000, ['']) ]}),
      new TableRow({ children: [ cell(2000, ['']), cell(6080, ['']), cell(2000, ['']) ]}),
      new TableRow({ children: [ cell(2000, ['']), cell(6080, ['']), cell(2000, ['']) ]}),
    ],
  });
  c.push(dxTbl);
  c.push(spacer());

  c.push(h2('Presenting problems'));
  c.push(p('Concise clinical formulation: what the client is here for, in their own words and yours. Include onset, course, contributing factors.', { italics: true }));
  for (let i = 0; i < 5; i++) c.push(fillLine(''));
  c.push(spacer());

  c.push(h2('Strengths and protective factors'));
  for (let i = 0; i < 3; i++) c.push(fillLine(''));
  c.push(spacer());

  c.push(h2('Risk factors'));
  c.push(p('Suicidality, self-harm, harm to others, substance use, medical, social. Note current risk level and any safety planning in place.', { italics: true }));
  for (let i = 0; i < 3; i++) c.push(fillLine(''));
  c.push(spacer());

  c.push(h2('Outcome measures (baseline → target)'));
  const omTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 1700, 1700, 1700, 2000],
    rows: [
      new TableRow({ children: [
        cell(3000, ['Measure'], { shade: 'F0F2F5', bold: true }),
        cell(1700, ['Baseline'], { shade: 'F0F2F5', bold: true }),
        cell(1700, ['Target'], { shade: 'F0F2F5', bold: true }),
        cell(1700, ['Cadence'], { shade: 'F0F2F5', bold: true }),
        cell(2000, ['Notes'], { shade: 'F0F2F5', bold: true }),
      ]}),
      new TableRow({ children: [ cell(3000, ['PHQ-9']), cell(1700, ['']), cell(1700, ['']), cell(1700, ['Every 2–4 sessions']), cell(2000, ['']) ]}),
      new TableRow({ children: [ cell(3000, ['GAD-7']), cell(1700, ['']), cell(1700, ['']), cell(1700, ['Every 2–4 sessions']), cell(2000, ['']) ]}),
      new TableRow({ children: [ cell(3000, ['PCL-5 (if indicated)']), cell(1700, ['']), cell(1700, ['']), cell(1700, ['Monthly']), cell(2000, ['']) ]}),
      new TableRow({ children: [ cell(3000, ['Other']), cell(1700, ['']), cell(1700, ['']), cell(1700, ['']), cell(2000, ['']) ]}),
    ],
  });
  c.push(omTbl);
  c.push(spacer());

  // Repeating goal block — three of them
  for (let g = 1; g <= 3; g++) {
    c.push(h2(`Goal ${g}`));
    c.push(fillLine(`Long-term goal ${g} (in client's words)`));
    c.push(spacer(60));
    c.push(p('Short-term objectives (specific, measurable, time-bound)', { bold: true }));
    for (let i = 0; i < 3; i++) c.push(fillLine(''));
    c.push(spacer(60));
    c.push(p('Interventions', { bold: true }));
    c.push(p(FRAMEWORK_CHECKBOX_LINE));
    for (let i = 0; i < 3; i++) c.push(fillLine(''));
    c.push(spacer(60));
    c.push(fillLine(`Target review date for Goal ${g}`));
    c.push(spacer());
  }

  c.push(h2('Plan review schedule'));
  c.push(p('Reviewed at minimum every 90 days, or sooner with significant clinical change. Next review: ___________________'));
  c.push(spacer());

  c.push(h2('Discharge criteria'));
  for (let i = 0; i < 3; i++) c.push(fillLine(''));
  c.push(spacer());

  c.push(h2('Coordination of care'));
  c.push(p('Other providers, releases of information in place, planned communication.', { italics: true }));
  for (let i = 0; i < 2; i++) c.push(fillLine(''));
  c.push(spacer(160));

  // Signatures
  const sigTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [6080, 4000],
    rows: [
      new TableRow({ children: [
        cell(6080, [new Paragraph({ children: [new TextRun({ text: 'Clinician signature', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
        cell(4000, [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
      ]}),
      new TableRow({ children: [
        cell(6080, [new Paragraph({ children: [new TextRun({ text: 'Client signature (treatment plan reviewed)', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80, before: 120 } })]),
        cell(4000, [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80, before: 120 } })]),
      ]}),
    ],
  });
  c.push(sigTbl);

  return makeDoc(c, 'Treatment Plan');
}

// ===========================================================================
// 6. Progress Note Template (DAP)
// ===========================================================================
function buildProgressNote() {
  const c = [];
  c.push(h1('Progress Note'));

  // ---- Session header ----
  const idTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 7080],
    rows: [
      labelRow('Client name', 3000, 7080),
      labelRow('Date of service', 3000, 7080),
      labelRow('Time in / out / total', 3000, 7080),
      labelRow('CPT code (90791 / 90834 / 90837 / 90847 / other)', 3000, 7080),
      labelRow('Place of service (telehealth POS 10 / in-person POS 11)', 3000, 7080),
      labelRow('Modality (video / phone / in-person)', 3000, 7080),
      labelRow('Attendance (client / no-show / late cancel)', 3000, 7080),
      labelRow('Diagnoses addressed (ICD-10)', 3000, 7080),
    ],
  });
  c.push(idTbl);
  c.push(spacer());

  c.push(h2('D — Data'));
  c.push(p('Client report and observable behaviour. Mood, affect, presentation, content of session in their own words. MSE bullets where indicated.', { italics: true }));
  for (let i = 0; i < 6; i++) c.push(fillLine(''));
  c.push(spacer());

  c.push(h2('A — Assessment'));
  c.push(p('Clinical formulation: themes, progress against treatment plan goals, framework alignment (Beckian CBT + REBT / IPT), barriers, hypotheses.', { italics: true }));
  for (let i = 0; i < 5; i++) c.push(fillLine(''));
  c.push(spacer());

  c.push(h2('P — Plan'));
  c.push(p('Interventions used this session, between-session work, focus for next session, any referrals, coordination of care actions.', { italics: true }));
  for (let i = 0; i < 4; i++) c.push(fillLine(''));
  c.push(spacer());

  c.push(h2('Risk assessment'));
  const riskTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 7080],
    rows: [
      labelRow('Suicidal ideation (None / Passive / Active — plan? intent? means?)', 3000, 7080),
      labelRow('Homicidal ideation (None / Passive / Active — target? plan? intent?)', 3000, 7080),
      labelRow('Self-harm (None / Past / Recent)', 3000, 7080),
      labelRow('AVH / psychotic features (None / Present)', 3000, 7080),
      labelRow('Substance use this period', 3000, 7080),
      labelRow('Safety plan reviewed / updated this session?', 3000, 7080),
      labelRow('Action taken (consult, referral, ED, 988, none)', 3000, 7080),
    ],
  });
  c.push(riskTbl);
  c.push(spacer());

  c.push(h2('Outcome measures administered'));
  c.push(p('PHQ-9: ____    GAD-7: ____    PCL-5: ____    Other: ____'));
  c.push(spacer(160));

  // Signature
  const sigTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [6080, 4000],
    rows: [
      new TableRow({ children: [
        cell(6080, [new Paragraph({ children: [new TextRun({ text: `Clinician signature (${C.identity.clinician_with_credentials})`, bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
        cell(4000, [new Paragraph({ children: [new TextRun({ text: 'Date / time signed', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
      ]}),
    ],
  });
  c.push(sigTbl);
  c.push(spacer(80));
  c.push(p('Note locked at signature. Any subsequent corrections recorded as an addendum with date, time, and reason.', { italics: true, size: 18 }));

  return makeDoc(c, 'Progress Note');
}

// ===========================================================================
// 7. Superbill Template
// ===========================================================================
function buildSuperbill() {
  const c = [];
  c.push(h1('Superbill — Statement for Insurance Reimbursement'));
  c.push(p('This statement documents services you have already paid for. Submit it to your insurance company for possible reimbursement under your out-of-network mental health benefits. The practice does not bill insurance directly.', { italics: true }));
  c.push(spacer());

  // Provider block
  c.push(h2('Provider'));
  const provTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 7080],
    rows: [
      new TableRow({ children: [ cell(3000, ['Practice'], { shade: 'F0F2F5', bold: true }), cell(7080, [C.identity.legal_entity]) ]}),
      new TableRow({ children: [ cell(3000, ['Clinician'], { shade: 'F0F2F5', bold: true }), cell(7080, [C.identity.clinician_with_credentials]) ]}),
      new TableRow({ children: [ cell(3000, ['NPI'], { shade: 'F0F2F5', bold: true }), cell(7080, [C.registry.npi]) ]}),
      new TableRow({ children: [ cell(3000, ['Taxonomy'], { shade: 'F0F2F5', bold: true }), cell(7080, ['1041C0700X — Social Worker, Clinical']) ]}),
      new TableRow({ children: [ cell(3000, ['Pennsylvania licence'], { shade: 'F0F2F5', bold: true }), cell(7080, [`LCSW ${LIC.PA}`]) ]}),
      new TableRow({ children: [ cell(3000, ['Texas licence'], { shade: 'F0F2F5', bold: true }), cell(7080, [`LCSW ${LIC.TX}`]) ]}),
      new TableRow({ children: [ cell(3000, ['California licence'], { shade: 'F0F2F5', bold: true }), cell(7080, [`LCSW ${LIC.CA}`]) ]}),
      new TableRow({ children: [ cell(3000, ['Federal Tax ID (EIN)'], { shade: 'F0F2F5', bold: true }), cell(7080, ['______________________']) ]}),
      new TableRow({ children: [ cell(3000, ['Practice address'], { shade: 'F0F2F5', bold: true }), cell(7080, ['______________________']) ]}),
      new TableRow({ children: [ cell(3000, ['Practice phone / email'], { shade: 'F0F2F5', bold: true }), cell(7080, [PRACTICE_CONTACT_LINE]) ]}),
    ],
  });
  c.push(provTbl);
  c.push(spacer());

  // Client block
  c.push(h2('Client'));
  const cliTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 7080],
    rows: [
      labelRow('Name', 3000, 7080),
      labelRow('Date of birth', 3000, 7080),
      labelRow('Address', 3000, 7080),
      labelRow('Insurance member ID (if applicable)', 3000, 7080),
      labelRow('Statement date', 3000, 7080),
      labelRow('Statement period', 3000, 7080),
    ],
  });
  c.push(cliTbl);
  c.push(spacer());

  // Services rendered table
  c.push(h2('Services rendered'));
  const svcTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [1400, 1400, 1400, 1400, 1500, 1480, 1500],
    rows: [
      new TableRow({ children: [
        cell(1400, ['Date'], { shade: 'F0F2F5', bold: true }),
        cell(1400, ['CPT'], { shade: 'F0F2F5', bold: true }),
        cell(1400, ['POS'], { shade: 'F0F2F5', bold: true }),
        cell(1400, ['ICD-10'], { shade: 'F0F2F5', bold: true }),
        cell(1500, ['Fee'], { shade: 'F0F2F5', bold: true }),
        cell(1480, ['Paid'], { shade: 'F0F2F5', bold: true }),
        cell(1500, ['Balance'], { shade: 'F0F2F5', bold: true }),
      ]}),
      ...Array.from({ length: 10 }, () => new TableRow({ children: [
        cell(1400, ['']), cell(1400, ['']), cell(1400, ['']), cell(1400, ['']),
        cell(1500, ['']), cell(1480, ['']), cell(1500, ['']),
      ]})),
      new TableRow({ children: [
        cell(1400, ['Totals'], { shade: 'F0F2F5', bold: true, span: 4 }),
        cell(1500, [''], { shade: 'F0F2F5', bold: true }),
        cell(1480, [''], { shade: 'F0F2F5', bold: true }),
        cell(1500, [''], { shade: 'F0F2F5', bold: true }),
      ]}),
    ],
  });
  c.push(svcTbl);
  c.push(spacer());

  c.push(h3('Common CPT codes used by this practice'));
  c.push(bullet('90791 — Diagnostic intake interview, no medical services (50–60 min)'));
  c.push(bullet('90834 — Individual psychotherapy, 45 min (38–52 min)'));
  c.push(bullet('90837 — Individual psychotherapy, 60 min (53+ min)'));
  c.push(bullet('90847 — Family / couples psychotherapy with patient present, 50 min'));
  c.push(bullet('90846 — Family / couples psychotherapy without patient present, 50 min'));
  c.push(bullet('90839 / 90840 — Crisis psychotherapy (60 min, +30 min add-on)'));
  c.push(spacer());

  c.push(h3('Place of service codes'));
  c.push(bullet('11 — Office (in-person)'));
  c.push(bullet('10 — Telehealth provided in patient’s home'));
  c.push(bullet('02 — Telehealth other than patient’s home'));
  c.push(spacer());

  c.push(h2('Notes for the client'));
  c.push(p('I am an out-of-network provider. This statement is provided so you can seek possible reimbursement from your insurer under your out-of-network mental health benefits.'));
  c.push(p('Reimbursement is not guaranteed and depends on your plan, your deductible, and your insurer’s definition of medical necessity. To check your coverage, call the member services number on the back of your insurance card and ask: (1) Do I have out-of-network mental health benefits? (2) What is my out-of-network deductible, and how much have I met? (3) What percentage of the allowed amount is reimbursed after the deductible? (4) Are there session limits or pre-authorisation requirements?'));
  c.push(p('I do not file insurance claims on your behalf and I do not communicate with insurers about your treatment without a separate written authorisation.'));
  c.push(spacer(160));

  // Signature
  const sigTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [6080, 4000],
    rows: [
      new TableRow({ children: [
        cell(6080, [new Paragraph({ children: [new TextRun({ text: `Clinician signature (${C.identity.clinician_with_credentials})`, bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
        cell(4000, [new Paragraph({ children: [new TextRun({ text: 'Date issued', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
      ]}),
    ],
  });
  c.push(sigTbl);

  return makeDoc(c, 'Superbill');
}

// ===========================================================================
// 8. Release of Information
// ===========================================================================
function buildROI() {
  const c = [];
  c.push(h1('Authorisation for Release of Protected Health Information'));
  c.push(p(`Use this form to authorise ${C.identity.legal_entity} to disclose your protected health information to another party, or to receive information from another party, for the purpose of coordinating your care. This authorisation is voluntary; you may refuse to sign it.`, { italics: true }));
  c.push(spacer());

  // Client info
  c.push(h2('1. Client information'));
  const cliTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 7080],
    rows: [
      labelRow('Full legal name', 3000, 7080),
      labelRow('Date of birth', 3000, 7080),
      labelRow('Address', 3000, 7080),
      labelRow('Phone', 3000, 7080),
    ],
  });
  c.push(cliTbl);
  c.push(spacer());

  c.push(h2('2. Direction of disclosure'));
  c.push(p('Tick all that apply.'));
  c.push(p(`☐  ${C.identity.legal_entity} may DISCLOSE my information to the party named below.`));
  c.push(p(`☐  ${C.identity.legal_entity} may RECEIVE information about me from the party named below.`));
  c.push(p(`☐  Two-way communication between ${C.identity.legal_entity} and the party named below.`, { after: 160 }));

  c.push(h2('3. Other party'));
  const otherTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 7080],
    rows: [
      labelRow('Name (provider, agency, or person)', 3000, 7080),
      labelRow('Organisation / role', 3000, 7080),
      labelRow('Address', 3000, 7080),
      labelRow('Phone', 3000, 7080),
      labelRow('Fax (if applicable)', 3000, 7080),
      labelRow('Secure email (if applicable)', 3000, 7080),
    ],
  });
  c.push(otherTbl);
  c.push(spacer());

  c.push(h2('4. Information to be released'));
  c.push(p('Tick all that apply. Items marked with ★ require my separate, specific initials below.'));
  c.push(bullet('☐  Dates of treatment'));
  c.push(bullet('☐  Diagnoses (ICD-10)'));
  c.push(bullet('☐  Treatment summary'));
  c.push(bullet('☐  Treatment plan'));
  c.push(bullet('☐  Progress notes'));
  c.push(bullet('☐  Outcome measures (PHQ-9, GAD-7, PCL-5, etc.)'));
  c.push(bullet('☐  Discharge summary'));
  c.push(bullet('☐  Verbal communication / case consultation'));
  c.push(bullet('☐  Other: ________________________________________________'));
  c.push(spacer(80));
  c.push(p('★ Items requiring separate initials (more sensitive categories of information):', { bold: true }));
  c.push(bullet('☐  Substance use disorder treatment information (42 CFR Part 2)   Initials: _______'));
  c.push(bullet('☐  HIV / AIDS-related information   Initials: _______'));
  c.push(bullet('☐  Genetic testing information   Initials: _______'));
  c.push(bullet('☐  Psychotherapy notes (separate from progress notes per HIPAA)   Initials: _______'));
  c.push(spacer());

  c.push(h2('5. Purpose of disclosure'));
  c.push(bullet('☐  Coordination of care with primary care or psychiatry'));
  c.push(bullet('☐  Coordination of care with another mental health provider'));
  c.push(bullet('☐  At my request'));
  c.push(bullet('☐  Legal proceedings (please specify)'));
  c.push(bullet('☐  Disability / employment evaluation'));
  c.push(bullet('☐  Other: ________________________________________________'));
  c.push(spacer());

  c.push(h2('6. Expiration'));
  c.push(p('This authorisation will expire on:'));
  c.push(p('☐  The following date: _______________________      ☐  One year from the date signed below      ☐  On the following event: _______________________'));
  c.push(spacer());

  c.push(h2('7. Right to revoke'));
  c.push(p(`I understand that I may revoke this authorisation at any time by giving written notice to ${C.identity.legal_entity}, except to the extent that action has already been taken in reliance on it. Revocation may be sent by email to ${C.contact.email} or by post to the practice address on file.`));
  c.push(spacer());

  c.push(h2('8. Re-disclosure'));
  c.push(p('I understand that information disclosed under this authorisation may no longer be protected by federal privacy regulations once it is received by the other party, and may be re-disclosed by them. Substance use disorder information disclosed under 42 CFR Part 2 is subject to additional re-disclosure restrictions.'));
  c.push(spacer());

  c.push(h2('9. Conditions on treatment'));
  c.push(p(`I understand that ${C.identity.legal_entity} will not condition my treatment, payment, enrolment, or eligibility for benefits on whether I sign this authorisation, except as permitted by law.`));
  c.push(spacer(160));

  // Signatures
  const sigTbl = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [6080, 4000],
    rows: [
      new TableRow({ children: [
        cell(6080, [new Paragraph({ children: [new TextRun({ text: 'Client signature', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
        cell(4000, [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80 } })]),
      ]}),
      new TableRow({ children: [
        cell(6080, [new Paragraph({ children: [new TextRun({ text: 'Personal representative (if applicable) — name & relationship', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80, before: 120 } })]),
        cell(4000, [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80, before: 120 } })]),
      ]}),
      new TableRow({ children: [
        cell(6080, [new Paragraph({ children: [new TextRun({ text: `Witness (${C.identity.clinician_with_credentials})`, bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80, before: 120 } })]),
        cell(4000, [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666', space: 4 } }, spacing: { after: 80, before: 120 } })]),
      ]}),
    ],
  });
  c.push(sigTbl);

  return makeDoc(c, 'Release of Information');
}

// ===========================================================================
// Build all
// ===========================================================================
(async () => {
  console.log('Building clinical forms into', OUT);
  await write('Intake_Questionnaire.docx',     buildIntake());
  await write('PHQ-9.docx',                    buildPHQ9());
  await write('GAD-7.docx',                    buildGAD7());
  await write('PCL-5.docx',                    buildPCL5());
  await write('Treatment_Plan_Template.docx',  buildTreatmentPlan());
  await write('Progress_Note_Template.docx',   buildProgressNote());
  await write('Superbill_Template.docx',       buildSuperbill());
  await write('Release_of_Information.docx',   buildROI());
  console.log('Done.');
})();
