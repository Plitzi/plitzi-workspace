// Imported at once, not on the first build: esbuild fixes its child's working directory when it is loaded, and a
// process that changed directory before then would start every child where it happened to be.
import esbuild from 'esbuild';

import { serverLog } from '../log/serverLog';

import type { BuildOptions, BuildResult } from 'esbuild';

/** esbuild's own guard against an option it does not know, which `build` takes its options through. */
type SameShape<Out, In extends Out> = In & { [Key in Exclude<keyof In, keyof Out>]: never };

/** How long esbuild's process is kept once nothing is building: a burst of builds shares one, a rest frees it. */
export const ESBUILD_REST_MS = 60_000;

let building = 0;
let rest: NodeJS.Timeout | undefined;

const stopResting = (): void => {
  rest = undefined;
  esbuild.stop().catch((error: unknown) => {
    serverLog.warn('esbuild', `its process could not be stopped, and stays: ${String(error)}`);
  });
};

/**
 * esbuild's `build`, and the one way this process builds with it. esbuild runs as a child process it starts on the
 * first build and keeps for the life of the parent — 16–26 MiB resident in a page server's pod for builds that happen
 * at boot (its plugins) and seldom after. Every build here counts itself, and the child is stopped once none has run for
 * `ESBUILD_REST_MS`; the next build starts it again (a few milliseconds). Stopping kills whatever the child is doing, so
 * a build that went to esbuild directly would fail with it: the server's builds and `@plitzi/sdk-mcp`'s all come here.
 */
export const esbuildBuild = async <T extends BuildOptions>(
  options: SameShape<BuildOptions, T>
): Promise<BuildResult<T>> => {
  building++;
  clearTimeout(rest);
  rest = undefined;
  try {
    return await esbuild.build(options);
  } finally {
    building--;
    if (building === 0) {
      rest = setTimeout(stopResting, ESBUILD_REST_MS);
      rest.unref();
    }
  }
};
