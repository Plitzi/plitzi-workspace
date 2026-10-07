import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

/**
 * What each run works on, made fresh for it and thrown away after: a space served by the MCP's own dev server (its
 * documents in a folder of the run's), or a project the workspace's CLI writes, its packages the workspace's own.
 */

const run = promisify(execFile);

export const WORKSPACE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const MCP_APP = path.join(WORKSPACE, 'apps/mcp');

const CLI = path.join(WORKSPACE, 'apps/cli/dist/index.js');

export const scratch = (name: string): Promise<string> => fs.mkdtemp(path.join(os.tmpdir(), `plitzi-agents-${name}-`));

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        address && typeof address === 'object' ? resolve(address.port) : reject(new Error('no port'))
      );
    });
  });

/** What a run works on: a project, or the folder an MCP server saves a space to, and that server. */
export interface Fixture {
  /** The project, or where the space's documents are as the server saves them: `space.json` and `style.json`. */
  dir: string;
  mcpUrl?: string;
  stop: () => Promise<void>;
}

/** The MCP dev server on a port of its own, serving a copy of its sample space. */
export const mcpFixture = async (): Promise<Fixture> => {
  const dir = await scratch('mcp');
  await fs.cp(path.join(MCP_APP, 'dev/sample'), dir, { recursive: true });
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', 'dev/main.ts'], {
    cwd: MCP_APP,
    env: {
      ...process.env,
      TSX_TSCONFIG_PATH: 'tsconfig.app.json',
      MCP_PORT: String(port),
      MCP_HOST: '127.0.0.1',
      MCP_SAMPLE_DIR: dir,
      LOG_REQUESTS: '0'
    },
    stdio: 'ignore'
  });
  const url = `http://127.0.0.1:${String(port)}/`;
  for (let attempt = 0; attempt < 120; attempt++) {
    const answered = await fetch(`${url}health`).then(
      () => true,
      () => false
    );
    if (answered) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  return {
    dir,
    mcpUrl: url,
    stop: async () => {
      child.kill('SIGTERM');
      await fs.rm(dir, { recursive: true, force: true });
    }
  };
};

/** The space as the MCP server saved it. */
export const savedSchema = async (dir: string): Promise<unknown> => {
  const parsed: unknown = JSON.parse(await fs.readFile(path.join(dir, 'space.json'), 'utf-8'));

  return typeof parsed === 'object' && parsed !== null && 'schema' in parsed ? parsed.schema : undefined;
};

/** A project the workspace's CLI writes from its catalog template, its packages the workspace's. */
export const projectFixture = async (): Promise<Fixture> => {
  const parent = await scratch('cli');
  const dir = path.join(parent, 'shop');
  await run(
    process.execPath,
    [CLI, 'create', dir, '--mode', 'server', '--source', 'local', '-p', 'npm', '--template', 'catalog', '--no-install'],
    { cwd: parent }
  );
  await fs.symlink(path.join(WORKSPACE, 'node_modules'), path.join(dir, 'node_modules'));

  return { dir, stop: () => fs.rm(parent, { recursive: true, force: true }) };
};

const AUTHORED = [
  `import { authorProjectSpace } from ${JSON.stringify('@plitzi/sdk-authoring/node')};`,
  'const { schema } = await authorProjectSpace();',
  'process.stdout.write(JSON.stringify(schema));'
].join('\n');

/** The project's space as it authors now, in a process of its own — or why it does not. */
export const authoredSchema = async (dir: string): Promise<{ schema: unknown } | { problem: string }> => {
  try {
    const { stdout } = await run(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', AUTHORED], {
      cwd: dir,
      maxBuffer: 64 * 1024 * 1024
    });

    const schema: unknown = JSON.parse(stdout);

    return { schema };
  } catch (error) {
    return { problem: error instanceof Error ? error.message.split('\n').slice(0, 4).join(' ') : String(error) };
  }
};
