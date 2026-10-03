/** What the config and `launch.ts` agree on: which servers to start, handed over in the environment, and the port the
 *  launcher answers on once all of them listen. Apart from `launch.ts` because importing that one starts it. */
export const LAUNCH_TARGETS_ENV = 'PLITZI_LAUNCH_TARGETS';

export const LAUNCHER_PORT = 5099;
