/* eslint-disable quotes -- what the server says quotes code, and reads best in the other quotes */
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { serveProject } from './serveProject';
import { DEV_RELOAD_PATH } from '../../core/http/stages/devReload';
import { unusedPort } from '../../core/unusedPort';
import { offlineDataOf, oneEmptyPage } from '../ssr/testing/offlineData';

import type { ServedProject } from './serveProject';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/**
 * The author script a project's server runs on a save, as the CLI writes it in what matters here: it hands the
 * documents over IPC and exits 0, or says what it refused and exits 1. These documents are the ones in `next.json`,
 * and every run leaves a mark in `runs/`, so a test knows it ran even when nothing changed.
 */
const AUTHOR_SCRIPT = `import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

mkdirSync('runs', { recursive: true });
writeFileSync(\`runs/\${Date.now()}-\${process.pid}\`, '');
let documents;
try {
  documents = JSON.parse(readFileSync('next.json', 'utf-8'));
} catch {
  console.error('[author] refused: the space does not author');
  process.exitCode = 1;
}

if (documents && process.argv.includes('--ipc')) {
  process.send(documents, () => process.disconnect());
} else {
  process.disconnect?.();
}
`;

/** A space of one page titled `title`: what the page's `<title>` says, so a test reads which documents it was served. */
const titled = (title: string): OfflineDataRaw =>
  offlineDataOf({
    ...oneEmptyPage,
    flat: {
      home: {
        ...oneEmptyPage.flat.home,
        attributes: { ...oneEmptyPage.flat.home.attributes, seoEnabled: true, seoPageTitle: title }
      }
    },
    definition: { name: 'Shop', permanentUrl: 'shop' }
  });

/** The project's server, once it answers. */
const serve = async (options: Parameters<typeof serveProject>[0]): Promise<ServedProject> => {
  const started = await serveProject(options);
  served = started;
  await vi.waitFor(async () => {
    expect((await fetch(`${started.url}/health`)).status).toBe(200);
  });

  return started;
};

const pageOf = async (url: string): Promise<string> => (await fetch(`${url}/`)).text();

const ENV_KEYS = ['PORT', 'HOST', 'NODE_ENV', 'PLITZI_HOST_KEY', 'PLITZI_ENVIRONMENT', 'PLITZI_SERVER_URL'] as const;

let root: string;
let served: ServedProject | undefined;
let saved: Partial<Record<(typeof ENV_KEYS)[number], string>>;

const write = async (file: string, text: string): Promise<void> => {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), text);
};

/** What the dev-reload stream says from here on, as it says it. */
const listen = async (url: string) => {
  const stream = await fetch(`${url}/__plitzi/reload`);
  const reader = stream.body?.getReader();
  const decoder = new TextDecoder();
  let said = '';

  return {
    heard: async (event: string): Promise<void> => {
      await vi.waitFor(
        async () => {
          const chunk = await reader?.read();
          said += decoder.decode(chunk?.value);
          expect(said).toContain(`event: ${event}`);
        },
        { timeout: 15_000 }
      );
    },
    stop: () => reader?.cancel()
  };
};

beforeEach(async () => {
  saved = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
  for (const key of ENV_KEYS) {
    Reflect.deleteProperty(process.env, key);
  }

  root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-serve-project-'));
  // Started where a project's scripts start it: in its root.
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  await write('package.json', '{ "type": "module" }\n');
  await write('src/space/index.ts', 'export const space = {};\n');
  await write('src/plugins/.gitkeep', '');
  await write('src/data/products.json', '{ "items": [] }\n');
  await write('public/hello.txt', 'hello from public\n');
  await write('plitzi/author.ts', AUTHOR_SCRIPT);
  await write('.env', 'PLITZI_SIGNING_SECRET=secret\n');
  await write('.env.example', 'PLITZI_SIGNING_SECRET=\n');
  process.env.PORT = String(await unusedPort());
});

afterEach(async () => {
  await served?.close();
  served = undefined;
  vi.restoreAllMocks();
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = saved[key];
    }
  }

  await fs.rm(root, { recursive: true, force: true });
});

/**
 * Each test here starts the project's author script in a process of its own, builds plugins and waits for a save to
 * travel back — up to 15 s a wait (`listen`, the runs). Held to the default 5 s, a test timed out under a loaded machine
 * before the waits it was written with could end, and failed with nothing wrong.
 */
const PROJECT_TEST_TIMEOUT = 30_000;

describe('serveProject — a space held in the project', { timeout: PROJECT_TEST_TIMEOUT }, () => {
  /** What a refusal leaves of the process: what it printed, and the code it exited with — instead of exiting. */
  const refusal = async (options: Parameters<typeof serveProject>[0]): Promise<{ said: string; code: unknown }> => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`exit ${String(code)}`);
    });
    await expect(serveProject(options)).rejects.toThrow('exit 1');
    const code = process.exitCode;
    process.exitCode = 0;

    return { said: error.mock.calls.flat().join('\n'), code };
  };

  // `node main.ts` in `src/`: the project is never guessed from where a file is.
  it('refuses to start anywhere but the project’s root, saying what is missing and where to run it', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(path.join(root, 'src'));

    const { said, code } = await refusal({ space: () => titled('authored at boot') });

    expect(said).toBe(
      `${path.join(root, 'src')} is not the root of a Plitzi project: it has no package.json and no src/. Run it from the project's root, the folder its package.json is in — where its scripts run it (npm start, npm run author).`
    );
    expect(code).toBe(1);
    expect(existsSync(path.join(root, 'tmp/dev-server.json'))).toBe(false);
  });

  // A plugin it cannot build, code where nothing reads it, settings Node never loads: the first is not all there is.
  it('refuses to start laid out where it would read nothing, every error said at once — before authoring', async () => {
    await write('src/plugins/Card/declaration.ts', "export default { type: 'card' };\n");
    await write('src/plugin/Chart/index.ts', 'export default () => null;\n');
    await write('src/.env', 'PLITZI_SIGNING_SECRET=other\n');
    const authored = vi.fn(() => titled('authored at boot'));

    const { said, code } = await refusal({ space: authored });

    expect(said).toMatch(/^The project is not laid out as Plitzi reads it — 3 errors:/);
    expect(said).toContain(
      '1. src/plugins/Card/ has no index.ts (or index.tsx), so the server cannot build the plugin card.'
    );
    expect(said).toContain(
      '2. src/plugin/ holds src/plugin/Chart/index.ts, and nothing reads it there — did you mean src/plugins/?'
    );
    expect(said).toContain("3. src/.env is never read: Node reads the project's settings");
    expect(said).not.toContain('    at ');
    expect(code).toBe(1);
    expect(authored).not.toHaveBeenCalled();
    expect(existsSync(path.join(root, 'tmp/dev-server.json'))).toBe(false);
  });

  // A deployment: one that does not author never serves. While developing it comes up saying why (below).
  it('says a space that does not author as authoring says it, and exits', async () => {
    process.env.NODE_ENV = 'production';
    const refused = new Error('Space "Shop" was not written — one problem:\n\n1. [no-pages] a space with no pages');
    refused.name = 'SpaceRefusedError';

    const { said, code } = await refusal({ space: () => Promise.reject(refused) });

    expect(said).toBe(refused.message);
    expect(code).toBe(1);
  });

  // Anything else is a bug of the project's code or of the server's, and its stack is what finds it.
  it('throws what is not a refusal as it was thrown', async () => {
    process.env.NODE_ENV = 'production';
    const exit = vi.spyOn(process, 'exit');

    await expect(
      serveProject({ space: () => Promise.reject(new TypeError('space.pages is undefined')) })
    ).rejects.toThrow(TypeError);
    expect(exit).not.toHaveBeenCalled();
  });

  // A restart of `start:dev` while the space had an error of its own died on it, and fixing the space woke nothing.
  it('comes up while developing with a space that does not author, says why, and serves it once a save authors', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const running = await serve({ space: () => Promise.reject(new ReferenceError('when is not defined')) });

    const page = await fetch(`${running.url}/`, { headers: { accept: 'text/html' } });
    expect(page.status).toBe(503);
    expect(await page.text()).toContain('ReferenceError: when is not defined');
    expect(error.mock.calls.flat().join('\n')).toContain('fix the space and save');

    const reload = await listen(running.url);
    await reload.heard('hello');
    await write('next.json', JSON.stringify(titled('authored after the fix')));
    await write('src/space/index.ts', 'export const space = { fixed: true };\n');
    await reload.heard('reload');
    await reload.stop();

    expect(await pageOf(running.url)).toContain('<title>authored after the fix</title>');
  });

  it('says what works and should not stay, while developing — and starts', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await write('src/data/notes.txt', 'a note\n');

    await serve({ space: () => titled('authored at boot') });

    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/^\[layout\] src\/data\/notes\.txt is not JSON: .*\n {2}→ Keep it as JSON/)
    );
  });

  it('serves it, its public files, and says where it is for the tools that look for it', async () => {
    const running = await serve({ space: () => titled('authored at boot') });

    const page = await fetch(`${running.url}/`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<title>authored at boot</title>');
    expect(await (await fetch(`${running.url}/hello.txt`)).text()).toBe('hello from public\n');
    expect(await (await fetch(`${running.url}/health`)).json()).toMatchObject({ Server: 'shop' });
    expect(JSON.parse(await fs.readFile(path.join(root, 'tmp/dev-server.json'), 'utf-8'))).toEqual({
      name: 'shop',
      port: Number(process.env.PORT),
      url: running.url
    });
  });

  it('authors it again on a save and serves the new documents from memory, every open page told to load again', async () => {
    const running = await serve({ space: () => titled('authored at boot') });
    const reload = await listen(running.url);
    await reload.heard('hello');

    await write('next.json', JSON.stringify(titled('authored again')));
    await write('src/space/index.ts', 'export const space = { saved: true };\n');
    await reload.heard('reload');
    await reload.stop();

    expect(await pageOf(running.url)).toContain('<title>authored again</title>');
    // Nothing goes through a file: the documents travelled over IPC.
    expect(existsSync(path.join(root, 'tmp/space.json'))).toBe(false);
  });

  it('keeps the last space that authored when the script refuses the new one', async () => {
    const running = await serve({ space: () => titled('authored at boot') });

    await write('src/space/index.ts', 'export const space = { broken: true };\n');
    await vi.waitFor(async () => expect(await fs.readdir(path.join(root, 'runs'))).toHaveLength(1), {
      timeout: 15_000
    });
    // The run ended with nothing handed over; the page is the one before it.
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(await pageOf(running.url)).toContain('<title>authored at boot</title>');
  });

  it('leaves the server’s own code to a restart: a save to it authors nothing', async () => {
    await serve({ space: () => titled('authored at boot') });

    await write('src/config/serverOptions.ts', 'export const serverOptions = {};\n');
    await write('src/plugins/Card/Card.tsx', 'export default () => null;\n');
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(existsSync(path.join(root, 'runs'))).toBe(false);
  });

  it('registers a plugin folder added while it runs, and the open pages load again to render it', async () => {
    const running = await serve({ space: () => titled('authored at boot') });
    expect(await pageOf(running.url)).not.toContain('badge@');
    const reload = await listen(running.url);
    await reload.heard('hello');

    await write('src/plugins/Badge/index.ts', 'export default () => null;\n');
    await reload.heard('reload');
    await reload.stop();

    expect(await pageOf(running.url)).toContain('badge@1.0.0');
  });

  // A folder `plitzi plugin add` did not write — a component with no entry — says so where the server runs, and the
  // server goes on: the plugin is registered once it is whole.
  it('says a plugin folder added broken while it runs, goes on serving, and registers it once it is whole', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const running = await serve({ space: () => titled('authored at boot') });
    const reload = await listen(running.url);
    await reload.heard('hello');

    await write('src/plugins/Badge/Badge.tsx', 'export default () => null;\n');
    await vi.waitFor(
      () =>
        expect(error).toHaveBeenCalledWith(
          expect.stringContaining(
            "[plugins] src/plugins/Badge/ has no index.ts (or index.tsx), so the server cannot build the plugin badge.\n  → Write src/plugins/Badge/index.ts exporting the component by default — export { default } from './Badge.tsx';"
          )
        ),
      { timeout: 5000 }
    );
    expect((await fetch(`${running.url}/`)).status).toBe(200);
    expect(await pageOf(running.url)).not.toContain('badge@');

    await write('src/plugins/Badge/index.ts', "export { default } from './Badge.tsx';\n");
    await reload.heard('reload');
    await reload.stop();
    expect(await pageOf(running.url)).toContain('badge@1.0.0');

    // Its server half begun with no entry: said, never left unloaded in silence.
    await write('src/plugins/Badge/functions/routes.ts', 'export const routes = {};\n');
    await vi.waitFor(
      () =>
        expect(error).toHaveBeenCalledWith(
          expect.stringContaining('[plugins] src/plugins/Badge/functions/ has no index.ts')
        ),
      { timeout: 5000 }
    );
    // Said once, however many saves leave it so.
    await write('src/plugins/Badge/functions/routes.ts', 'export const routes = { a: 1 };\n');
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(error.mock.calls.filter(([line]) => String(line).includes('functions/ has no index.ts'))).toHaveLength(1);
  });

  it('authors nothing and watches nothing in production', async () => {
    process.env.NODE_ENV = 'production';
    // One process: workers, on by default in production, are processes of their own a test does not run.
    const running = await serve({ space: () => titled('authored at boot'), serverOptions: { workers: false } });

    await write('next.json', JSON.stringify(titled('authored again')));
    await write('src/space/index.ts', 'export const space = { saved: true };\n');
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(existsSync(path.join(root, 'runs'))).toBe(false);
    expect(await pageOf(running.url)).toContain('<title>authored at boot</title>');
  });

  it('takes devMode from the project over NODE_ENV: off, a started server offers no reload stream', async () => {
    /** The status the reload stream answers with — a stream left open, so read and dropped. */
    const reloadStatus = async (url: string): Promise<number> => {
      const stop = new AbortController();
      const answer = await fetch(`${url}${DEV_RELOAD_PATH}`, { signal: stop.signal });
      stop.abort();

      return answer.status;
    };

    const developing = await serve({ space: () => titled('a'), serverOptions: { workers: false } });
    expect(await reloadStatus(developing.url)).toBe(200);
    await developing.close();

    const deployed = await serve({ space: () => titled('a'), serverOptions: { workers: false, devMode: false } });
    expect(await reloadStatus(deployed.url)).toBe(404);
  });
});

describe('serveProject — a space read from Plitzi', () => {
  it('asks for the host key before anything else', async () => {
    await expect(serveProject({ cloud: { name: 'shop-cloud' } })).rejects.toThrow('Set PLITZI_HOST_KEY in .env');
  });

  it('refuses an environment Plitzi has not got', async () => {
    process.env.PLITZI_HOST_KEY = 'host-key';
    process.env.PLITZI_ENVIRONMENT = 'prod';

    await expect(serveProject({ cloud: { name: 'shop-cloud' } })).rejects.toThrow('PLITZI_ENVIRONMENT is "prod"');
  });

  it('answers /health with the project’s name, the space being Plitzi’s', async () => {
    process.env.PLITZI_HOST_KEY = 'host-key';
    process.env.PLITZI_SERVER_URL = 'http://127.0.0.1:9';
    const running = await serve({ cloud: { name: 'shop-cloud' } });

    expect(await (await fetch(`${running.url}/health`)).json()).toMatchObject({ Server: 'shop-cloud' });
    expect(existsSync(path.join(root, 'runs'))).toBe(false);
  });
});
