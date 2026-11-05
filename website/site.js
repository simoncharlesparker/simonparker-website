/* Simon Parker Therapy — progressive enhancement.
 *
 * Two jobs: a one-time entrance animation for each section, and a shadow
 * under the header once the page has scrolled. Both are decoration. The site
 * is fully readable and fully navigable with this file blocked, missing or
 * erroring, and that property is the main design constraint here:
 *
 *   - Nothing is hidden by the stylesheet on its own. The `js-anim` class
 *     set below is what arms the rules in styles.css, so if this script
 *     never runs, no element is ever given opacity: 0.
 *   - The hero is deliberately excluded. It is above the fold, so animating
 *     it would delay the largest contentful paint and flash on load.
 *   - A visitor who has asked their system for reduced motion gets no
 *     animation at all, and `js-anim` is never set.
 *
 * No dependencies, no build step, no network calls, nothing stored.
 */
(function () {
  'use strict';

  var doc = document.documentElement;

  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var canObserve = 'IntersectionObserver' in window;

  /* ---- Entrance animation ---------------------------------------------- */

  function setupReveal() {
    if (prefersReducedMotion || !canObserve) return;

    var main = document.querySelector('main');
    if (!main) return;

    var targets = [];

    Array.prototype.forEach.call(main.children, function (section) {
      // The hero is already on screen when the page loads.
      if (section.classList.contains('hero')) return;

      var inner = section.querySelector(':scope > .container') || section;

      Array.prototype.forEach.call(inner.children, function (block) {
        // A grid reveals its own cells in sequence; revealing the grid as one
        // block would waste the only moment the layout has to explain itself.
        var grid = block.classList.contains('path-tiles') ||
                   block.classList.contains('cards') ||
                   block.classList.contains('credibility');

        if (grid && block.children.length > 1) {
          Array.prototype.forEach.call(block.children, function (cell, i) {
            cell.style.setProperty('--reveal-i', String(i));
            targets.push(cell);
          });
        } else {
          targets.push(block);
        }
      });
    });

    // Anything already on screen when the page loads is left completely
    // alone. Hiding it to fade it in would delay the first read for no gain,
    // and on interior pages — whose first section is a .page-header, not a
    // .hero — that meant the headline and opening paragraph started
    // invisible. Only content below the fold is ever animated.
    var fold = window.innerHeight * 0.9;
    targets = targets.filter(function (el) {
      return el.getBoundingClientRect().top > fold;
    });

    if (!targets.length) return;

    // Only now is anything hidden, and only because we know we can reveal it.
    doc.classList.add('js-anim');
    targets.forEach(function (el) { el.setAttribute('data-reveal', ''); });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target); // once only
      });
    }, {
      // Start the reveal slightly before the element reaches the viewport, so
      // it has finished by the time it is properly in view rather than
      // animating under the reader's eye.
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.01
    });

    targets.forEach(function (el) { observer.observe(el); });

    // Safety net. If anything above is wrong, or the observer never fires for
    // an element already on screen, reveal everything rather than leave the
    // page blank.
    window.setTimeout(function () {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
    }, 3000);
  }

  /* ---- Header shadow on scroll ------------------------------------------ */

  function setupHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;

    var ticking = false;

    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  function init() {
    try { setupReveal(); } catch (e) { doc.classList.remove('js-anim'); }
    try { setupHeader(); } catch (e) { /* decoration only */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
