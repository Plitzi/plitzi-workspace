import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BuildResult } from 'esbuild';

const esbuild = vi.hoisted(() => ({ build: vi.fn(), stop: vi.fn() }));

const BUILT: BuildResult = {
  errors: [],
  warnings: [],
  outputFiles: undefined,
  metafile: undefined,
  mangleCache: undefined
};

vi.mock('esbuild', () => ({ default: esbuild }));

/** A build esbuild answers only when told, so a test can hold one open. */
const held = () => {
  let finish: (result: BuildResult) => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  esbuild.build.mockImplementationOnce(
    () =>
      new Promise<BuildResult>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      })
  );

  return { finish: () => finish(BUILT), fail: (error: Error) => fail(error) };
};

// Fresh per test: the count of builds and the rest's timer are the module's own.
const helper = async () => {
  vi.resetModules();

  return import('./esbuild');
};

/** Time passed, and every promise it lets settle. */
const afterRest = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
};

describe('esbuildBuild', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    esbuild.build.mockReset().mockResolvedValue(BUILT);
    esbuild.stop.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds with esbuild, and stops its process once nothing has built for the rest', async () => {
    const { esbuildBuild, ESBUILD_REST_MS } = await helper();

    await esbuildBuild({ entryPoints: ['a.ts'] });

    expect(esbuild.build).toHaveBeenCalledWith({ entryPoints: ['a.ts'] });
    await afterRest(ESBUILD_REST_MS - 1);
    expect(esbuild.stop).not.toHaveBeenCalled();
    await afterRest(1);
    expect(esbuild.stop).toHaveBeenCalledTimes(1);
  });

  it('never stops while a build runs, however long it takes', async () => {
    const { esbuildBuild, ESBUILD_REST_MS } = await helper();
    const slow = held();

    const running = esbuildBuild({ entryPoints: ['slow.ts'] });
    await esbuildBuild({ entryPoints: ['quick.ts'] });
    await afterRest(ESBUILD_REST_MS * 3);
    expect(esbuild.stop).not.toHaveBeenCalled();

    slow.finish();
    await running;
    await afterRest(ESBUILD_REST_MS);
    expect(esbuild.stop).toHaveBeenCalledTimes(1);
  });

  it('starts the rest again on a build that comes during it', async () => {
    const { esbuildBuild, ESBUILD_REST_MS } = await helper();

    await esbuildBuild({ entryPoints: ['a.ts'] });
    await afterRest(ESBUILD_REST_MS / 2);
    await esbuildBuild({ entryPoints: ['b.ts'] });
    await afterRest(ESBUILD_REST_MS / 2);
    expect(esbuild.stop).not.toHaveBeenCalled();

    await afterRest(ESBUILD_REST_MS / 2);
    expect(esbuild.stop).toHaveBeenCalledTimes(1);
  });

  it('counts a failed build out too, and passes its failure on as it is', async () => {
    const { esbuildBuild, ESBUILD_REST_MS } = await helper();
    const failing = held();

    const running = esbuildBuild({ entryPoints: ['broken.ts'] });
    await afterRest(0);
    failing.fail(new Error('Could not resolve "x"'));

    await expect(running).rejects.toThrow('Could not resolve "x"');
    await afterRest(ESBUILD_REST_MS);
    expect(esbuild.stop).toHaveBeenCalledTimes(1);
  });
});
