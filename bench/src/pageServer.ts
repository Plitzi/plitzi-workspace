import { emitTypeScript } from './compile';

export const PAGE_SERVER_DIR = 'bench/.cache/page-server';

/**
 * The bench's own page server, compiled the way a deployment runs one: JavaScript, with no TypeScript transformer
 * loaded into the process — which is ~10 MB of a server's memory, measured.
 */
export const compilePageServer = (workspaceRoot: string): Promise<void> =>
  emitTypeScript(workspaceRoot, ['bench/targets/pageServer.ts'], PAGE_SERVER_DIR);
