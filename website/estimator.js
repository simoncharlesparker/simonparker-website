/* Out-of-network cost estimator — fees page only.
 *
 * Turns "many PPO plans reimburse 40–70% after the deductible" into a figure
 * the reader can act on. The arithmetic is the main reason people put off
 * enquiring, so getting it both usable and honest matters more here than
 * anywhere else on the site.
 *
 * Three design rules, in order of importance:
 *
 *   1. Never overstate what someone gets back. Reimbursement is a percentage
 *      of the plan's *allowed amount*, not of the fee, and the allowed amount
 *      is usually lower. Insurers also credit the allowed amount toward the
 *      deductible, not the full fee — so the deductible takes longer to meet
 *      than a naive calculation suggests. Both are modelled.
 *   2. Nothing leaves the browser. No storage, no network, no analytics.
 *   3. With this script blocked the section stays hidden and the page keeps
 *      the prose above it, which says the same thing in words.
 *
 * The session fee is read from data-session-fee, which the build rewrites
 * from practice_constants.json, so it cannot drift from the quoted fee.
 */
(function () {
  'use strict';

  var root = document.getElementById('estimator');
  if (!root) return;

  var out = document.getElementById('est-result');
  if (!out) return;

  var FEE = parseFloat(root.getAttribute('data-session-fee'));
  if (!isFinite(FEE) || FEE <= 0) return; // nothing sensible to calculate from

  var els = {
    deductible: document.getElementById('est-deductible'),
    met: document.getElementById('est-met'),
    rate: document.getElementById('est-rate'),
    allowed: document.getElementById('est-allowed'),
    frequency: document.getElementById('est-frequency')
  };
  for (var k in els) { if (!els[k]) return; }

  // The fee is only known at runtime, so the optional "allowed amount" field
  // advertises it as its own default rather than hard-coding a number.
  els.allowed.setAttribute('placeholder', String(FEE));

  /* ---- helpers --------------------------------------------------------- */

  // Accepts "1500", "1,500", "$1,500", " 1500 ". Returns null for anything
  // that is not a usable number, so a blank field and a typo are different
  // things and can be reported differently.
  function num(input) {
    var raw = String(input.value || '').replace(/[$,\s]/g, '');
    if (raw === '') return null;
    var n = parseFloat(raw);
    return isFinite(n) && n >= 0 ? n : NaN;
  }

  function money(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function sessionWord(n) {
    return n === 1 ? 'session' : 'sessions';
  }

  /* ---- the calculation -------------------------------------------------- */

  function calculate() {
    var deductible = num(els.deductible);
    var met = num(els.met);
    var rate = num(els.rate);
    var allowed = num(els.allowed);
    var perYear = parseFloat(els.frequency.value) || 52;

    if (deductible === null) return { state: 'empty' };
    if (isNaN(deductible) || isNaN(met) || isNaN(rate) || isNaN(allowed)) {
      return { state: 'invalid' };
    }

    met = met || 0;
    rate = rate === null ? 60 : rate;
    allowed = allowed || FEE;

    if (rate > 100) return { state: 'invalid' };

    // An allowed amount above the fee is meaningless: a plan never pays out
    // on more than was charged.
    allowed = Math.min(allowed, FEE);

    var remaining = Math.max(0, deductible - met);

    // Insurers credit the allowed amount toward the deductible, not the fee.
    var sessionsToDeductible = allowed > 0 ? Math.ceil(remaining / allowed) : 0;

    // Per session, once the deductible is met.
    var backPerSession = Math.min(allowed * (rate / 100), FEE);
    var netPerSession = FEE - backPerSession;

    // Twelve months at the chosen frequency.
    var atFullFee = Math.min(sessionsToDeductible, perYear);
    var reimbursed = Math.max(0, perYear - atFullFee);
    var paidYear = perYear * FEE;
    var backYear = reimbursed * backPerSession;

    return {
      state: 'ok',
      deductibleAlreadyMet: remaining === 0,
      sessionsToDeductible: sessionsToDeductible,
      fee: FEE,
      backPerSession: backPerSession,
      netPerSession: netPerSession,
      perYear: perYear,
      paidYear: paidYear,
      backYear: backYear,
      netYear: paidYear - backYear,
      assumedAllowed: allowed,
      allowedWasAssumed: num(els.allowed) === null,
      rate: rate
    };
  }

  /* ---- rendering -------------------------------------------------------- */

  function render(r) {
    if (r.state === 'empty') {
      out.innerHTML = '<p class="est-placeholder">Enter your deductible to see an estimate.</p>';
      return;
    }
    if (r.state === 'invalid') {
      out.innerHTML = '<p class="est-placeholder">Those numbers don’t quite work. Check the deductible and percentage.</p>';
      return;
    }

    var html = '';

    if (!r.deductibleAlreadyMet) {
      html += '<div class="est-block">' +
        '<div class="est-label">While you meet your deductible</div>' +
        '<div class="est-figure">' + money(r.fee) + ' <span>per session</span></div>' +
        '<p class="est-detail">About <strong>' + r.sessionsToDeductible + ' ' +
        sessionWord(r.sessionsToDeductible) + '</strong>, paid in full.</p>' +
        '</div>';
    } else {
      html += '<div class="est-block">' +
        '<div class="est-label">Your deductible is already met</div>' +
        '<p class="est-detail">So reimbursement should start from your first session.</p>' +
        '</div>';
    }

    // With the allowed amount unknown we have assumed the best case: that the
    // plan allows the full fee. Every figure below is therefore a floor on
    // what you pay and a ceiling on what you get back, and it says so in the
    // figures themselves. A footnote under an optimistic number is not the
    // same as an honest number, because people read the number.
    var assumed = r.allowedWasAssumed;
    var from = assumed ? '<span>from</span> ' : '';
    var backWord = assumed ? 'up to' : 'about';

    html += '<div class="est-block est-block--key">' +
      '<div class="est-label">' + (r.deductibleAlreadyMet ? 'Per session' : 'After that') + '</div>' +
      '<div class="est-figure">' + from + money(r.netPerSession) + ' <span>per session</span></div>' +
      '<p class="est-detail">' + money(r.fee) + ' paid, ' + backWord + ' <strong>' +
      money(r.backPerSession) + '</strong> back from your insurer.</p>' +
      '</div>';

    html += '<div class="est-block">' +
      '<div class="est-label">Over 12 months</div>' +
      '<div class="est-figure">' + from + money(r.netYear) + '</div>' +
      '<p class="est-detail">' + money(r.paidYear) + ' paid across ' + r.perYear +
      ' sessions, ' + backWord + ' ' + money(r.backYear) + ' reimbursed.</p>' +
      '</div>';

    if (assumed) {
      html += '<p class="est-caveat">These are best-case figures: they assume your plan allows ' +
        'the full ' + money(r.fee) + '. Plans often allow less, and then you get back less. ' +
        'Ask your insurer what they allow for CPT 90834 and put it in above for a truer number.</p>';
    }

    out.innerHTML = html;
  }

  function update() { render(calculate()); }

  /* ---- wiring ----------------------------------------------------------- */

  ['input', 'change'].forEach(function (evt) {
    Object.keys(els).forEach(function (key) {
      els[key].addEventListener(evt, update);
    });
  });

  // Only now reveal the section: if anything above threw, the reader is left
  // with the prose rather than a form that does nothing.
  root.removeAttribute('hidden');
  update();
})();
