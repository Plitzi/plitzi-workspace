/**
 * The tab the address names (`#domains`, a tab's `hash`), opened as the page is parsed — run by the page before it
 * paints (`usePrePaint`), because the server never sees the hash and draws a page's tabs on their first. It sets the
 * tabs' attributes and their panels' as the tabs would draw them, and the container hydrates on the tab the document
 * shows (`TabContainer`'s first state), so React finds what it would have drawn.
 *
 * Its source is what the page runs: it reads the document and the window alone, closes over nothing and declares no
 * function inside it.
 */
export const openTabFromHash = (): void => {
  let name = '';
  try {
    name = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return;
  }

  if (!name) {
    return;
  }

  for (const tab of document.querySelectorAll('[role="tab"][data-tab-hash]')) {
    if (
      tab.getAttribute('data-tab-hash') !== name ||
      tab.getAttribute('aria-selected') === 'true' ||
      !tab.parentElement
    ) {
      continue;
    }

    for (const other of tab.parentElement.querySelectorAll(':scope > [role="tab"]')) {
      const on = other === tab;
      other.setAttribute('aria-selected', String(on));
      other.setAttribute('tabindex', on ? '0' : '-1');
      other.classList.toggle('active', on);
      const panel = document.getElementById(other.getAttribute('aria-controls') ?? '');
      if (panel) {
        panel.hidden = !on;
        panel.classList.toggle('active', on);
      }
    }
  }
};
