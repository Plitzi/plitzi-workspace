import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { emitKeypressEvents } from 'node:readline';
import { PassThrough } from 'node:stream';

import chalk from 'chalk';

import { listedTasks } from './monitorBoard';
import { frameUpdate } from './monitorCanvas';
import { onKey, onMouse, splitInput } from './monitorInput';
import { initialUi, keptBack, LIVE_VERB } from './monitorModel';
import { PREVIEW_LINES, previewControl } from './monitorPreview';
import { monitorScreen, paletteFor, waitingScreen } from './monitorScreen';
import { THEMES, themeOfBackground } from './monitorTheme';
import { readLaunch } from '../../../runs/agents/launch';
import { runPaths } from '../../../runs/core/paths';
import { isRunRefusal, RunRefusal } from '../../../runs/core/refusal';
import { recentMoments } from '../../../runs/harness/moments';
import { activeRuns, runIds } from '../../../runs/run';
import { monitorRun } from '../../../runs/view/monitor';
import { contextFor } from '../shell';

import type { Effect, Key, Shown } from './monitorInput';
import type { MonitorUi, StreamShown } from './monitorModel';
import type { Screen, Waiting } from './monitorScreen';
import type { ColorDepth, ThemeName } from './monitorTheme';
import type { RunContext } from '../../../runs/run';
import type { Monitored } from '../../../runs/view/monitor';
import type { RunCommandOptions } from '../shell';

/**
 * `plitzi run monitor`: a person's panel over a run, in a terminal of its own beside the harness's — the run on top,
 * its activity told as it happens, its tasks and agents, what needs someone, the preview served from it (`p`). It
 * reads the run and never writes to it — no message marked read, nothing the lead is woken for touched — so the agents
 * never notice it; the preview it serves is the person's, and stops with it. A shell with no terminal (an agent's) is
 * refused: theirs is `run watch`.
 */

/** How often an animated frame is drawn — the spinner of an agent at work — and the clock's when nothing moves. */
const FRAME_MS = 120;
const CLOCK_MS = 1000;
/** How long a word a key said stays in the status bar. */
const FLASH_MS = 2500;

/** How often the followed agent's stream is read again, and how many of its last moments. */
const STREAM_MS = 2000;
const STREAM_MOMENTS = 200;

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
  options: RunCommandOptions & { interval?: number; theme?: string; advanced?: boolean }
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
  // The keys are read from what is left once the mouse's reports and the terminal's answers are taken out
  // (`splitInput`): read from the terminal whole, a click's digits were keys.
  const keys = new PassThrough();
  emitKeypressEvents(keys);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let themeName: ThemeName =
    options.theme === 'light' || options.theme === 'dark' ? options.theme : await askBackground();
  let ui: MonitorUi = initialUi(options.advanced === true ? 'advanced' : 'simple');
  let last: Monitored | undefined;
  let screen: Screen | undefined;
  let waiting: Waiting = { title: 'Monitor', said: 'Reading the run…', tone: 'primary' };
  let previewOutput: string[] = [];
  let stream: StreamShown | undefined;
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

  // What the terminal shows now: the next frame writes only the rows that differ from it.
  let drawn: string[] | undefined;
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
        preview: { state: preview.state(last.view.previewPort), output: previewOutput },
        ...(stream === undefined ? {} : { stream })
      });
      lines = screen.canvas.ansi(depth);
    } else {
      screen = undefined;
      lines = waitingScreen(waiting, {
        width,
        height,
        now: new Date(),
        theme,
        ...(ui.flash === undefined ? {} : { flash: ui.flash })
      }).ansi(depth);
    }

    // The rows that changed, written over inside the terminal's synchronized output as one frame — never the screen
    // wiped first, which flickered.
    const update = frameUpdate(drawn, lines);
    drawn = lines;
    if (update !== '') {
      process.stdout.write(`\x1b[?2026h${update}\x1b[?2026l`);
    }
  };

  /**
   * The followed agent's stream, read off the session its harness keeps: one the run did not start (the lead, in the
   * person's own harness) has none it knows of. Kept only while that agent is still the one followed.
   */
  const readStream = async (): Promise<void> => {
    const agent = ui.agent;
    const runId = last?.view.runId;
    if (agent === undefined || runId === undefined) {
      stream = undefined;

      return;
    }

    const launch = await readLaunch(runPaths(ctx.root, runId), agent);
    const read = launch
      ? await recentMoments(
          {
            harness: launch.harness,
            startedAt: launch.startedAt,
            ...(launch.session === undefined ? {} : { session: launch.session })
          },
          ctx.root,
          STREAM_MOMENTS
        ).catch((error: unknown) => ({ problem: error instanceof Error ? error.message : String(error) }))
      : { problem: 'not started by the run — its session is the harness it runs in, not one the run keeps' };
    if (ui.agent === agent) {
      // Scrolled back, it stays on what it was reading as moments come after it.
      if (!('problem' in read)) {
        const previous = stream !== undefined && 'moments' in stream ? stream.moments : undefined;
        ui = { ...ui, streamBack: keptBack(previous, read, ui.streamBack) };
      }

      stream = { agent, ...('problem' in read ? { problem: read.problem } : { moments: read }) };
      drawSoon();
    }
  };

  /** The panel as a key or the mouse left it: a word it says now is said for a moment, then cleared. */
  const become = (next: MonitorUi): void => {
    if (next.agent !== ui.agent) {
      stream = undefined;
      ui = next;
      void readStream();
    }

    if (next.flash !== undefined && next.flash !== ui.flash) {
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        ui = { ...ui, flash: undefined };
        drawSoon();
      }, FLASH_MS);
    }

    ui = next;
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
      waiting = {
        title: 'No run yet',
        said: 'This project has no run of agents. The panel shows one the moment it opens (plitzi run open).',
        tone: 'primary'
      };
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
      waiting =
        error.code === 'not-found'
          ? {
              title: 'Run ended',
              said: `Run "${id}" is gone: it finished, or a person aborted it. The panel shows the next one the moment it opens.`,
              tone: 'primary'
            }
          : { title: `Refused (${error.code})`, said: error.message, tone: 'danger' };
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
    const streaming = setInterval(() => void readStream(), STREAM_MS);
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
    // Stopped from another process (`x` in another monitor) as `run preview` is, by SIGINT: the preview this panel serves
    // stops, the panel stays. A person's Ctrl-C here is a key (raw mode), read below.
    const stopOwn = (): void => preview.quit();
    process.on('SIGINT', stopOwn);
    const quit = (): void => {
      process.off('SIGINT', stopOwn);
      preview.quit();
      clearInterval(timer);
      clearInterval(streaming);
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

    const shown = (): Shown => {
      const needs = screen?.needs ?? [];

      return {
        data: last,
        hits: screen?.hits ?? [],
        areas: screen?.areas ?? [],
        needs,
        palette: () => (last ? paletteFor(last, ui, THEMES[themeName], needs) : []),
        preview: last ? preview.state(last.view.previewPort).kind : 'none'
      };
    };

    const effect = (asked: Effect): void => {
      if (asked.kind === 'quit') {
        quit();
      } else if (asked.kind === 'copy') {
        copyText(asked.text);
      } else if (asked.kind === 'theme') {
        themeName = themeName === 'dark' ? 'light' : 'dark';
      } else if (last && asked.kind === 'start-preview') {
        preview.start(last.view.runId, last.view.previewPort);
      } else if (last && asked.kind === 'stop-preview') {
        preview.stop(last.view.runId, last.view.previewPort);
      } else if (last) {
        preview.open(last.view.previewPort);
      }
    };

    process.stdin.on('data', (data: Buffer) => {
      const input = splitInput(data.toString('utf-8'));
      let changed = false;
      for (const { button, column, row, pressed } of input.mice) {
        if (!pressed) {
          continue;
        }

        const next = onMouse(ui, { button, row: row - 1, col: column - 1 }, shown());
        if (next) {
          become(next);
          changed = true;
        }
      }

      if (changed) {
        drawSoon();
      }

      if (input.keys !== '') {
        keys.write(input.keys);
      }
    });

    keys.on('keypress', (text: string | undefined, key: Key | undefined) => {
      const step = onKey(ui, text, key, shown());
      if (!step) {
        return;
      }

      become(step.ui);
      // Quitting is the last thing done: nothing is drawn over the terminal given back.
      const quits = step.effects.some(asked => asked.kind === 'quit');
      step.effects.filter(asked => asked.kind !== 'quit').forEach(effect);
      if (quits) {
        quit();

        return;
      }

      draw();
    });
    // A terminal resized reflows what it showed: the next frame is written whole.
    process.stdout.on('resize', () => {
      drawn = undefined;
      draw();
    });
    void look();
  });
};
