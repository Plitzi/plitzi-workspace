/*
 * An arrival that waits to be seen (`motion: { on: 'view' }`) is held at its start until the SDK sees it — after its
 * scripts, the space and hydration. One on screen as the page arrives would be content nobody can see until then: seen
 * here instead, as soon as it is parsed. Named by where it is rather than by `data-id`, which every instance of a
 * component shares; and in a sheet of its own rather than the element's `data-motion-seen`, which React would hydrate
 * as markup the server never drew. The sheet goes once the SDK has seen what it showed.
 */
(() => {
  const root = document.getElementById('plitzi');
  const held = root.querySelectorAll('[data-motion-on="view"]:not([data-motion-seen])');
  if (held.length === 0 || typeof IntersectionObserver !== 'function') {
    return;
  }

  const sheet = document.head.appendChild(document.createElement('style'));
  const shown = [];
  const pathOf = element => {
    const steps = [];
    for (let node = element; node !== root; node = node.parentElement) {
      steps.unshift(`:nth-child(${[...node.parentElement.children].indexOf(node) + 1})`);
    }

    return `#plitzi > ${steps.join(' > ')}:not([data-motion-seen])`;
  };
  const seen = new IntersectionObserver(entries => {
    for (const { isIntersecting, target } of entries) {
      if (isIntersecting) {
        seen.unobserve(target);
        shown.push(target);
        const at = pathOf(target);
        sheet.append(
          `${at}[data-motion-enter], ${at}[data-motion-stagger] > * { animation-play-state: running, paused; }\n`
        );
      }
    }
  });
  held.forEach(element => seen.observe(element));
  const offScreen = element => {
    const { top, bottom } = element.getBoundingClientRect();

    return bottom <= 0 || top >= innerHeight;
  };
  const live = new MutationObserver(() => {
    if (!root.querySelector('[data-hydrated]')) {
      return;
    }

    seen.disconnect();
    if (
      shown.every(element => !element.isConnected || element.hasAttribute('data-motion-seen') || offScreen(element))
    ) {
      sheet.remove();
      live.disconnect();
    }
  });
  live.observe(root, { attributes: true, subtree: true, attributeFilter: ['data-hydrated', 'data-motion-seen'] });
})();
