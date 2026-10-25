import fs from 'node:fs/promises';
import { stripVTControlCharacters } from 'node:util';

import { openBrowser } from '../../account/oauth';
import { answering, portOr } from '../../runs/acceptance';
import { startPreview } from '../../runs/preview';
import { isRunRefusal } from '../../runs/refusal';

import type { Preview } from '../../runs/preview';
import type { RunContext } from '../../runs/run';

/**
 * The run's preview from the monitor: `p` serves the approved work — `npm run start:preview` in a terminal of its own
 * no more — and stops it, `o` opens it, and its server's output shows under its address. Started here, it lives with
 * the panel: quitting stops it, said where it is shown.
 */

/** Where the preview is served when nothing else listens there: the address `run preview` gives too. */
export const PREVIEW_PORT = 8300;

/** How many of its server's last lines show under its address; one on a short terminal. */
export const PREVIEW_LINES = 3;

export type PreviewState =
  | { kind: 'none' }
  /** Served by another process — `npm run start:preview`, another monitor: shown, never stopped from here. */
  | { kind: 'elsewhere'; url: string }
  | { kind: 'starting'; url: string }
  | { kind: 'serving'; url: string }
  /** It stopped on its own, or could not start: why, and what its server said last. */
  | { kind: 'stopped'; why: string; said: string[] };

/** The last lines its server wrote, as text: what it says while it serves, under its address. */
export const outputTail = (text: string, lines: number): string[] =>
  stripVTControlCharacters(text)
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(line => line.trim() !== '')
    .slice(-lines);

export interface PreviewControl {
  /** Where it stands: `served` is the port the run's record names, whoever serves on it. */
  state: (served: number | undefined) => PreviewState;
  /** What its server said last, when this panel serves it. */
  output: (lines: number) => Promise<string[]>;
  /** `p`: served when nothing is, stopped when this panel serves it. */
  toggle: (runId: string, served: number | undefined) => void;
  /** `o`: the preview in the person's browser, whoever serves it. */
  open: (served: number | undefined) => void;
  /** The panel quits: what it started stops with it. */
  stop: () => void;
}

export const previewControl = (ctx: RunContext, changed: () => void): PreviewControl => {
  let own: Preview | undefined;
  let state: PreviewState = { kind: 'none' };
  const set = (next: PreviewState): void => {
    state = next;
    changed();
  };
  const urlOf = (port: number): string => `http://127.0.0.1:${String(port)}`;

  const start = async (runId: string): Promise<void> => {
    const port = await portOr(PREVIEW_PORT);
    set({ kind: 'starting', url: urlOf(port) });
    try {
      own = await startPreview(ctx, runId, port, { quiet: true });
    } catch (error) {
      set({ kind: 'stopped', why: isRunRefusal(error) ? error.message : String(error), said: [] });

      return;
    }

    const preview = own;
    void preview.done.then(ended => {
      if (own === preview) {
        own = undefined;
      }

      // Stopped by `p` is what was asked; anything else is said, with what its server wrote last.
      set(
        ended.why === 'the preview stopped: it was asked to'
          ? { kind: 'none' }
          : { kind: 'stopped', why: ended.why, said: preview.stopped()?.said ?? [] }
      );
    });
    if (await answering(preview.url, 120_000)) {
      if (own === preview) {
        set({ kind: 'serving', url: preview.url });
      }
    } else if (own === preview) {
      preview.stop();
      set({ kind: 'stopped', why: `nothing answered on ${preview.url} within 2 minutes`, said: [] });
    }
  };

  return {
    state: served =>
      own !== undefined
        ? state
        : served !== undefined
          ? { kind: 'elsewhere', url: urlOf(served) }
          : state.kind === 'stopped'
            ? state
            : { kind: 'none' },
    output: async lines =>
      own?.log === undefined ? [] : outputTail(await fs.readFile(own.log, 'utf-8').catch(() => ''), lines),
    toggle: (runId, served) => {
      if (own !== undefined) {
        own.stop();
      } else if (served === undefined) {
        // Nothing of it is lost unsaid: whatever the start met is the preview's state.
        void start(runId).catch((error: unknown) =>
          set({ kind: 'stopped', why: error instanceof Error ? error.message : String(error), said: [] })
        );
      }
    },
    open: served => {
      const url = own?.url ?? (served === undefined ? undefined : urlOf(served));
      if (url !== undefined) {
        openBrowser(url);
      }
    },
    stop: () => own?.stop()
  };
};
