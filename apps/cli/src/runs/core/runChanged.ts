import { watch } from 'node:fs';

/** What a run's folder holds that is no news for whoever waits on the run: the copies' work, blobs, scratch, pictures. */
const QUIET = /(^|[\\/])(cache|blobs|scratch|shots)([\\/]|$)/;

/**
 * Waits until the run's folder changes — a task taken, sent, reviewed, a message, a state — or `ms` passes, whichever
 * comes first. What waits on a run (an agent's `task next`, a lead's `run watch`, a question's answer) wakes
 * the moment there is something to read, never up to ten seconds after it: the hand-offs between agents are that much
 * smoother. Where the system cannot watch a folder, it is the timer alone, as before.
 */
export const runChanged = (dir: string, ms: number): Promise<void> =>
  new Promise(resolve => {
    let close = (): void => undefined;
    const done = (): void => {
      clearTimeout(timer);
      close();
      resolve();
    };
    const timer = setTimeout(done, ms);
    try {
      const watcher = watch(dir, { recursive: true }, (_event, file) => {
        if (!QUIET.test(file ?? '')) {
          done();
        }
      });
      close = () => watcher.close();
    } catch {
      // No watching here (a folder gone, a system without it): the timer answers alone.
    }
  });
