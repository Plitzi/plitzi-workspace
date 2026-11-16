/*
 * A tab the address names (`#domains`, a tab's `hash`), opened as soon as the page is parsed: the server never sees the
 * hash, so it draws a page's tabs on their first, and the page painted it until React hydrated — a flash of the wrong
 * tab on every load of a link to another. The tab's own attributes and its panel's are set as React would draw them,
 * and the container hydrates on the tab the document shows (sdk-elements' `TabContainer`), so nothing mismatches.
 */
(() => {
  let name = '';
  try {
    name = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }

  if (!name) {
    return;
  }

  const root = document.getElementById('plitzi');
  for (const tab of root.querySelectorAll('[role="tab"][data-tab-hash]')) {
    if (tab.getAttribute('data-tab-hash') !== name || tab.getAttribute('aria-selected') === 'true') {
      continue;
    }

    for (const other of tab.parentElement.querySelectorAll(':scope > [role="tab"]')) {
      const on = other === tab;
      other.setAttribute('aria-selected', String(on));
      other.setAttribute('tabindex', on ? '0' : '-1');
      other.classList.toggle('active', on);
      const panel = document.getElementById(other.getAttribute('aria-controls'));
      if (panel) {
        panel.hidden = !on;
        panel.classList.toggle('active', on);
      }
    }
  }
})();
