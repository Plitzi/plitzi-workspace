import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { serveProject } from './serveProject';
import { freePort } from '../../core/freePort';
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

const entry = (): string => pathToFileURL(path.join(root, 'src/main.ts')).href;

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
  await write('src/space/index.ts', 'export const space = {};\n');
  await write('src/plugins/.gitkeep', '');
  await write('src/data/products.json', '{ "items": [] }\n');
  await write('public/hello.txt', 'hello from public\n');
  await write('plitzi/author.ts', AUTHOR_SCRIPT);
  process.env.PORT = String(await freePort(39400));
});

afterEach(async () => {
  await served?.close();
  served = undefined;
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = saved[key];
    }
  }

  await fs.rm(root, { recursive: true, force: true });
});

describe('serveProject — a space held in the project', () => {
  it('serves it, its public files, and says where it is for the tools that look for it', async () => {
    const running = await serve({ entry: entry(), space: titled('authored at boot') });

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
    const running = await serve({ entry: entry(), space: titled('authored at boot') });
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
    const running = await serve({ entry: entry(), space: titled('authored at boot') });

    await write('src/space/index.ts', 'export const space = { broken: true };\n');
    await vi.waitFor(async () => expect(await fs.readdir(path.join(root, 'runs'))).toHaveLength(1), {
      timeout: 15_000
    });
    // The run ended with nothing handed over; the page is the one before it.
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(await pageOf(running.url)).toContain('<title>authored at boot</title>');
  });

  it('leaves the server’s own code to a restart: a save to it authors nothing', async () => {
    await serve({ entry: entry(), space: titled('authored at boot') });

    await write('src/config/serverOptions.ts', 'export const serverOptions = {};\n');
    await write('src/plugins/Card/Card.tsx', 'export default () => null;\n');
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(existsSync(path.join(root, 'runs'))).toBe(false);
  });

  it('registers a plugin folder added while it runs, and the open pages load again to render it', async () => {
    const running = await serve({ entry: entry(), space: titled('authored at boot') });
    expect(await pageOf(running.url)).not.toContain('badge@');
    const reload = await listen(running.url);
    await reload.heard('hello');

    await write('src/plugins/Badge/index.ts', 'export default () => null;\n');
    await reload.heard('reload');
    await reload.stop();

    expect(await pageOf(running.url)).toContain('badge@1.0.0');
  });

  it('authors nothing and watches nothing in production', async () => {
    process.env.NODE_ENV = 'production';
    // One process: workers, on by default in production, are processes of their own a test does not run.
    const running = await serve({
      entry: entry(),
      space: titled('authored at boot'),
      serverOptions: { workers: false }
    });

    await write('next.json', JSON.stringify(titled('authored again')));
    await write('src/space/index.ts', 'export const space = { saved: true };\n');
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(existsSync(path.join(root, 'runs'))).toBe(false);
    expect(await pageOf(running.url)).toContain('<title>authored at boot</title>');
  });
});

describe('serveProject — a space read from Plitzi', () => {
  it('asks for the host key before anything else', async () => {
    await expect(serveProject({ entry: entry(), cloud: { name: 'shop-cloud' } })).rejects.toThrow(
      'Set PLITZI_HOST_KEY in .env'
    );
  });

  it('refuses an environment Plitzi has not got', async () => {
    process.env.PLITZI_HOST_KEY = 'host-key';
    process.env.PLITZI_ENVIRONMENT = 'prod';

    await expect(serveProject({ entry: entry(), cloud: { name: 'shop-cloud' } })).rejects.toThrow(
      'PLITZI_ENVIRONMENT is "prod"'
    );
  });

  it('answers /health with the project’s name, the space being Plitzi’s', async () => {
    process.env.PLITZI_HOST_KEY = 'host-key';
    process.env.PLITZI_SERVER_URL = 'http://127.0.0.1:9';
    const running = await serve({ entry: entry(), cloud: { name: 'shop-cloud' } });

    expect(await (await fetch(`${running.url}/health`)).json()).toMatchObject({ Server: 'shop-cloud' });
    expect(existsSync(path.join(root, 'runs'))).toBe(false);
  });
});
