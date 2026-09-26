import { pressShortcut } from '@plitzi/sdk-authoring';

import { describeTarget, expect, test } from '../../fixtures';

import type { Page } from '@playwright/test';

/** Pizarra's README makes two promises this checks: a board opens and keeps what is drawn on it, and a big board stays
 *  cheap to look at and work on.
 *
 *  The second is not checked in milliseconds — a timing is the machine's, and a suite that fails on a slow runner
 *  says nothing. It is checked in WORK: how often the whole board is painted again, how much is drawn while a drag
 *  goes on, what the minimap does while nothing changes. Each number is what the canvas was rebuilt to do (see the
 *  README's Performance section and `yarn bench` in the example), so a change that quietly undoes one of those fails
 *  here on any hardware. */

type Counts = { full: number; partial: number; strokes: number; fills: number; offscreen: number };

declare global {
  interface Window {
    /** Canvas work since the last `takeCounts`, recorded by the init script below. */
    canvasCounts?: Counts;
  }
}

const ELEMENTS = 700;

const action = async (origin: string, actionId: string, input: Record<string, unknown>): Promise<unknown> => {
  const response = await fetch(new URL('/_action', origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId, input })
  });
  const body = (await response.json()) as { status?: string; output?: unknown; error?: string };
  if (body.status === 'failed') {
    throw new Error(`${actionId}: ${body.error ?? 'failed'}`);
  }

  return body.output;
};

/** A board of `count` boxes on a grid, committed the way a page commits — through `board-apply`. */
const seedBoard = async (origin: string, count: number): Promise<string> => {
  const created = (await action(origin, 'board-create', { title: `e2e — ${count} boxes`, template: 'blank' })) as {
    id: string;
    owner: string;
  };
  const boxes = Array.from({ length: count }, (_, index) => ({
    id: `e2ebox${String(index).padStart(6, '0')}`,
    type: 'rectangle',
    x: (index % 35) * 90,
    y: Math.floor(index / 35) * 90,
    width: 60,
    height: 60,
    stroke: 'ink',
    fill: 'blue',
    strokeWidth: 2,
    seed: index + 1,
    z: index + 1,
    version: 1,
    nonce: index + 1,
    deleted: false
  }));
  for (let from = 0; from < boxes.length; from += 500) {
    await action(origin, 'board-apply', {
      board: created.id,
      ops: boxes.slice(from, from + 500),
      key: '',
      owner: created.owner
    });
  }

  return created.id;
};

type Saved = { id: string; type: string; x: number; deleted?: boolean };

const savedElements = async (origin: string, board: string): Promise<Saved[]> => {
  const response = await fetch(new URL(`/_rsc?location=/b/${board}&ids=board`, origin));
  const body = (await response.json()) as { serverData: { board: { elements: Saved[] } } };

  return body.serverData.board.elements.filter(element => !element.deleted);
};

/** Counts what the canvases do: the board's canvas painted whole or a strip of it, strokes drawn, fills on the other
 *  canvases on the page (the one over the board, the minimap), and work on canvases that are not on the page — the
 *  minimap's shapes and a drag's picture. */
const countCanvasWork = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const counts: Counts = { full: 0, partial: 0, strokes: 0, fills: 0, offscreen: 0 };
    window.canvasCounts = counts;
    const prototype = CanvasRenderingContext2D.prototype;
    // Kept unbound on purpose: each is called again, below, on the context it was asked of.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const { fillRect, stroke } = prototype;
    // `stroke` is two signatures; each call below names the one it makes.
    const strokeCurrent: (this: CanvasRenderingContext2D) => void = stroke;
    const strokePath: (this: CanvasRenderingContext2D, path: Path2D) => void = stroke;
    prototype.fillRect = function (x: number, y: number, width: number, height: number) {
      const { canvas } = this;
      const across = width >= canvas.clientWidth;
      const down = height >= canvas.clientHeight;
      if (!canvas.isConnected) {
        counts.offscreen += 1;
      } else if (!canvas.classList.contains('board__canvas--board')) {
        counts.fills += 1;
      } else if (across && down) {
        counts.full += 1;
      } else if (across || down) {
        counts.partial += 1;
      }

      fillRect.call(this, x, y, width, height);
    };
    prototype.stroke = function (path?: Path2D) {
      if (this.canvas.isConnected) {
        counts.strokes += 1;
      } else {
        counts.offscreen += 1;
      }

      if (path) {
        strokePath.call(this, path);
      } else {
        strokeCurrent.call(this);
      }
    };
  });
};

const takeCounts = (page: Page): Promise<Counts> =>
  page.evaluate(() => {
    const counts = window.canvasCounts ?? { full: 0, partial: 0, strokes: 0, fills: 0, offscreen: 0 };
    const taken = { ...counts };
    Object.assign(counts, { full: 0, partial: 0, strokes: 0, fills: 0, offscreen: 0 });

    return taken;
  });

const board = (page: Page) => page.locator('canvas[aria-label^="Board"]');

/** The middle of the board canvas, where a pointer lands on it. */
const middle = async (page: Page): Promise<[number, number]> => {
  const box = await board(page).boundingBox();
  if (!box) {
    throw new Error('The board has no canvas');
  }

  return [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)];
};

const drag = async (
  page: Page,
  from: [number, number],
  to: [number, number],
  steps: number,
  between?: () => Promise<void>
) => {
  await page.mouse.move(...from);
  await page.mouse.down();
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(from[0] + ((to[0] - from[0]) * step) / steps, from[1] + ((to[1] - from[1]) * step) / steps);
    await page.waitForTimeout(16);
    if (step === 3) {
      await between?.();
    }
  }

  await page.mouse.up();
};

describeTarget('whiteboard', subject => {
  test('a new board keeps what is drawn on it', async ({ page }) => {
    await page.goto(subject.origin);
    await page.locator('[data-plitzi-el="new-board"]').click();
    await page.waitForURL(/\/b\//);
    await expect(board(page)).toBeVisible();
    const id = new URL(page.url()).pathname.split('/b/')[1];

    const [x, y] = await middle(page);
    await page.keyboard.press('r');
    await drag(page, [x - 60, y - 40], [x + 60, y + 40], 6);

    await expect
      .poll(async () => (await savedElements(subject.origin, id)).map(element => element.type))
      .toEqual(['rectangle']);
  });

  test.describe('a board of 700 elements', () => {
    let id = '';

    test.beforeAll(async () => {
      id = await seedBoard(subject.origin, ELEMENTS);
    });

    test.beforeEach(async ({ page }) => {
      await countCanvasWork(page);
      await page.goto(`${subject.origin}/b/${id}`);
      await expect(board(page)).toBeVisible();
      await page.waitForTimeout(1500);
      await takeCounts(page);
    });

    /** A pan moves the picture already painted and paints the edges it uncovers — the whole board is painted again
     *  once, when the view stops, not at every step. */
    test('a pan paints the edges it uncovers, not the board', async ({ page }) => {
      const [x, y] = await middle(page);
      await page.keyboard.press('h');
      await drag(page, [x, y], [x - 300, y - 180], 30);
      await page.waitForTimeout(400);
      const counts = await takeCounts(page);

      expect(counts.partial).toBeGreaterThan(10);
      expect(counts.full).toBeLessThanOrEqual(2);
    });

    /** Something added, or changed somewhere, repaints where it is — not everything under it. */
    test('a note put down does not paint the board again', async ({ page }) => {
      const [x, y] = await middle(page);
      await page.keyboard.press('6');
      await page.mouse.click(x, y);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);

      expect((await takeCounts(page)).full).toBe(0);
    });

    /** What is picked up is drawn once and copied into place at every step after. Drawing it again at every step was
     *  seven hundred shapes a pointer move. */
    test('dragging everything draws it once, not at every step', async ({ page }) => {
      const [x, y] = await middle(page);
      // The board takes the keys once it has been pointed at, as it has by anyone about to press them.
      await page.mouse.click(x, y);
      await page.keyboard.press('v');
      await pressShortcut(page, 'mod+a');
      await page.waitForTimeout(300);
      // A point on a box: where the pointer turns into the hand that moves it.
      let at: [number, number] | undefined;
      for (let dy = -60; dy <= 60 && !at; dy += 6) {
        for (let dx = -60; dx <= 60 && !at; dx += 6) {
          await page.mouse.move(x + dx, y + dy);
          if ((await board(page).evaluate(canvas => canvas.style.cursor)) === 'move') {
            at = [x + dx, y + dy];
          }
        }
      }

      expect(at, 'a box under the pointer to drag').toBeDefined();
      await drag(page, at ?? [x, y], [(at ?? [x, y])[0] + 200, (at ?? [x, y])[1] + 120], 24, async () => {
        await takeCounts(page);
      });
      const during = await takeCounts(page);
      // Everything went: the first box is no longer where it was seeded.
      await expect
        .poll(async () => (await savedElements(subject.origin, id)).find(element => element.id === 'e2ebox000000')?.x)
        .not.toBe(0);

      // Twenty steps after the drag began. The picture is drawn once — about two strokes a box, whenever its first frame
      // lands — and copied after that; drawn at every step it was thirty thousand.
      expect(during.strokes).toBeLessThan(ELEMENTS * 4);
    });

    /** Nothing changing is nothing drawn: the minimap's shapes and the board stay as they are while a pointer moves
     *  over it. */
    test('moving the pointer over a still board repaints nothing of it', async ({ page }) => {
      await page.keyboard.press('v');
      const [x, y] = await middle(page);
      for (let step = 0; step < 20; step += 1) {
        await page.mouse.move(x - 200 + step * 20, y + 150);
        await page.waitForTimeout(16);
      }

      const counts = await takeCounts(page);

      expect(counts.full).toBe(0);
      expect(counts.offscreen).toBe(0);
      // The minimap draws where the view is, not every element again: a handful of fills a frame, not seven hundred.
      expect(counts.fills).toBeLessThan(ELEMENTS);
    });
  });
});
