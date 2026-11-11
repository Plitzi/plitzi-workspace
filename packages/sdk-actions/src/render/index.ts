/**
 * Resolving a page's server element that names an action or a connector (docs/en/server-packages.md): in this process, over the
 * engine (`createActionResolver`, what `createPageEngine` hands a page server), or on a worker (`createRemoteRenderResolver`,
 * what `engineOnWorker({ render })` hands one that runs nothing).
 */
export { createActionResolver } from '../engine/runtime/renderResolver';
export { createRemoteRenderResolver } from './remote';
export { RENDER_PATH, RENDER_PROTOCOL } from './protocol';

export type { RemoteRenderOptions } from './remote';
export type { RenderAnswer, RenderAsk } from './protocol';
