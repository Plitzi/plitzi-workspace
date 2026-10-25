import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { emitKeypressEvents } from 'node:readline';

import chalk from 'chalk';

import { listedTasks } from './monitorBoard';
import { createCanvas } from './monitorCanvas';
import { initialUi, LIVE_VERB, VIEWS } from './monitorModel';
import { PREVIEW_LINES, previewControl } from './monitorPreview';
import { monitorScreen, paletteFor } from './monitorScreen';
import { SPEND_SORTS } from './monitorSpend';
import { THEMES, themeOfBackground } from './monitorTheme';
import { contextFor } from './shell';
import { monitorRun } from '../../runs/monitor';
import { runPaths } from '../../runs/paths';
import { isRunRefusal, RunRefusal } from '../../runs/refusal';
import { activeRuns, runIds } from '../../runs/run';

import type { PaletteAction } from './monitorDialogs';
import type { MonitorUi } from './monitorModel';
import type { Screen } from './monitorScreen';
import type { ColorDepth, ThemeName } from './monitorTheme';
import type { RunCommandOptions } from './shell';
import type { Monitored } from '../../runs/monitor';
import type { RunContext } from '../../runs/run';

/**
 * `plitzi run monitor`: a person's panel over a run, in a terminal of its own beside the harness's — the run on top,
 * its activity told as it happens, its tasks and agents, what needs someone, the preview served from it (`p`). It
 * reads the run and never writes to it — no message marked read, nothing the lead is woken for touched — so the agents
 * never notice it; the preview it serves is the person's, and stops with it. A shell with no terminal (an agent's) is
 * refused: theirs is `run watch`.
 */

/** A mouse report in SGR form: the button, the column, the row, and M pressed or m released. */
// eslint-disable-next-line no-control-regex -- a terminal's mouse report starts with ESC: it is what is matched
const MOUSE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;

/** How often an animated frame is drawn — the spinner of an agent at work — and the clock's when nothing moves. */
const FRAME_MS = 120;
const CLOCK_MS = 1000;
/** How long a word a key said stays in the status bar. */
const FLASH_MS = 2500;

/** Which run to show: the one named, else the open one, else the newest the project has. */
const runToShow = async (ctx: RunContext, named: string | undefined): Promise<string | undefined> => {
  if (named !== undefined) {
    return named;
  }

  const active = await activeRuns(ctx.root);
  if (active.length > 0) {
    return active[0];
  }

  return (await runIds(ctx.root)).at(-1);
};

/**
 * The terminal's background, asked (OSC 11): a light terminal is drawn light. A terminal that does not answer within a
 * moment is drawn dark, Plitzi's own.
 */
const askBackground = (): Promise<ThemeName> =>
  new Promise(resolve => {
    let said = '';
    const read = (data: Buffer): void => {
      said += data.toString('utf-8');
      const theme = themeOfBackground(said);
      if (theme) {
        done(theme);
      }
    };
    const timer = setTimeout(() => done('dark'), 200);
    const done = (theme: ThemeName): void => {
      clearTimeout(timer);
      process.stdin.off('data', read);
      resolve(theme);
    };
    process.stdin.on('data', read);
    process.stdout.write('\x1b]11;?\x1b\\');
  });

/** The system's own clipboard tool, by platform. */
const CLIPBOARD: Partial<Record<NodeJS.Platform, [string, string[]]>> = {
  darwin: ['pbcopy', []],
  win32: ['clip', []],
  linux: ['xclip', ['-selection', 'clipboard']]
};

/** `text` on the clipboard: the system's own tool where there is one, and the terminal's (OSC 52) besides. */
const copyText = (text: string): void => {
  const tool = CLIPBOARD[process.platform];
  if (tool) {
    const child = spawn(tool[0], tool[1], { stdio: ['pipe', 'ignore', 'ignore'] });
    // A machine with no such tool still has the terminal's copy, below.
    child.on('error', () => undefined);
    child.stdin.end(text);
  }

  process.stdout.write(`\x1b]52;c;${Buffer.from(text).toString('base64')}\x07`);
};

export const runMonitor = async (
  runId: string | undefined,
  options: RunCommandOptions & { interval?: number; theme?: string }
): Promise<void> => {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    const refused = new RunRefusal(
      'invalid',
      'plitzi run monitor draws in a terminal of its own: open it in one beside your harness — an agent, or a script, follows the run with plitzi run watch (--json)'
    );
    console.error(`${chalk.red(`Refused (${refused.code}):`)} ${refused.message}`);
    process.exitCode = refused.exitCode;

    return;
  }

  const ctx = await contextFor(options);
  const depth: ColorDepth = chalk.level;
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let themeName: ThemeName =
    options.theme === 'light' || options.theme === 'dark' ? options.theme : await askBackground();
  let ui: MonitorUi = initialUi();
  let last: Monitored | undefined;
  let screen: Screen | undefined;
  let note = 'Reading the run…';
  let previewOutput: string[] = [];
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  // Many events in a moment — a wheel spun, a burst of writes — drawn once, at most every 16 ms.
  let drawing: ReturnType<typeof setTimeout> | undefined;
  const drawSoon = (): void => {
    drawing ??= setTimeout(() => {
      drawing = undefined;
      draw();
    }, 16);
  };
  // The run's preview, served from here on `p`: it lives with the panel.
  const preview = previewControl(ctx, drawSoon);

  const draw = (): void => {
    const width = process.stdout.columns;
    const height = process.stdout.rows;
    const theme = THEMES[themeName];
    let lines: string[];
    if (last) {
      screen = monitorScreen(last, ui, {
        width,
        height,
        now: new Date(),
        theme,
        preview: { state: preview.state(last.view.previewPort), output: previewOutput }
      });
      lines = screen.canvas.ansi(depth);
    } else {
      const canvas = createCanvas(width, height, theme);
      canvas.put(1, 2, '◆ plitzi', { fg: theme.primary, bold: true });
      canvas.put(3, 2, note, { fg: theme.muted });
      lines = canvas.ansi(depth);
    }

    // Written over from the top inside the terminal's synchronized output, drawn as one frame — never the screen wiped
    // first, which flickered.
    process.stdout.write(`\x1b[?2026h\x1b[H${lines.join('\r\n')}\x1b[?2026l`);
  };

  const flash = (said: string): void => {
    ui = { ...ui, flash: said };
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      ui = { ...ui, flash: undefined };
      drawSoon();
    }, FLASH_MS);
  };

  // Live: the run's folder watched, read again the moment the CLI writes to it — a take, a review, a message, a state.
  // What a copy writes (cache/) and the blobs are no news for the board. The interval is the fallback, for an event the
  // system did not deliver.
  let watched: { id: string; close: () => void } | undefined;
  let soon: ReturnType<typeof setTimeout> | undefined;
  let looking = false;
  let lookAgain = false;
  const follow = (id: string): void => {
    if (watched?.id === id) {
      return;
    }

    watched?.close();
    try {
      const watcher = watch(runPaths(ctx.root, id).dir, { recursive: true }, (_event, file) => {
        if (/(^|\/)(cache|blobs|scratch|shots)(\/|$)/.test(file ?? '')) {
          return;
        }

        // At most a read every 150 ms, never pushed back by the next change: a run written to without a pause was
        // otherwise never read again until the clock's fallback.
        soon ??= setTimeout(() => {
          soon = undefined;
          void look();
        }, 150);
      });
      watched = { id, close: () => watcher.close() };
    } catch {
      watched = undefined;
    }
  };

  const lookOnce = async (): Promise<void> => {
    const id = await runToShow(ctx, runId ?? options.run);
    if (id === undefined) {
      last = undefined;
      note = 'No run in this project yet — this panel shows one the moment it opens (plitzi run open). q quits.';
      draw();

      return;
    }

    follow(id);
    try {
      // The whole activity: a person scrolls back through it (← →), from the plan to now.
      last = await monitorRun(ctx, id, Number.MAX_SAFE_INTEGER);
      const count = listedTasks(last.view.tasks, ui.showApproved).length;
      ui = { ...ui, selected: Math.min(ui.selected, Math.max(0, count - 1)) };
    } catch (error) {
      // Read while the CLI was writing it — a plan half written as a stage is stacked: the board stays as it was and is
      // read again in a moment. Thrown, it ended the monitor.
      if (!isRunRefusal(error)) {
        setTimeout(() => void look(), 500);

        return;
      }

      last = undefined;
      note =
        error.code === 'not-found'
          ? `Run "${id}" is gone: it finished, or a person aborted it. Waiting for the next one — q quits.`
          : `${error.code}: ${error.message}`;
    }

    draw();
  };

  const look = async (): Promise<void> => {
    // One read at a time: one asked for meanwhile runs right after, never beside it.
    if (looking) {
      lookAgain = true;

      return;
    }

    looking = true;
    try {
      await lookOnce();
    } catch {
      // Whatever a read met, the board stays up and reads again: a monitor a person watches never ends on its own.
      setTimeout(() => void look(), 1000);
    } finally {
      looking = false;
      if (lookAgain) {
        lookAgain = false;
        void look();
      }
    }
  };

  await new Promise<void>(resolve => {
    // The alternate screen, as a pager uses: the terminal's own text is back as it was once it quits. The mouse too (SGR
    // reports): a click opens a line, picks a task or a view; the wheel scrolls what it is over.
    process.stdout.write('\x1b[?1049h\x1b[?25l\x1b[?1000h\x1b[?1006h');
    const timer = setInterval(() => void look(), Math.max(1, options.interval ?? 5) * 1000);
    let ticked = 0;
    const clock = setInterval(() => {
      ticked += FRAME_MS;
      const moving = last?.agents.some(agent => LIVE_VERB[agent.status] !== undefined) === true;
      if (moving || ticked >= CLOCK_MS) {
        ticked = 0;
        ui = { ...ui, frame: ui.frame + 1 };
        void preview
          .output(PREVIEW_LINES)
          .then(lines => {
            previewOutput = lines;
          })
          .catch(() => undefined);
        drawSoon();
      }
    }, FRAME_MS);
    const quit = (): void => {
      preview.stop();
      clearInterval(timer);
      clearInterval(clock);
      clearTimeout(soon);
      clearTimeout(drawing);
      clearTimeout(flashTimer);
      watched?.close();
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\x1b[?1000l\x1b[?1006l\x1b[?25h\x1b[?1049l');
      resolve();
    };

    /** What a command of the palette does: what the panel's keys do, and what only it reaches. */
    const runAction = (action: PaletteAction): void => {
      if (!last) {
        return;
      }

      ui = { ...ui, dialog: undefined };
      if (action.kind === 'view') {
        ui = { ...ui, view: action.view, selected: 0 };
      } else if (action.kind === 'task') {
        const index = listedTasks(last.view.tasks, true).findIndex(task => task.id === action.id);
        ui = { ...ui, showApproved: true, selected: Math.max(0, index), dialog: { kind: 'task' } };
      } else if (action.kind === 'copy') {
        copyText(action.text);
        flash(`copied: ${action.text}`);
      } else if (action.kind === 'preview') {
        preview.toggle(last.view.runId, last.view.previewPort);
      } else if (action.kind === 'open-preview') {
        preview.open(last.view.previewPort);
      } else if (action.kind === 'approved') {
        ui = { ...ui, showApproved: !ui.showApproved, selected: 0 };
      } else if (action.kind === 'theme') {
        themeName = themeName === 'dark' ? 'light' : 'dark';
      } else {
        quit();
      }
    };

    process.stdin.on('data', (data: Buffer) => {
      let changed = false;
      for (const [, button, column, row, kind] of data.toString('utf-8').matchAll(MOUSE)) {
        if (kind !== 'M' || !screen || ui.dialog) {
          continue;
        }

        const at = { row: Number(row) - 1, col: Number(column) - 1 };
        if (button === '0') {
          const hit = screen.hits.find(each => each.row === at.row && at.col >= each.from && at.col < each.to);
          if (hit?.action.kind === 'view') {
            ui = { ...ui, view: hit.action.view, selected: 0 };
          } else if (hit?.action.kind === 'task') {
            // A click picks a task; a click on the one picked opens it.
            ui =
              hit.action.index === ui.selected
                ? { ...ui, dialog: { kind: 'task' } }
                : { ...ui, selected: hit.action.index };
          } else if (hit?.action.kind === 'event') {
            const opened = new Set(ui.opened);
            if (!opened.delete(hit.action.key)) {
              opened.add(hit.action.key);
            }

            ui = { ...ui, opened };
          }

          changed = true;
        } else if (button === '64' || button === '65') {
          const up = button === '64';
          const over = screen.areas.find(
            each =>
              at.row >= each.top &&
              at.row < each.top + each.height &&
              at.col >= each.left &&
              at.col < each.left + each.width
          );
          const count = last ? listedTasks(last.view.tasks, ui.showApproved).length : 0;
          if (over?.area.kind === 'activity') {
            const most = Math.max(0, (last?.feed.length ?? 1) - 1);
            ui = { ...ui, feedBack: Math.max(0, Math.min(most, ui.feedBack + (up ? 1 : -1))) };
          } else if (over?.area.kind === 'tasks' && count > 0) {
            ui = { ...ui, selected: Math.max(0, Math.min(count - 1, ui.selected + (up ? -1 : 1))) };
          } else if (over?.area.kind === 'stage') {
            const offsets = new Map(ui.flowOffsets);
            offsets.set(over.area.key, Math.max(0, (offsets.get(over.area.key) ?? 0) + (up ? -1 : 1)));
            ui = { ...ui, flowOffsets: offsets };
          }

          changed = true;
        }
      }

      if (changed) {
        drawSoon();
      }
    });

    process.stdin.on(
      'keypress',
      (text: string | undefined, key: { name?: string; ctrl?: boolean; sequence?: string } | undefined) => {
        // A mouse report, or the terminal's answer about its background, is read above — never as keys.
        if (key?.sequence?.includes('[<') === true || key?.sequence?.includes(']11;') === true) {
          return;
        }

        if (key?.ctrl === true && key.name === 'c') {
          quit();

          return;
        }

        const count = last ? listedTasks(last.view.tasks, ui.showApproved).length : 0;
        const needs = screen?.needs ?? [];
        const { dialog } = ui;
        if (dialog?.kind === 'palette') {
          const found = last ? paletteFor(last, ui, THEMES[themeName], needs) : [];
          if (key?.name === 'escape') {
            ui = { ...ui, dialog: undefined };
          } else if (key?.name === 'return') {
            const picked = found.at(dialog.at);
            if (picked) {
              runAction(picked.action);
            }
          } else if (key?.name === 'up') {
            ui = { ...ui, dialog: { ...dialog, at: Math.max(0, dialog.at - 1) } };
          } else if (key?.name === 'down') {
            ui = { ...ui, dialog: { ...dialog, at: Math.min(Math.max(0, found.length - 1), dialog.at + 1) } };
          } else if (key?.name === 'backspace') {
            ui = { ...ui, dialog: { kind: 'palette', query: dialog.query.slice(0, -1), at: 0 } };
          } else if (text !== undefined && text.length === 1 && text >= ' ' && key?.ctrl !== true) {
            ui = { ...ui, dialog: { kind: 'palette', query: `${dialog.query}${text}`, at: 0 } };
          }

          draw();

          return;
        }

        if (dialog !== undefined && (key?.name === 'escape' || key?.name === 'return' || text === '?')) {
          ui = { ...ui, dialog: undefined };
          draw();

          return;
        }

        if (key?.name === 'q') {
          quit();

          return;
        }

        const digit = Number(text);
        const need = needs.at(Math.min(ui.needsAt, needs.length - 1));
        if (key?.ctrl === true && key.name === 'p') {
          ui = { ...ui, dialog: { kind: 'palette', query: '', at: 0 } };
        } else if (text === '?') {
          ui = { ...ui, dialog: { kind: 'help' } };
        } else if (Number.isInteger(digit) && digit >= 1 && digit <= VIEWS.length) {
          ui = { ...ui, view: VIEWS[digit - 1]?.view ?? 'overview', selected: 0 };
        } else if (key?.name === 'down' && count > 0) {
          ui = { ...ui, selected: (ui.selected + 1) % count };
        } else if (key?.name === 'up' && count > 0) {
          ui = { ...ui, selected: (ui.selected - 1 + count) % count };
        } else if (key?.name === 'return' && count > 0) {
          ui = { ...ui, dialog: { kind: 'task' } };
        } else if (key?.name === 'left') {
          ui = { ...ui, feedBack: Math.min(Math.max(0, (last?.feed.length ?? 1) - 1), ui.feedBack + 5) };
        } else if (key?.name === 'right') {
          ui = { ...ui, feedBack: Math.max(0, ui.feedBack - 5) };
        } else if (key?.name === 'a') {
          ui = { ...ui, showApproved: !ui.showApproved, selected: 0 };
        } else if (key?.name === 's') {
          ui = {
            ...ui,
            spendSort: SPEND_SORTS[(SPEND_SORTS.indexOf(ui.spendSort) + 1) % SPEND_SORTS.length] ?? 'spent'
          };
        } else if (key?.name === 't') {
          themeName = themeName === 'dark' ? 'light' : 'dark';
        } else if (key?.name === 'p' && last) {
          preview.toggle(last.view.runId, last.view.previewPort);
        } else if (key?.name === 'o' && last) {
          preview.open(last.view.previewPort);
        } else if (key?.name === 'n' && needs.length > 0) {
          ui = { ...ui, needsAt: (Math.min(ui.needsAt, needs.length - 1) + 1) % needs.length };
        } else if (key?.name === 'd' && needs.length > 0) {
          ui = { ...ui, dialog: { kind: 'needs' } };
        } else if (key?.name === 'c' && need?.fix !== undefined) {
          copyText(need.fix);
          flash(`copied: ${need.fix}`);
        } else if (key?.name === 'escape' && need) {
          ui = { ...ui, dismissed: new Set([...ui.dismissed, need.key]), needsAt: 0 };
          flash('put off — back once it says something else');
        } else if (key?.name === 'y' && last) {
          const task = listedTasks(last.view.tasks, ui.showApproved).at(ui.selected);
          if (task) {
            copyText(task.id);
            flash(`copied: ${task.id}`);
          }
        }

        draw();
      }
    );
    process.stdout.on('resize', draw);
    void look();
  });
};
