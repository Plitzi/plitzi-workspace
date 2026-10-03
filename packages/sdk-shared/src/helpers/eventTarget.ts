/**
 * An event's target read as a DOM node. `instanceof Node` answers false for a target inside an iframe — each window has
 * its own `Node` — and the builder listens on its canvas iframe's document, so these test the node's own type instead.
 */
export const isNodeTarget = (target: EventTarget | null): target is Node =>
  target !== null && 'nodeType' in target && typeof target.nodeType === 'number';

/** An event's target as the node it is, for `contains`; null when it is not a node (a window, an XHR). */
export const nodeOf = (target: EventTarget | null): Node | null => (isNodeTarget(target) ? target : null);

export const isElementTarget = (target: EventTarget | null): target is Element =>
  isNodeTarget(target) && target.nodeType === Node.ELEMENT_NODE;

/** An event's target as the element it is, for `closest`; null when it is a text node or no node at all. */
export const elementOf = (target: EventTarget | null): Element | null => (isElementTarget(target) ? target : null);
