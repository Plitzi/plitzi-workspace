import type { E2ePoint, E2eStep } from '@plitzi/sdk-shared';

// The canvas is an iframe: its nodes are not instances of this window's `Element`, so they are told by their node type.
const isElement = (target: EventTarget | null): target is Element =>
  target !== null && 'nodeType' in target && target.nodeType === Node.ELEMENT_NODE;

/** The element of the space an event happened in, the closest one that carries its id. */
const spaceElementOf = (event: Event): Element | undefined =>
  isElement(event.target) ? (event.target.closest('[data-plitzi-el]') ?? undefined) : undefined;

/**
 * The element a visitor's event is about, as a step names it: its id — and, for one a list draws more than once, which
 * copy (`row:3`, from one). None for an event on nothing of the space's.
 */
export const targetOfEvent = (event: Event): string | undefined => {
  const node = spaceElementOf(event);
  const id = node?.getAttribute('data-plitzi-el');
  if (!node || !id) {
    return undefined;
  }

  const copies = [...node.ownerDocument.querySelectorAll(`[data-plitzi-el="${CSS.escape(id)}"]`)];

  return copies.length > 1 ? `${id}:${String(copies.indexOf(node) + 1)}` : id;
};

/** The words an element shows, as an expectation holds them: its text, its spaces as one, cut at 80. */
export const shownTextOf = (event: Event): string =>
  (spaceElementOf(event)?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);

/**
 * Where in its element a press on a canvas landed, in percent of the element's box: what a canvas draws — a quake on a
 * map — has no element of its own, and a press played on the centre would miss it. None for a press on anything else.
 */
const canvasPointOf = (event: Event): E2ePoint | undefined => {
  const node = spaceElementOf(event);
  if (!node || !isElement(event.target) || event.target.localName !== 'canvas' || !('clientX' in event)) {
    return undefined;
  }

  const box = node.getBoundingClientRect();
  const x: unknown = Reflect.get(event, 'clientX');
  const y: unknown = Reflect.get(event, 'clientY');
  if (typeof x !== 'number' || typeof y !== 'number' || box.width === 0 || box.height === 0) {
    return undefined;
  }

  const percent = (at: number, from: number, size: number): number =>
    Math.min(100, Math.max(0, Math.round(((at - from) / size) * 1000) / 10));

  return { x: percent(x, box.left, box.width), y: percent(y, box.top, box.height) };
};

/** The step a click is: a press — on a canvas, at the point it landed — or, while checking, what the element shows. */
export const clickStep = (event: Event, checking: boolean): E2eStep | undefined => {
  const element = targetOfEvent(event);
  if (element === undefined) {
    return undefined;
  }

  if (!checking) {
    const point = canvasPointOf(event);

    return { kind: 'click', element, ...(point ? { point } : {}) };
  }

  const text = shownTextOf(event);

  return text ? { kind: 'expectText', element, text } : { kind: 'expectShown', element };
};

// A box or a choice changes by the click that is already its step.
const TYPED_FIELDS = new Set(['textarea', 'input']);
const PRESSED_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color']);

/** The step a field changed is: what was typed in it. */
export const changeStep = (event: Event): E2eStep | undefined => {
  const element = targetOfEvent(event);
  const field = event.target;
  if (element === undefined || !isElement(field) || !TYPED_FIELDS.has(field.localName)) {
    return undefined;
  }

  const value: unknown = Reflect.get(field, 'value');
  if (typeof value !== 'string' || PRESSED_INPUTS.has(field.getAttribute('type') ?? 'text')) {
    return undefined;
  }

  return { kind: 'type', element, text: value };
};
