import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

import esbuild from 'esbuild';

import type { SpaceRuntime } from './contract';

/** What the runtime's host provides, and a bundle must not carry a copy of: the platform's packages and React. */
const PROVIDED = ['@plitzi/*', 'react', 'react-dom', 'react/*', 'react-dom/*'];

/** A packed runtime at most this big: its code and every dependency, not its data. */
export const MAX_RUNTIME_BUNDLE_BYTES = 32 * 1024 * 1024;

const FORMAT = 1;

const ENTRY = 'runtime.mjs';

/** A packed runtime: its files, by path, as the host writes them — the entry first among them. */
type PackedRuntime = { format: number; entry: string; files: Record<string, string> };

/** A bundle's id: what its bytes are, so the same code packed twice is one bundle. */
export const runtimeBundleId = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/**
 * A runtime's module packed to travel: bundled for Node with every dependency it imports — but the platform's packages
 * and React, which the host provides, so there is one copy of each — and gzipped. `entry` is the module whose default
 * export is `defineRuntime(…)`.
 */
export const packRuntime = async (entry: string): Promise<Uint8Array> => {
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    external: PROVIDED,
    outdir: 'runtime',
    entryNames: 'runtime',
    outExtension: { '.js': '.mjs' },
    // A dependency written as CommonJS asks for `require` inside an ES module: given the module's own.
    banner: {
      js: 'import { createRequire as __plitziRequire } from "node:module"; const require = __plitziRequire(import.meta.url);'
    },
    splitting: false,
    logLevel: 'warning',
    write: false
  });
  const files = Object.fromEntries(
    result.outputFiles.map(output => [path.basename(output.path), Buffer.from(output.contents).toString('base64')])
  );
  if (!(ENTRY in files)) {
    throw new Error(`Packing ${entry} produced no ${ENTRY}`);
  }

  const packed: PackedRuntime = { format: FORMAT, entry: ENTRY, files };
  const bytes = gzipSync(JSON.stringify(packed));
  if (bytes.byteLength > MAX_RUNTIME_BUNDLE_BYTES) {
    throw new Error(
      `A runtime is at most ${String(MAX_RUNTIME_BUNDLE_BYTES / 1024 / 1024)} MB packed; this one is ` +
        `${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB`
    );
  }

  return new Uint8Array(bytes);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A packed runtime read back — refused whole when it is not one. */
const unpack = (bytes: Uint8Array): PackedRuntime => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(gunzipSync(bytes).toString('utf8'));
  } catch {
    throw new Error('Not a packed runtime: it is not gzipped JSON');
  }

  if (!isRecord(parsed) || parsed.format !== FORMAT || typeof parsed.entry !== 'string' || !isRecord(parsed.files)) {
    throw new Error(`Not a packed runtime of format ${String(FORMAT)}`);
  }

  const files: Record<string, string> = {};
  Object.entries(parsed.files).forEach(([name, content]) => {
    // Written by name into one directory: a name that climbs out of it is not a file of this bundle.
    if (typeof content !== 'string' || name !== path.basename(name) || name.startsWith('.')) {
      throw new Error(`"${name}" is not a file a packed runtime can hold`);
    }

    files[name] = content;
  });
  if (!(parsed.entry in files)) {
    throw new Error(`A packed runtime's entry, ${parsed.entry}, is not among its files`);
  }

  return { format: FORMAT, entry: parsed.entry, files };
};

/**
 * What a packed runtime holds, read without running any of it — what a platform checks a bundle with before keeping it.
 * Throws, saying why, for bytes that are not one.
 */
export const inspectRuntime = (bytes: Uint8Array): { entry: string; files: string[] } => {
  if (bytes.byteLength > MAX_RUNTIME_BUNDLE_BYTES) {
    throw new Error(`A runtime is at most ${String(MAX_RUNTIME_BUNDLE_BYTES / 1024 / 1024)} MB packed`);
  }

  const { entry, files } = unpack(bytes);

  return { entry, files: Object.keys(files) };
};

const isRuntime = (value: unknown): value is SpaceRuntime => isRecord(value) && typeof value.start === 'function';

/**
 * A packed runtime written into `dir` and imported: its module's default export. `dir` must be inside the host's own
 * project, so the packages the bundle leaves to the host resolve to the host's — one copy of each.
 */
export const loadRuntime = async (bytes: Uint8Array, dir: string): Promise<SpaceRuntime> => {
  const { entry, files } = unpack(bytes);
  await fs.mkdir(dir, { recursive: true });
  await Promise.all(
    Object.entries(files).map(([name, content]) => fs.writeFile(path.join(dir, name), Buffer.from(content, 'base64')))
  );
  const loaded: unknown = await import(pathToFileURL(path.join(dir, entry)).href);
  const runtime = isRecord(loaded) ? loaded.default : undefined;
  if (!isRuntime(runtime)) {
    throw new Error('A runtime module exports its runtime by default: export default defineRuntime({ start: … })');
  }

  return runtime;
};
