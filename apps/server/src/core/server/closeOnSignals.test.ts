import { afterEach, describe, expect, it, vi } from 'vitest';

import { closeOnSignals } from './closeOnSignals';

/** A close the test finishes when it says so — a job still running. */
const closable = () => {
  let finish: () => void = () => {};
  const close = vi.fn(
    () =>
      new Promise<void>(resolve => {
        finish = resolve;
      })
  );

  return { close, finish: () => finish() };
};

const settle = () => new Promise(resolve => setTimeout(resolve, 10));

describe('closeOnSignals', () => {
  const disposers: (() => void)[] = [];

  afterEach(() => {
    disposers.splice(0).forEach(dispose => dispose());
    vi.restoreAllMocks();
  });

  const exits = () =>
    // `process.exit` never returns; a stand-in that does is the whole point of spying on it.
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as unknown as typeof process.exit);

  it('closes the server on SIGTERM, and exits only once it has closed', async () => {
    const exit = exits();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const server = closable();
    const afterClose = vi.fn();
    disposers.push(closeOnSignals(server, { afterClose }));

    process.emit('SIGTERM', 'SIGTERM');
    await settle();
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
    expect(afterClose).not.toHaveBeenCalled();

    server.finish();
    await settle();
    expect(afterClose).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits at once on a second signal while it is still closing', async () => {
    const exit = exits();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const server = closable();
    disposers.push(closeOnSignals(server));

    process.emit('SIGINT', 'SIGINT');
    process.emit('SIGINT', 'SIGINT');
    await settle();

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('reports a close that failed, and exits with an error', async () => {
    const exit = exits();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const failed = vi.spyOn(console, 'error').mockImplementation(() => {});
    disposers.push(closeOnSignals({ close: () => Promise.reject(new Error('socket stuck')) }));

    process.emit('SIGTERM', 'SIGTERM');
    await settle();

    expect(failed).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('leaves the process alone once its handlers are removed', async () => {
    const exit = exits();
    const server = closable();
    closeOnSignals(server)();
    // A listener of the test's own, so the emitted signal has somewhere to go that is not Node's default.
    const keep = () => {};
    process.on('SIGTERM', keep);

    process.emit('SIGTERM', 'SIGTERM');
    await settle();
    process.off('SIGTERM', keep);

    expect(server.close).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});
