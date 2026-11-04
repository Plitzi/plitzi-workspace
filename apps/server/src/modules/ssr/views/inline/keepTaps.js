/*
 * A tap before React listens is kept, and made again once the page has hydrated: until the SDK's `render` call nothing
 * on the page answers one, and the page has painted by then — a visitor sees a button and taps it. React replays what
 * lands between its listening and its hydrating; what lands before, it never hears. Only a tap the browser did nothing
 * with by itself is made again: a link followed, a field focused, a box ticked already happened, and once more would
 * undo or repeat it. A form sent is held instead — sent by the browser itself, it posted what was typed, a password
 * included, to the page's own address — and sent again, through the page, once it has hydrated. And what was typed or
 * ticked is put back: hydrating, React sets every field it controls to its state, which starts empty, and the visitor's
 * text was gone.
 *
 * Inlined in the page's module script (`template.ejs`), whose `render` call is preceded by `__plitziListening()`.
 */
const __plitziTyped = new Map();
const __plitziKeepTyped = event => {
  const field = event.target;
  if (
    event.isTrusted &&
    (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)
  ) {
    __plitziTyped.set(
      field,
      field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')
        ? { checked: field.checked }
        : { value: field.value }
    );
  }
};
document.addEventListener('input', __plitziKeepTyped, true);
document.addEventListener('change', __plitziKeepTyped, true);
const __plitziTaps = [];
const __plitziSends = [];
const __plitziHoldSend = event => {
  if (event.isTrusted && event.target instanceof HTMLFormElement) {
    event.preventDefault();
    __plitziSends.push({ form: event.target, submitter: event.submitter });
  }
};
document.addEventListener('submit', __plitziHoldSend, true);
const __plitziKeepTap = event => {
  if (event.isTrusted && event.target instanceof Element) {
    __plitziTaps.push(event.target);
  }
};
document.addEventListener('click', __plitziKeepTap, true);
const __plitziActedAlone = target => {
  const native = target.closest('a[href], input, select, textarea, label, summary, [contenteditable], button');

  return (
    native !== null && !(native instanceof HTMLButtonElement && (native.type === 'button' || native.form === null))
  );
};
const __plitziListening = () => {
  document.removeEventListener('click', __plitziKeepTap, true);
  document.removeEventListener('submit', __plitziHoldSend, true);
  document.removeEventListener('input', __plitziKeepTyped, true);
  document.removeEventListener('change', __plitziKeepTyped, true);
  const root = document.getElementById('plitzi');
  if ((__plitziTaps.length === 0 && __plitziSends.length === 0 && __plitziTyped.size === 0) || !root) {
    return;
  }

  const tapAgain = () => {
    // Told to React even when the field still shows it: React hydrating takes what the field shows as the value it
    // knows, while its state is empty, and an event on a value it knows is no change. So the field is set to
    // something else through React's own tracker first, then to the visitor's through the element's setter, which
    // the tracker does not see — and the event is then the change it is.
    for (const [field, kept] of __plitziTyped) {
      if (!field.isConnected) {
        continue;
      }

      if ('checked' in kept) {
        field.checked = !kept.checked;
        field.click();
      } else {
        field.value = kept.value === '' ? ' ' : '';
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set?.call(field, kept.value);
        field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
      }
    }

    __plitziTyped.clear();
    for (const target of __plitziTaps.splice(0)) {
      if (target.isConnected && !__plitziActedAlone(target)) {
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
      }
    }

    for (const { form, submitter } of __plitziSends.splice(0)) {
      if (form.isConnected) {
        form.requestSubmit(submitter?.isConnected && submitter.form === form ? submitter : undefined);
      }
    }
  };
  // A frame after the page says it hydrated: the effects of that commit, which wire the flows, have run by then.
  const later = () => requestAnimationFrame(() => setTimeout(tapAgain));
  const hydrated = () => root.querySelector('[data-hydrated]') !== null;
  if (hydrated()) {
    later();

    return;
  }

  const watch = new MutationObserver(() => {
    if (hydrated()) {
      watch.disconnect();
      later();
    }
  });
  watch.observe(root, { attributes: true, attributeFilter: ['data-hydrated'], subtree: true });
};
