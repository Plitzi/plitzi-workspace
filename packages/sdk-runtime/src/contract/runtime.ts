import type { SpaceRuntime } from '@plitzi/sdk-shared/functions';

/** Declares a space runtime — an identity, for the types: `export default defineRuntime({ start: … })`. */
export const defineRuntime = (runtime: SpaceRuntime): SpaceRuntime => runtime;
