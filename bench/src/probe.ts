import { emitTypeScript } from './compile';

/** Compiles the probe once per run, so what is preloaded into every server is JavaScript and nothing else. */
export const compileProbe = (workspaceRoot: string): Promise<void> =>
  emitTypeScript(workspaceRoot, ['bench/probe/memoryProbe.ts'], 'bench/.cache/probe');
