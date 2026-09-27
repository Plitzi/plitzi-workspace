import { pressShortcut } from '@plitzi/sdk-authoring';

import { describeTarget, expect, test } from '../../fixtures';
import { agentAt } from '../../helpers/mcpAgent';

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

/**
 * What `/_realtime` answers a page asking for `topics` with `grants`: the topics it opened, or the refusal — read from
 * the stream's first event, and the stream let go of.
 */
const subscribe = async (
  origin: string,
  topics: string[],
  grants: string[] = []
): Promise<{ status: number; topics: string[]; refused: { topic: string; reason: string }[] }> => {
  const controller = new AbortController();
  const query = `topics=${encodeURIComponent(topics.join(','))}&grants=${encodeURIComponent(grants.join(','))}`;
  const response = await fetch(new URL(`/_realtime?${query}`, origin), {
    headers: { accept: 'text/event-stream' },
    signal: controller.signal
  });
  if (!response.ok) {
    const body = (await response.json()) as { refused?: { topic: string; reason: string }[] };

    return { status: response.status, topics: [], refused: body.refused ?? [] };
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while (reader && !text.includes('\n\n')) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    text += decoder.decode(value, { stream: true });
  }

  controller.abort();
  const data = text.split('\n').find(line => line.startsWith('data: '));
  const ready = JSON.parse(data?.slice(6) ?? '{}') as {
    topics?: string[];
    refused?: { topic: string; reason: string }[];
  };

  return { status: response.status, topics: ready.topics ?? [], refused: ready.refused ?? [] };
};

type Opened = { topic: string; grants: { board: string; room: string } };

/** An element as a page commits it, from its box and whatever else it says. */
const element = (
  index: number,
  fields: { type: string; x: number; y: number; width: number; height: number } & Record<string, unknown>
) => ({
  id: `e2ebox${String(index).padStart(6, '0')}`,
  stroke: 'ink',
  fill: 'blue',
  strokeWidth: 2,
  seed: index + 1,
  z: index + 1,
  version: 1,
  nonce: index + 1,
  deleted: false,
  ...fields
});

/** A blank board with `elements` on it, committed the way a page commits — through `board-apply`. */
const seedBoard = async (origin: string, title: string, elements: readonly object[]): Promise<string> => {
  const created = (await action(origin, 'board-create', { title, template: 'blank' })) as { id: string; owner: string };
  for (let from = 0; from < elements.length; from += 500) {
    await action(origin, 'board-apply', {
      board: created.id,
      ops: elements.slice(from, from + 500),
      key: '',
      owner: created.owner
    });
  }

  return created.id;
};

type Saved = {
  id: string;
  type: string;
  stroke?: string;
  x: number;
  y: number;
  height: number;
  text?: string;
  author?: string;
  description?: string;
  blockedBy?: string[];
  parent?: string;
  done?: boolean;
  completes?: boolean;
  deleted?: boolean;
};

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
      const boxes = Array.from({ length: ELEMENTS }, (_, index) =>
        element(index, {
          type: 'rectangle',
          x: (index % 35) * 90,
          y: Math.floor(index / 35) * 90,
          width: 60,
          height: 60
        })
      );
      id = await seedBoard(subject.origin, `e2e — ${ELEMENTS} boxes`, boxes);
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

  /** A card is a task on a kanban: the card tool makes one in a column, and out of one makes nothing. Opened, its
   *  description is written on it, and Tab goes between its title and its description. The board opens fitted, at
   *  most at its own size, so the column is in the middle of the canvas. */
  test('a card is made in a column, with its title and its description', async ({ page }) => {
    const column = element(0, { type: 'frame', layout: 'column', x: 0, y: 0, width: 300, height: 460, text: 'To do' });
    const id = await seedBoard(subject.origin, 'e2e — a column', [column]);
    await page.goto(`${subject.origin}/b/${id}`);
    await expect(board(page)).toBeVisible();
    const [x, y] = await middle(page);
    await page.mouse.move(x, y);
    await page.keyboard.press('c');
    await page.mouse.click(x + 400, y);
    await page.waitForTimeout(300);
    await page.mouse.click(x, y);
    await page.keyboard.type('Write the post');
    await page.keyboard.press('Tab');
    await page.keyboard.type('One page, with the demo at the top');
    await page.keyboard.press('Escape');

    await expect
      .poll(async () =>
        (await savedElements(subject.origin, id))
          .filter(saved => saved.type === 'card')
          .map(({ text, description, parent }) => ({ text, description, parent }))
      )
      .toEqual([{ text: 'Write the post', description: 'One page, with the demo at the top', parent: column.id }]);
  });

  /** What is dragged lines up with what stays still: an edge let go a few pixels off another lands on it — and with
   *  ⌘ / Ctrl held it lands where it was let go. */
  test('a shape dragged near an edge snaps to it, unless ⌘ is held', async ({ page }) => {
    const still = element(0, { type: 'rectangle', x: 0, y: 0, width: 100, height: 100 });
    const moved = element(1, { type: 'rectangle', x: 300, y: 40, width: 100, height: 100 });
    const id = await seedBoard(subject.origin, 'e2e — two boxes', [still, moved]);
    await page.goto(`${subject.origin}/b/${id}`);
    await expect(board(page)).toBeVisible();
    // Fitted at its own size around both: the moved box's middle is 150 right and 20 below the canvas's.
    const [x, y] = await middle(page);
    const yOf = async () => (await savedElements(subject.origin, id)).find(saved => saved.id === moved.id)?.y;

    // 37 up puts its top 3 below the other's: it lands level with it.
    await drag(page, [x + 150, y + 20], [x + 150, y - 17], 8);
    await expect.poll(yOf).toBe(0);

    await page.keyboard.down('ControlOrMeta');
    await drag(page, [x + 150, y], [x + 150, y + 3], 4);
    await page.keyboard.up('ControlOrMeta');
    await expect.poll(yOf).toBe(3);
  });

  /** Brought beside another, a shape stops at a gap from it — room to breathe, a column's spacing, or all but
   *  touching — whichever it comes nearest, on either side. */
  test('a shape brought beside another stops at a gap from it, far, near or all but touching', async ({ page }) => {
    const still = element(0, { type: 'rectangle', x: 0, y: 0, width: 100, height: 100 });
    const moved = element(1, { type: 'rectangle', x: 300, y: 0, width: 100, height: 100 });
    const id = await seedBoard(subject.origin, 'e2e — gaps', [still, moved]);
    await page.goto(`${subject.origin}/b/${id}`);
    await expect(board(page)).toBeVisible();
    // Fitted at its own size around both: the board's middle, (200, 50), is the canvas's.
    const [x, y] = await middle(page);
    const xOf = async () => (await savedElements(subject.origin, id)).find(saved => saved.id === moved.id)?.x;

    // 174 left puts it 26 from the other: it stops at 24.
    await drag(page, [x + 150, y], [x + 150 - 174, y], 8);
    await expect.poll(xOf).toBe(124);
    // 11 more puts it 13 away: it stops at 12, a column's spacing.
    await drag(page, [x - 26, y], [x - 37, y], 6);
    await expect.poll(xOf).toBe(112);
    // 9 more puts it 3 away: all but touching.
    await drag(page, [x - 38, y], [x - 47, y], 6);
    await expect.poll(xOf).toBe(102);
  });

  /** Said at the cursor with Enter, words are kept in the board's chat as well: whoever was not looking at the cursor
   *  reads them there, and so does an agent. */
  /**
   * A board's channels are private (`grant: true`): a page opens them with the grant the server answered when it let
   * that page in. A locked board's topic is no secret — its id and its password's version — so knowing it opens
   * nothing; its password does, and a new password shuts out whoever had the old one.
   */
  test('a locked board’s channels open with its password, and a new password shuts out the old one', async () => {
    const id = await seedBoard(subject.origin, 'e2e — private channels', []);
    const open = (await action(subject.origin, 'board-open', { id, password: '', key: '' })) as Opened;

    expect((await subscribe(subject.origin, [`room:${open.topic}`], [open.grants.room])).topics).toEqual([
      `room:${open.topic}`
    ]);

    await action(subject.origin, 'board-lock', { board: id, password: 'red kite mondays' });
    const stranger = await subscribe(subject.origin, [`room:${id}.v1`]);

    expect(stranger.status).toBe(403);
    expect(stranger.refused).toEqual([{ topic: `room:${id}.v1`, reason: 'ungranted' }]);

    const unlocked = (await action(subject.origin, 'board-open', {
      id,
      password: 'red kite mondays',
      key: ''
    })) as Opened;

    expect(unlocked.topic).toBe(`${id}.v1`);
    expect((await subscribe(subject.origin, [`room:${unlocked.topic}`], [unlocked.grants.room])).topics).toEqual([
      `room:${unlocked.topic}`
    ]);

    // A grant for the open board's room — issued before the lock — opens nothing of the locked one.
    expect((await subscribe(subject.origin, [`room:${unlocked.topic}`], [open.grants.room])).status).toBe(403);

    const relocked = (await action(subject.origin, 'board-lock', {
      board: id,
      password: 'another kite tuesdays',
      key: (
        (await action(subject.origin, 'board-open', { id, password: 'red kite mondays', key: '' })) as { key: string }
      ).key
    })) as { topic: string };

    expect(relocked.topic).toBe(`${id}.v2`);
    expect((await subscribe(subject.origin, [`room:${relocked.topic}`], [unlocked.grants.room])).status).toBe(403);
  });

  test('words said at the cursor are kept in the board chat too', async ({ page }) => {
    const id = await seedBoard(subject.origin, 'e2e — cursor chat', []);
    await page.goto(`${subject.origin}/b/${id}`);
    await expect(board(page)).toBeVisible();
    await page.mouse.move(...(await middle(page)));
    await page.keyboard.press('/');
    await page.getByRole('textbox', { name: 'Say something at your cursor' }).fill('Hola desde el cursor');
    await page.keyboard.press('Enter');

    await expect
      .poll(async () => {
        const opened = (await action(subject.origin, 'board-open', { id, password: '', key: '' })) as {
          chat: { text: string }[];
        };

        return opened.chat.map(line => line.text);
      })
      .toContain('Hola desde el cursor');
  });

  /** Enter on the board opens the chat ready to type; a line that names this page's person — or everyone — pings it and
   *  says who wrote. */
  test('Enter writes in the chat, and a line naming you pings you', async ({ page }) => {
    const id = await seedBoard(subject.origin, 'e2e — mentions', []);
    // Its channels open, before anything is said on them: a line said earlier is one nothing on this page was there
    // to hear.
    const socket = page.waitForEvent('websocket');
    await page.goto(`${subject.origin}/b/${id}`);
    await (await socket).waitForEvent('framereceived', frame => String(frame.payload).includes('"ready"'));
    await expect(board(page)).toBeVisible();
    await page.mouse.click(...(await middle(page)));

    await page.keyboard.press('Enter');
    await expect(page.getByRole('textbox', { name: 'Message everyone' })).toBeFocused();
    await expect(page.getByText('Write @name to ping someone')).toBeVisible();

    await action(subject.origin, 'board-chat', {
      board: id,
      key: '',
      name: 'Ana',
      color: 'blue',
      text: '@all nos vemos en la retro',
      by: 'e2e-ana'
    });
    await expect(page.getByText('Ana to you: @all nos vemos en la retro')).toBeVisible();
  });

  /** An agent on the board as a teammate is: it hears what is said while it works, stops when somebody presses stop,
   *  and once it has gone it is gone — no cursor left behind by the words it last said. */
  test('an agent hears the board between its steps, stops when told, and leaves no ghost', async ({ page }) => {
    const id = await seedBoard(subject.origin, 'e2e — agent', []);
    await page.goto(`${subject.origin}/b/${id}`);
    await expect(board(page)).toBeVisible();
    const agent = await agentAt(subject.origin);
    await agent.call('join_board', { link: `${subject.origin}/b/${id}` });
    const stop = page.getByRole('button', { name: 'Stop the agent' });
    await expect(stop).toBeVisible();

    const chat = (name: string, words: string) =>
      action(subject.origin, 'board-chat', { board: id, key: '', name, color: 'blue', text: words, by: `e2e-${name}` });

    // What it has not heard yet — this page's person arriving — heard now, so what follows is all there is.
    await agent.call('wait_for_activity', { seconds: 0 });

    // The people talking to each other are not talking to it: nothing rides on its answers, and listening, it is not
    // woken — it reads them as what the others said among themselves.
    await chat('Ana', 'Leo, ¿lo revisas tú?');
    await page.waitForTimeout(300);
    expect(await agent.call('read_board')).not.toContain('Meanwhile on the board');
    expect(await agent.call('wait_for_activity', { seconds: 2 })).toContain(
      'Nothing for you in 2 seconds — only this, to know and not to answer'
    );

    // Somebody arriving is nothing to answer either: it is not woken by it — and not charged the tokens for it.
    const arriving = agent.call('wait_for_activity', { seconds: 3 });
    const other = await page.context().newPage();
    await other.goto(`${subject.origin}/b/${id}`);
    const heardArrival = await arriving;
    expect(heardArrival).toContain('Nothing for you in 3 seconds');
    expect(heardArrival).toContain('joined');
    await other.close();

    // A board that asks its agents to follow the work wakes them for a change — and only then.
    await action(subject.origin, 'board-agents', { board: id, key: '', listens: 'changes' });
    await agent.call('wait_for_activity', { seconds: 0 });
    const woken = agent.call('wait_for_activity', { seconds: 30 });
    const startedAt = Date.now();
    await page.waitForTimeout(500);
    await action(subject.origin, 'board-apply', {
      board: id,
      key: '',
      ops: [element(90, { type: 'rectangle', x: 0, y: 0, width: 80, height: 80 })]
    });
    expect(await woken).toContain('element(s) changed on the board');
    expect(Date.now() - startedAt).toBeLessThan(15_000);

    // Named, it is: said while it works, it hears it with the answer to whatever it does next — once.
    await chat('Ana', '@Claude Code ¿cuánto te falta?');
    await expect
      .poll(async () => agent.call('read_board'))
      .toContain('Ana to you, in the chat: @Claude Code ¿cuánto te falta?');
    expect(await agent.call('read_board')).not.toContain('Meanwhile on the board');

    // Stop pressed: its next piece of work is refused, and talking still works.
    await stop.click();
    await expect
      .poll(async () => {
        const moved = await agent.answer('point_at', { x: 0, y: 0 });

        return moved.failed && moved.text.startsWith('STOPPED');
      })
      .toBe(true);
    await agent.call('say', { text: 'Me quedé en el primer paso.' });

    // Its last words fade five seconds after it went: that used to bring it back, as a cursor nobody could remove.
    await agent.call('say', { text: 'Me voy.', where: 'both' });
    await agent.call('leave_board');
    const dismiss = page.getByRole('button', { name: 'Ask the agent to leave' });
    await expect(dismiss).toHaveCount(0, { timeout: 15_000 });
    await page.waitForTimeout(6500);
    await expect(dismiss).toHaveCount(0);
  });

  /** The library is a place to take elements from, as the pad is: a tile dragged onto the board lands where it is let
   *  go, and one let go over the library itself goes back. A click still puts the tool in hand. */
  test('an element dragged off the library lands where it is let go', async ({ page }) => {
    const id = await seedBoard(subject.origin, 'e2e — the library', []);
    await page.goto(`${subject.origin}/b/${id}`);
    await expect(board(page)).toBeVisible();
    const [x, y] = await middle(page);
    await page.mouse.move(x, y);
    await page.keyboard.press('i');
    const tile = page.locator('[data-plitzi-el="library-rectangle"]');
    const box = await tile.boundingBox();
    expect(box, 'the rectangle in the library').not.toBeNull();
    await drag(page, [(box?.x ?? 0) + 20, (box?.y ?? 0) + 20], [x + 250, y], 12);

    await expect
      .poll(async () => (await savedElements(subject.origin, id)).map(saved => saved.type))
      .toEqual(['rectangle']);

    // A whole kanban board is taken the same way: its three columns land where it is let go.
    await page.keyboard.press('i');
    const kanban = page.locator('[data-plitzi-el="library-kanban-board"]');
    await kanban.scrollIntoViewIfNeeded();
    const tile2 = await kanban.boundingBox();
    expect(tile2, 'the kanban board in the library').not.toBeNull();
    await drag(page, [(tile2?.x ?? 0) + 20, (tile2?.y ?? 0) + 20], [x, y + 100], 12);
    await expect
      .poll(async () => (await savedElements(subject.origin, id)).filter(saved => saved.type === 'frame').length)
      .toBe(3);
  });

  /** Besides the named colours, any one: the style panel's last swatch is the browser's picker, and what is picked is
   *  kept as it was picked. */
  test('a shape takes a colour of its own from the picker', async ({ page }) => {
    const box = element(0, { type: 'rectangle', x: 0, y: 0, width: 160, height: 100 });
    const id = await seedBoard(subject.origin, 'e2e — a colour of its own', [box]);
    await page.goto(`${subject.origin}/b/${id}`);
    await expect(board(page)).toBeVisible();
    const [x, y] = await middle(page);
    await page.mouse.click(x - 80, y);
    await page.locator('[data-plitzi-el="stroke-custom"] input').fill('#FF00AA');

    await expect
      .poll(async () => (await savedElements(subject.origin, id)).map(saved => saved.stroke))
      .toEqual(['#ff00aa']);
  });

  /** A tag is a #word written in anything: ⌘F finds what carries it, dims the rest, and Enter goes to each in turn. */
  test('the board is searched by tag, and what is found is gone through', async ({ page }) => {
    const note = (index: number, x: number, text: string) =>
      element(index, { type: 'sticky', x, y: 0, width: 200, height: 200, fill: 'yellow', text });
    const id = await seedBoard(subject.origin, 'e2e — tags', [
      note(0, 0, 'Crash on save #bug'),
      note(1, 240, 'Dark mode #idea'),
      note(2, 480, 'Slow export #bug')
    ]);
    await page.goto(`${subject.origin}/b/${id}`);
    await expect(board(page)).toBeVisible();
    const [x, y] = await middle(page);
    await page.mouse.click(x, y + 200);
    await pressShortcut(page, 'mod+f');
    await page.keyboard.type('#bug');
    const bar = page.locator('[data-plitzi-el="search-bar"]');
    await expect(bar).toContainText('2 found');
    await expect(bar).toContainText('#idea');
    await page.keyboard.press('Enter');
    await expect(bar).toContainText('1 of 2');
  });

  /** A session with a script: started from the timer's panel, everyone is at its step — and a note written in its
   *  writing step is face down for the others, whatever it says. */
  test('a session keeps what the others write face down until it moves on', async ({ page, browser }) => {
    const id = await seedBoard(subject.origin, 'e2e — a session', []);
    await page.goto(`${subject.origin}/b/${id}`);
    await expect(board(page)).toBeVisible();
    await page.locator('[data-plitzi-el="timer-open"]').click();
    await page.locator('[data-plitzi-el="session-retro"]').click();
    const bar = page.locator('[data-plitzi-el="session-bar"]');
    await expect(bar).toContainText('write');

    const other = await (await browser.newContext()).newPage();
    await other.goto(`${subject.origin}/b/${id}`);
    await expect(other.locator('[data-plitzi-el="session-bar"]')).toContainText('write');
    const [x, y] = await middle(other);
    await other.mouse.click(x, y + 200);
    await other.keyboard.press('6');
    await other.mouse.click(x, y);
    await other.keyboard.type('Secret idea');
    await other.keyboard.press('Escape');
    await expect
      .poll(async () => (await savedElements(subject.origin, id)).map(saved => saved.text))
      .toEqual(['Secret idea']);

    // Face down here: searching for its words finds nothing.
    await pressShortcut(page, 'mod+f');
    await page.keyboard.type('Secret');
    await expect(page.locator('[data-plitzi-el="search-bar"]')).toContainText('Nothing found');
    await page.keyboard.press('Escape');

    await page.locator('[data-plitzi-el="session-next"]').click();
    await expect(bar).toContainText('reveal');
    await pressShortcut(page, 'mod+f');
    await page.keyboard.type('Secret');
    await expect(page.locator('[data-plitzi-el="search-bar"]')).toContainText('1 found');
  });

  /** A frame's branch: a copy beside it with what it holds, taken back into its place with one click. */
  /** A column made the team's Done ticks off what it holds, and what is moved into it — and what leaves it is open
   *  again. */
  test('a card moved into the Done column is ticked off, and open again moved out', async ({ page }) => {
    const todo = element(0, { type: 'frame', layout: 'column', x: 0, y: 0, width: 300, height: 460, text: 'To do' });
    const done = element(1, { type: 'frame', layout: 'column', x: 400, y: 0, width: 300, height: 460, text: 'Done' });
    const card = (index: number, column: { id: string; x: number }, text: string) =>
      element(index, { type: 'card', x: column.x + 16, y: 64, width: 268, height: 60, text, parent: column.id });
    const moving = card(2, todo, 'Write the post');
    const shipped = card(3, done, 'Start a board');
    const id = await seedBoard(subject.origin, 'e2e — a Done column', [todo, done, moving, shipped]);
    await page.goto(`${subject.origin}/b/${id}`);
    await expect(board(page)).toBeVisible();
    // Fitted at its own size: the board's middle, (350, 230), is the canvas's.
    const [x, y] = await middle(page);
    const at = (point: [number, number]): [number, number] => [x + point[0] - 350, y + point[1] - 230];
    const saved = async (of: { id: string }) =>
      (await savedElements(subject.origin, id)).find(entry => entry.id === of.id);

    // Selected by its title bar, the Done column is made the one that completes: what it holds is done now.
    await page.mouse.click(...at([550, 24]));
    await page.locator('[data-plitzi-el="column-completes"]').click();
    await expect.poll(async () => (await saved(done))?.completes).toBe(true);
    await expect.poll(async () => (await saved(shipped))?.done).toBe(true);

    await drag(page, at([150, 94]), at([550, 300]), 10);
    await expect.poll(async () => (await saved(moving))?.parent).toBe(done.id);
    expect((await saved(moving))?.done).toBe(true);

    const there = await saved(moving);
    if (!there) {
      throw new Error('The card is gone');
    }

    await drag(page, at([there.x + 150, there.y + 20]), at([150, 300]), 10);
    await expect.poll(async () => (await saved(moving))?.parent).toBe(todo.id);
    expect((await saved(moving))?.done).toBeUndefined();
  });

  /** A card selected opens whole — no double-click to read it — and moves the cards under it down rather than covering
   *  them, so the next one is still there to be picked. Only on this screen: the column saved is the one that lies. A
   *  title and a description past what an opened card shows (6 lines and 12) make its height a known one: it lies
   *  114 tall and opens 394, so what is under it goes 280 down. */
  test('a card selected opens whole, and the ones under it make room', async ({ page }) => {
    const column = element(0, { type: 'frame', layout: 'column', x: 0, y: 0, width: 300, height: 460, text: 'To do' });
    const lines = (word: string, count: number) =>
      Array.from({ length: count }, (_, index) => `${word} ${index + 1}`).join('\n');
    const long = element(1, {
      type: 'card',
      x: 14,
      y: 62,
      width: 272,
      height: 114,
      text: lines('Step', 8),
      description: lines('Note', 14),
      parent: column.id
    });
    const next = element(2, { type: 'card', x: 14, y: 188, width: 272, height: 48, text: 'Next', parent: column.id });
    const id = await seedBoard(subject.origin, 'e2e — an opened card', [column, long, next]);
    await page.goto(`${subject.origin}/b/${id}`);
    await expect(board(page)).toBeVisible();
    const [x, y] = await middle(page);
    const at = (point: [number, number]): [number, number] => [x + point[0] - 150, y + point[1] - 230];
    const saved = async (of: { id: string }) =>
      (await savedElements(subject.origin, id)).find(entry => entry.id === of.id);

    await page.mouse.click(...at([150, 100]));
    await page.waitForTimeout(400);
    // Under the column as it lies — where the next card is only while the opened one has pushed it down.
    await page.mouse.click(...at([150, 500]));
    await page.locator('[data-plitzi-el="done"]').click();
    await expect.poll(async () => (await saved(next))?.done).toBe(true);
    expect((await saved(long))?.done).toBeUndefined();
    expect((await saved(next))?.y).toBe(188);
    expect((await saved(column))?.height).toBe(460);
  });

  /** What a team lays out every time, kept as a template from the selection's tools and put down again from the
   *  library — on this board, and, by its code, on another. */
  test('a column kept as a template is put down again, here and on another board', async ({ page }) => {
    const column = element(0, {
      type: 'frame',
      layout: 'column',
      x: 0,
      y: 0,
      width: 300,
      height: 460,
      text: 'Check-in'
    });
    const card = element(1, {
      type: 'card',
      x: 14,
      y: 62,
      width: 272,
      height: 48,
      text: 'How are you?',
      author: 'Ana',
      parent: column.id
    });
    const id = await seedBoard(subject.origin, 'e2e — a template', [column, card]);
    await page.goto(`${subject.origin}/b/${id}`);
    await expect(board(page)).toBeVisible();
    const [x, y] = await middle(page);
    const at = (point: [number, number]): [number, number] => [x + point[0] - 150, y + point[1] - 230];
    const library = async (of: string) => {
      const response = await fetch(new URL(`/_rsc?location=/b/${of}&ids=board`, subject.origin));
      const body = (await response.json()) as {
        serverData: { board: { templates: { id: string; title: string; elements: Saved[] }[] } };
      };

      return body.serverData.board.templates;
    };

    // Kept from the column's tools: in the board's library, without who wrote the card.
    await page.mouse.click(...at([150, 24]));
    await page.locator('[data-plitzi-el="save-template"]').click();
    await expect.poll(async () => (await library(id)).map(template => template.title)).toEqual(['Check-in']);
    const [kept] = await library(id);
    expect(kept.elements.map(saved => [saved.type, saved.author])).toEqual([
      ['frame', undefined],
      ['card', undefined]
    ]);

    // Dragged out of the library onto the board, beside the original: a column with its card in it.
    await page.keyboard.press('Escape');
    await page.locator('[data-plitzi-el="tool-library"]').click();
    const tile = page.locator('[data-plitzi-el="library-templates"] li button').first();
    const from = await tile.boundingBox();
    if (!from) {
      throw new Error('The template is not in the library');
    }

    await drag(page, [from.x + from.width / 2, from.y + 30], at([600, 230]), 12);
    await expect
      .poll(async () => (await savedElements(subject.origin, id)).filter(saved => saved.type === 'frame').length)
      .toBe(2);
    const placed = (await savedElements(subject.origin, id)).filter(saved => ![column.id, card.id].includes(saved.id));
    const copy = placed.find(saved => saved.type === 'frame');
    expect(placed.find(saved => saved.type === 'card')?.parent).toBe(copy?.id);

    // On another board, by its code.
    const other = await seedBoard(subject.origin, 'e2e — another board', []);
    await page.goto(`${subject.origin}/b/${other}`);
    await expect(board(page)).toBeVisible();
    await page.locator('[data-plitzi-el="tool-library"]').click();
    await page.locator('[data-plitzi-el="template-code"] input').fill(kept.id.toUpperCase());
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await library(other)).map(template => template.id)).toEqual([kept.id]);
    await expect(page.locator('[data-plitzi-el="library-templates"] li')).toHaveCount(1);
  });

  /** A card that waits on another: said from its tools — the next click picks the card — and moved on while that one
   *  is still open, the person is warned. */
  test('a card waits on another, and moving it on anyway is warned of', async ({ page }) => {
    const column = (index: number, x: number, text: string, completes = false) =>
      element(index, {
        type: 'frame',
        layout: 'column',
        x,
        y: 0,
        width: 300,
        height: 460,
        text,
        ...(completes ? { completes } : {})
      });
    const todo = column(0, 0, 'To do');
    const doing = column(1, 400, 'Doing');
    const done = column(2, 800, 'Done', true);
    const card = (index: number, parent: { id: string; x: number }, text: string) =>
      element(index, { type: 'card', x: parent.x + 14, y: 62, width: 272, height: 48, text, parent: parent.id });
    const client = card(3, todo, 'Build the client');
    const api = card(4, doing, 'Design the API');
    const id = await seedBoard(subject.origin, 'e2e — dependencies', [todo, doing, done, client, api]);
    await page.goto(`${subject.origin}/b/${id}`);
    await expect(board(page)).toBeVisible();
    // Fitted at its own size: the board's middle, (550, 230), is the canvas's.
    const [x, y] = await middle(page);
    const at = (point: [number, number]): [number, number] => [x + point[0] - 550, y + point[1] - 230];
    const saved = async (of: { id: string }) =>
      (await savedElements(subject.origin, id)).find(entry => entry.id === of.id);

    await page.mouse.click(...at([150, 86]));
    await page.locator('[data-plitzi-el="waits-on"]').click();
    await page.mouse.move(...at([540, 90]));
    await page.mouse.click(...at([550, 86]));
    await expect.poll(async () => (await saved(client))?.blockedBy).toEqual([api.id]);
    await expect(page.getByText('“Build the client” now waits on “Design the API”')).toBeVisible();

    await page.keyboard.press('Escape');
    await drag(page, at([150, 86]), at([950, 200]), 12);
    await expect.poll(async () => (await saved(client))?.parent).toBe(done.id);
    await expect(
      page.getByText('“Build the client” went on while it waits on “Design the API”, still open')
    ).toBeVisible();
  });

  /** The board as a list, for whoever cannot read the canvas — a screen reader, an assistant in the browser: read and
   *  changed by role and name alone, never by where something is drawn. */
  test('the board is read and changed through its list, by role and name', async ({ page }) => {
    const column = (index: number, x: number, text: string, completes = false) =>
      element(index, {
        type: 'frame',
        layout: 'column',
        x,
        y: 0,
        width: 300,
        height: 460,
        text,
        ...(completes ? { completes } : {})
      });
    const todo = column(0, 0, 'To do');
    const done = column(1, 400, 'Done', true);
    const api = element(2, {
      type: 'card',
      x: 14,
      y: 62,
      width: 272,
      height: 48,
      text: 'Design the API',
      parent: todo.id
    });
    const id = await seedBoard(subject.origin, 'e2e — a list', [todo, done, api]);
    await page.goto(`${subject.origin}/b/${id}`);
    await expect(board(page)).toBeVisible();
    const list = page.getByRole('region', { name: 'Board contents: e2e — a list' });
    await expect(list.getByRole('region', { name: /^To do/ }).getByRole('listitem')).toHaveText(/Design the API/);
    // Out of sight until asked for — List view shows it beside the board.
    await expect(list).not.toBeInViewport();
    await page.locator('[data-plitzi-el="list-view-toggle"]').click();
    await expect(list).toBeInViewport();

    await list.getByRole('textbox', { name: 'New card in To do' }).fill('Write the docs');
    await list.getByRole('button', { name: 'Add the card to To do' }).click();
    await list.getByRole('button', { name: 'Mark done: “Design the API”' }).click();
    await list.getByRole('combobox', { name: 'Move “Write the docs” to another column' }).selectOption('Move to Done');
    await expect
      .poll(async () =>
        (await savedElements(subject.origin, id))
          .filter(saved => saved.type === 'card')
          .map(({ text, parent, done: ticked }) => ({ text, parent, done: ticked === true }))
          .sort((a, b) => (a.text ?? '').localeCompare(b.text ?? ''))
      )
      .toEqual([
        { text: 'Design the API', parent: todo.id, done: true },
        { text: 'Write the docs', parent: done.id, done: true }
      ]);
  });

  test('a frame is branched and the branch taken back', async ({ page }) => {
    const frame = element(0, { type: 'frame', x: 0, y: 0, width: 400, height: 300, fill: 'none', text: 'Plan' });
    const note = element(1, {
      type: 'sticky',
      x: 40,
      y: 70,
      width: 180,
      height: 180,
      fill: 'yellow',
      text: 'Build it',
      parent: frame.id
    });
    const id = await seedBoard(subject.origin, 'e2e — a branch', [frame, note]);
    await page.goto(`${subject.origin}/b/${id}`);
    await expect(board(page)).toBeVisible();
    // The frame's title bar: 24 below its top, which the fitted view puts 150 above the middle.
    const [x, y] = await middle(page);
    await page.mouse.click(x - 100, y - 150 + 24);
    await page.locator('[data-plitzi-el="branch-frame"]').click();
    await expect
      .poll(async () => (await savedElements(subject.origin, id)).filter(saved => saved.type === 'sticky').length)
      .toBe(2);

    // The branch is selected: taken back, the board is one frame and one note again.
    await page.locator('[data-plitzi-el="merge-branch"]').click();
    await expect
      .poll(async () => (await savedElements(subject.origin, id)).map(saved => saved.type).sort())
      .toEqual(['frame', 'sticky']);
  });
});
