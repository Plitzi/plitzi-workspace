import { processContainer } from '@pmodules/Builder/components/BuilderOverlay/BuilderOverlayHelper';

import type { SubscriptionCollaboratorElement, SubscriptionCollaboratorElementState } from '@plitzi/sdk-shared';

/**
 * The coordinate protocol between collaborators, both ends of it in one place.
 *
 * A pointer cannot travel as a coordinate. Peers differ in window size, zoom level and scroll offset, and the
 * canvas lays the page out at whatever width it is given — a zoomed builder lays it out narrower — so the same
 * pixel, and the same fraction of the viewport, is a different place on each screen. It travels anchored to an
 * element instead: a ratio inside the box of the element nearest the pointer, plus a pixel delta when the
 * pointer is outside that box. The receiver resolves the anchor against its own DOM, in the same canvas space
 * the overlays use, so a collaborator's cursor and their selection box can never disagree.
 */

export type CollaboratorCursorAnchor = { anchorId: string; x: number; y: number; dx: number; dy: number };

export type CollaboratorCursorPosition = { x: number; y: number };

export type CollaboratorCursorContext = {
  rootId: string;
  containerDOM?: HTMLElement | null;
  iframeDOM?: HTMLIFrameElement | null;
  zoom?: number;
};

// A candidate has to beat the anchor in use by this many pixels to replace it. Without the margin the anchor
// ping-pongs while the pointer sits on a boundary, and every switch is a chance to land somewhere slightly
// different on the peer.
const ANCHOR_HYSTERESIS = 8;

/** The element pair both ends agree on: the sender picks anchors with it, the receiver looks them up with it. */
const collaboratorAnchorSelector = (rootId: string) => `.plitzi-component[data-id][data-root-id="${rootId}"]`;

const distanceToRect = (rect: DOMRect, x: number, y: number) =>
  Math.hypot(Math.max(rect.left - x, 0, x - rect.right), Math.max(rect.top - y, 0, y - rect.bottom));

// The elements matching `selector` that no other match separates from `element` — its component layer, which is
// not its DOM children: components are usually wrapped in plain markup.
const layerChildren = (element: HTMLElement, selector: string) => {
  const children: HTMLElement[] = [];
  const pending = Array.from(element.children) as HTMLElement[];

  while (pending.length) {
    const node = pending.pop() as HTMLElement;
    if (node.matches(selector)) {
      children.push(node);

      continue;
    }

    pending.push(...(Array.from(node.children) as HTMLElement[]));
  }

  return children;
};

// Walks down to the smallest element around the pointer. A big container is what makes a cursor jump: a ratio
// inside a 1200px box lands hundreds of pixels away on a peer that lays the page out at another width.
const resolveAnchor = (start: HTMLElement, selector: string, x: number, y: number) => {
  let anchor = start;

  for (;;) {
    let nearest: HTMLElement | undefined = undefined;
    let nearestDistance = Infinity;

    for (const child of layerChildren(anchor, selector)) {
      const rect = child.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        continue;
      }

      const distance = distanceToRect(rect, x, y);
      if (distance < nearestDistance) {
        nearest = child;
        nearestDistance = distance;
      }
    }

    if (!nearest) {
      return anchor;
    }

    anchor = nearest;
  }
};

// Drilling into a descendant always wins (the pointer entered it); anything else has to clear the hysteresis
// margin, so leaving an element keeps measuring from it instead of falling back to its container.
const preferPreviousAnchor = (
  anchor: HTMLElement,
  previous: HTMLElement | null | undefined,
  selector: string,
  x: number,
  y: number
) => {
  // `matches` also drops an anchor left over from another root: the selector carries the root being edited.
  if (!previous || previous === anchor || !previous.isConnected || !previous.matches(selector)) {
    return anchor;
  }

  if (previous.contains(anchor)) {
    return anchor;
  }

  const previousDistance = distanceToRect(previous.getBoundingClientRect(), x, y);
  const distance = distanceToRect(anchor.getBoundingClientRect(), x, y);

  return previousDistance <= distance + ANCHOR_HYSTERESIS ? previous : anchor;
};

/**
 * Sender: turns a pointer event into the anchored position to broadcast. Returns the chosen anchor too, so the
 * caller can feed it back as `previous` and keep the choice stable between frames.
 */
const readCursorAnchor = (
  event: PointerEvent,
  { selector, previous, scale = 1 }: { selector: string; previous?: HTMLElement | null; scale?: number }
) => {
  const start = (event.target as HTMLElement | null)?.closest<HTMLElement>(selector);

  // Nothing anchorable under the pointer (the overlay chrome): the frame is dropped, and holding the last valid
  // spot on the peer beats jumping to a position no shared coordinate system can express.
  if (!start) {
    return undefined;
  }

  const anchorDOM = preferPreviousAnchor(
    resolveAnchor(start, selector, event.clientX, event.clientY),
    previous,
    selector,
    event.clientX,
    event.clientY
  );

  const anchorId = anchorDOM.dataset.id;
  const rect = anchorDOM.getBoundingClientRect();
  if (!anchorId || !rect.width || !rect.height) {
    return undefined;
  }

  // Inside the box the position travels as a ratio, so it follows the element when the peer sizes it
  // differently; outside it travels as pixels, because a gap is a gap and scaling it by a foreign box size is
  // what turns a few pixels of layout difference into a jump.
  const ratioX = (event.clientX - rect.left) / rect.width;
  const ratioY = (event.clientY - rect.top) / rect.height;
  const x = Math.min(Math.max(ratioX, 0), 1);
  const y = Math.min(Math.max(ratioY, 0), 1);

  const position: CollaboratorCursorAnchor = {
    anchorId,
    x,
    y,
    dx: ((ratioX - x) * rect.width) / scale,
    dy: ((ratioY - y) * rect.height) / scale
  };

  return { anchorDOM, position };
};

/**
 * Receiver: places an anchored position on this canvas, in unzoomed content pixels — the space `processContainer`
 * gives the overlays.
 */
const resolveCursorPosition = (
  { anchorId, x, y, dx = 0, dy = 0 }: Partial<CollaboratorCursorAnchor> & CollaboratorCursorPosition,
  { rootId, containerDOM, iframeDOM, zoom = 1 }: CollaboratorCursorContext
): CollaboratorCursorPosition | undefined => {
  if (!anchorId || !containerDOM) {
    return undefined;
  }

  const anchorDOM = containerDOM.querySelector<HTMLElement>(`[data-id="${anchorId}"][data-root-id="${rootId}"]`);
  if (!anchorDOM) {
    return undefined;
  }

  const box = processContainer(anchorDOM, iframeDOM, zoom);
  if (!box) {
    return undefined;
  }

  return { x: box.x + x * box.width + dx, y: box.y + y * box.height + dy };
};

const resolveElement = (element: SubscriptionCollaboratorElement | undefined, rootId: string) => {
  if (!element || !element.elementId || element.rootId !== rootId) {
    return undefined;
  }

  return element.elementId;
};

/** What the collaborator had hovered/selected when the snapshot was taken, kept only for the root being edited. */
const resolveElementState = (elementState: SubscriptionCollaboratorElementState | undefined, rootId: string) => ({
  hovered: resolveElement(elementState?.hovered, rootId),
  selected: resolveElement(elementState?.selected, rootId)
});

export { collaboratorAnchorSelector, readCursorAnchor, resolveCursorPosition, resolveElementState };
