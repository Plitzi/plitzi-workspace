import { reveal } from './reveal';

import type { E2eElement, E2eLocator, E2ePage } from '@plitzi/sdk-authoring';

/**
 * The builder's canvas as the page an e2e test is played on: the same runner as the CLI's and the server's —
 * `runE2eTest`, given this instead of Playwright's page — pressing the elements the SDK draws in the canvas' iframe. A
 * press waits as Playwright's does, and says why it could not happen in the words of Playwright's own log, so the runner
 * reads a failure the same way whichever page played it.
 *
 * The canvas is the editor's own page, not a browser of its own: what needs one — reloading, a held clock, the space's
 * actions answered by the test — is the server's run's, and said so.
 */

export type CanvasPageOptions = {
  iframe: HTMLIFrameElement;
  /** Opens a path of the space in the canvas, as a link in it does. */
  navigate: (path: string) => void;
  back: () => void;
  /** The canvas drawn at a width: the builder's device. */
  resize: (width: number) => void;
  scheme: (scheme: 'light' | 'dark') => void;
};

/** What only a browser of its own plays: the canvas cannot. */
export const playedOnServer = (what: string): Error =>
  new Error(`${what} needs a browser of its own: press "Run on the server" to play this test`);

const POLL_MS = 50;

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** An element as Playwright's log names one: its tag, and the mark of the space's element it is. */
const named = (node: Element): string => {
  const id = node.closest('[data-plitzi-el]')?.getAttribute('data-plitzi-el');

  return `<${node.localName}${id ? ` data-plitzi-el="${id}"` : ''}>`;
};

const center = (node: Element): { x: number; y: number } => {
  const box = node.getBoundingClientRect();

  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

/** Why a press cannot reach the element now, as Playwright's log says it — or nothing, when it can. */
const blocked = (node: Element): string | undefined => {
  if (!node.isConnected) {
    return 'element is not attached to the DOM';
  }

  const box = node.getBoundingClientRect();
  if (
    box.width === 0 ||
    box.height === 0 ||
    !node.checkVisibility({ opacityProperty: true, visibilityProperty: true })
  ) {
    return 'element is not visible';
  }

  if (Reflect.get(node, 'disabled') === true || node.closest('fieldset[disabled]') !== null) {
    return 'element is not enabled';
  }

  // In view before it is pressed, as a pointer would find it — within the page alone, the editor around it left still.
  reveal(node, 'instant');
  const { x, y } = center(node);
  const hit = node.ownerDocument.elementFromPoint(x, y);
  if (hit && hit !== node && !node.contains(hit)) {
    return `${named(hit)} intercepts pointer events`;
  }

  return undefined;
};

const pointer = (type: string, view: Window, x: number, y: number): PointerEvent =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    view,
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true
  });

const mouse = (type: string, view: Window, x: number, y: number): MouseEvent =>
  new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view, clientX: x, clientY: y, button: 0 });

const callMethod = (node: Element, method: string, args: unknown[] = []): void => {
  const fn: unknown = Reflect.get(node, method);
  if (typeof fn === 'function') {
    Reflect.apply(fn, node, args);
  }
};

/** Writes a field's value as typing does: through its own setter, which React's value tracking listens to. */
const writeValue = (node: Element, text: string): boolean => {
  const editable = node.getAttribute('contenteditable');
  if (editable !== null && editable !== 'false') {
    node.textContent = text;

    return true;
  }

  // The prototype's setter, not the node's own: React keeps the last value it saw on the node, and a value written past
  // it is what it takes for an edit.
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), 'value');
  const setter: unknown = descriptor ? Reflect.get(descriptor, 'set') : undefined;
  if (typeof setter !== 'function') {
    return false;
  }

  Reflect.apply(setter, node, [text]);

  return true;
};

/** The value of a select's option named by its value or its label — as a browser driver chooses one — or none. */
const optionValue = (node: Element, wanted: string): string | undefined => {
  const options = [...node.querySelectorAll('option')];

  return (options.find(option => option.value === wanted) ?? options.find(option => option.label === wanted))?.value;
};

export const createCanvasPage = ({ iframe, navigate, back, resize, scheme }: CanvasPageOptions): E2ePage => {
  const view = (): Window => {
    const window = iframe.contentWindow;
    if (!window) {
      throw new Error('the canvas is not drawn');
    }

    return window;
  };
  const doc = (): Document => view().document;
  let pointerAt = { x: 0, y: 0 };

  /** Waits for the element to take a press, then makes it — or throws what it waited on, as Playwright does. */
  const pressed = async (
    action: string,
    pick: () => Element | undefined,
    timeout: number,
    press: (node: Element) => void
  ): Promise<void> => {
    const until = Date.now() + timeout;
    let why = 'waiting for the element';
    for (;;) {
      const node = pick();
      const reason = node ? blocked(node) : 'waiting for the element';
      if (node && reason === undefined) {
        press(node);

        return;
      }

      why = reason ?? why;
      if (Date.now() >= until) {
        throw new Error(`locator.${action}: Timeout ${String(timeout)}ms exceeded.\n  - ${why}`);
      }

      await wait(POLL_MS);
    }
  };

  const click = (node: Element): void => {
    const { x, y } = center(node);
    const window = view();
    pointerAt = { x, y };
    node.dispatchEvent(pointer('pointerdown', window, x, y));
    node.dispatchEvent(mouse('mousedown', window, x, y));
    callMethod(node, 'focus');
    node.dispatchEvent(pointer('pointerup', window, x, y));
    node.dispatchEvent(mouse('mouseup', window, x, y));
    // The element's own click: the one that also does what a click does by default — follows a link, ticks a box,
    // submits its form.
    callMethod(node, 'click');
  };

  const hover = (node: Element): void => {
    const { x, y } = center(node);
    const window = view();
    pointerAt = { x, y };
    for (const type of ['pointerover', 'pointerenter', 'pointermove']) {
      node.dispatchEvent(pointer(type, window, x, y));
    }

    for (const type of ['mouseover', 'mouseenter', 'mousemove']) {
      node.dispatchEvent(mouse(type, window, x, y));
    }
  };

  const element = (pick: () => Element | undefined): E2eElement => ({
    count: () => Promise.resolve(pick() ? 1 : 0),
    click: ({ timeout }) => pressed('click', pick, timeout, click),
    hover: ({ timeout }) => pressed('hover', pick, timeout, hover),
    fill: (text, { timeout }) =>
      pressed('fill', pick, timeout, node => {
        callMethod(node, 'focus');
        if (!writeValue(node, text)) {
          throw new Error('locator.fill: Error: Element is not an <input>, <textarea> or <select> element');
        }

        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
      }),
    selectOption: (wanted, { timeout }) =>
      pressed('selectOption', pick, timeout, node => {
        const value = node.localName === 'select' ? optionValue(node, wanted) : undefined;
        if (value === undefined) {
          throw new Error(
            node.localName === 'select'
              ? `locator.selectOption: Error: no option of the select is "${wanted}"`
              : 'locator.selectOption: Error: Element is not a <select> element'
          );
        }

        writeValue(node, value);
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
      }),
    boundingBox: () => {
      const node = pick();
      if (!node) {
        return Promise.resolve(null);
      }

      const box = node.getBoundingClientRect();

      return Promise.resolve(
        box.width === 0 && box.height === 0 ? null : { x: box.left, y: box.top, width: box.width, height: box.height }
      );
    }
  });

  const locator = (selector: string): E2eLocator => {
    const all = (): Element[] => [...doc().querySelectorAll(selector)];

    return {
      ...element(() => all().at(0)),
      count: () => Promise.resolve(all().length),
      first: () => element(() => all().at(0)),
      last: () => element(() => all().at(-1)),
      nth: (index: number) => element(() => all().at(index))
    };
  };

  const at = (x: number, y: number): Element => doc().elementFromPoint(x, y) ?? doc().body;

  const waitForSelector = async (selector: string, { timeout = 30_000 }: { timeout?: number } = {}) => {
    const until = Date.now() + timeout;
    for (;;) {
      const found = iframe.contentDocument?.querySelector(selector);
      if (found) {
        return found;
      }

      if (Date.now() >= until) {
        throw new Error(`page.waitForSelector: Timeout ${String(timeout)}ms exceeded waiting for ${selector}`);
      }

      await wait(POLL_MS);
    }
  };

  return {
    goto: async url => {
      const { pathname, search } = new URL(url);
      navigate(`${pathname}${search}`);
      await wait(POLL_MS);
      await waitForSelector('[data-plitzi-el]', { timeout: 10_000 });

      return true;
    },
    // The canvas asks nothing a page would wait for: the editor's own requests are not the page's.
    on: () => undefined,
    off: () => undefined,
    waitForTimeout: wait,
    route: () => Promise.reject(playedOnServer("Answering the space's actions")),
    setViewportSize: ({ width }) => {
      resize(width);

      return Promise.resolve();
    },
    emulateMedia: ({ colorScheme }) => {
      scheme(colorScheme);

      return Promise.resolve();
    },
    waitForSelector,
    locator,
    evaluate: async <R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R> => {
      // Made again in the canvas' own window, as a browser driver sends it: what it reads — `document`, `innerHeight`,
      // `getComputedStyle` — is the canvas', not the editor's around it.
      const evalIn: unknown = Reflect.get(view(), 'eval');
      const made: unknown = typeof evalIn === 'function' ? Reflect.apply(evalIn, view(), [`(${fn.toString()})`]) : fn;
      if (typeof made !== 'function') {
        throw new Error('the canvas could not run a step of the test');
      }

      // `made` is `fn` itself, re-made from its own source in the canvas' window: it answers what `fn` answers.
      return (await Reflect.apply(made, undefined, [arg])) as R;
    },
    keyboard: {
      press: key => {
        const document = doc();
        const target = document.activeElement ?? document.body;
        const parts = key.split('+');
        const main = parts.at(-1) ?? key;
        const init = {
          key: main,
          bubbles: true,
          cancelable: true,
          composed: true,
          ctrlKey: parts.includes('Control'),
          metaKey: parts.includes('Meta'),
          shiftKey: parts.includes('Shift'),
          altKey: parts.includes('Alt')
        };
        const allowed = target.dispatchEvent(new KeyboardEvent('keydown', init));
        target.dispatchEvent(new KeyboardEvent('keyup', init));
        // What Enter does by default in a field of a form, which an event made by a page does not do by itself.
        const form = target.closest('form');
        if (allowed && main === 'Enter' && form && target.localName === 'input') {
          callMethod(form, 'requestSubmit');
        }

        return Promise.resolve();
      }
    },
    mouse: {
      move: async (x, y, { steps = 1 } = {}) => {
        const from = pointerAt;
        for (let step = 1; step <= steps; step += 1) {
          const [nx, ny] = [from.x + ((x - from.x) * step) / steps, from.y + ((y - from.y) * step) / steps];
          const target = at(nx, ny);
          target.dispatchEvent(pointer('pointermove', view(), nx, ny));
          target.dispatchEvent(mouse('mousemove', view(), nx, ny));
          await wait(0);
        }

        pointerAt = { x, y };
      },
      down: () => {
        const target = at(pointerAt.x, pointerAt.y);
        target.dispatchEvent(pointer('pointerdown', view(), pointerAt.x, pointerAt.y));
        target.dispatchEvent(mouse('mousedown', view(), pointerAt.x, pointerAt.y));

        return Promise.resolve();
      },
      up: () => {
        const target = at(pointerAt.x, pointerAt.y);
        target.dispatchEvent(pointer('pointerup', view(), pointerAt.x, pointerAt.y));
        target.dispatchEvent(mouse('mouseup', view(), pointerAt.x, pointerAt.y));

        return Promise.resolve();
      },
      wheel: (dx, dy) => {
        const target = at(pointerAt.x, pointerAt.y);
        const allowed = target.dispatchEvent(
          new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: dx, deltaY: dy })
        );
        if (allowed) {
          let scroller: Element | null = target;
          while (
            scroller &&
            scroller.scrollHeight <= scroller.clientHeight &&
            scroller.scrollWidth <= scroller.clientWidth
          ) {
            scroller = scroller.parentElement;
          }

          if (scroller && scroller !== doc().documentElement) {
            scroller.scrollBy(dx, dy);
          } else {
            view().scrollBy(dx, dy);
          }
        }

        return Promise.resolve();
      }
    },
    goBack: async () => {
      back();
      await wait(POLL_MS);
      await waitForSelector('[data-plitzi-el]', { timeout: 10_000 });

      return true;
    },
    reload: () => Promise.reject(playedOnServer('Reloading the page')),
    clock: {
      install: () => Promise.reject(playedOnServer("Holding the page's clock")),
      runFor: () => Promise.reject(playedOnServer("Moving the page's clock"))
    }
  };
};
