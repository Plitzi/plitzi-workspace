import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

const sourceFiles = (): string[] =>
  readdirSync(SRC, { recursive: true, encoding: 'utf-8' })
    .filter(entry => /\.tsx?$/u.test(entry) && !/\.test\.tsx?$/u.test(entry))
    .map(entry => path.join(SRC, entry));

const importsOf = (file: string): string[] =>
  [...readFileSync(file, 'utf-8').matchAll(/from\s+'([^']+)'/gu)].map(m => m[1]);

/** The invariant the split exists to protect. `@plitzi/sdk-server` is a barrel over SSR, RSC, plugins and the
 *  React render path; ESM re-exports load eagerly, so ONE import of it from shipped code would pull that whole
 *  graph into every MCP process — measured at the time of the split as 233 modules of dead weight.
 *
 *  ESLint bans it too, but a lint rule only fires where lint runs. This pins it in the suite that gates CI. */
describe('package boundary with @plitzi/sdk-server', () => {
  it('imports only the narrow entries, never the root barrel', () => {
    const offenders = sourceFiles()
      .filter(file => importsOf(file).includes('@plitzi/sdk-server'))
      .map(file => path.relative(SRC, file));

    expect(offenders).toEqual([]);
  });

  it('reaches the SSR render primitives only from the draft-preview path', () => {
    const usingSsrEntry = sourceFiles()
      .filter(file => importsOf(file).some(spec => spec.startsWith('@plitzi/sdk-server/ssr')))
      .map(file => path.relative(SRC, file));

    // `@plitzi/sdk-server/ssr` carries buildBody, and buildBody is React. Only the preview endpoint renders —
    // if anything else starts importing it, a dedicated MCP process has quietly gained a renderer.
    expect(usingSsrEntry).toEqual(['preview/createPreview.ts']);
  });

  it('builds through the kernel’s esbuildBuild, never with esbuild itself', () => {
    // The kernel stops esbuild's process once nothing has built for a while, and a build that reached esbuild on its
    // own would die with it — in a process that serves the MCP beside the page server.
    const offenders = sourceFiles()
      .filter(
        file => valueImportsOf(file).includes('esbuild') || readFileSync(file, 'utf-8').includes("import('esbuild')")
      )
      .map(file => path.relative(SRC, file));

    expect(offenders).toEqual([]);
  });
});

/** What a file loads when it runs: its value imports and re-exports — `import type` is erased, `import()` is lazy. */
const valueImportsOf = (file: string): string[] =>
  [...readFileSync(file, 'utf-8').matchAll(/^(?:import|export)\s+(?!type\b)(?:[^;]*?\sfrom\s+)?'([^']+)'/gmu)].map(
    m => m[1]
  );

/** Every file of this package a module reaches through what it loads when it runs. */
const staticGraph = (entry: string): string[] => {
  const reached = new Set<string>();
  const visit = (file: string): void => {
    if (reached.has(file)) {
      return;
    }

    reached.add(file);
    for (const spec of valueImportsOf(file).filter(each => each.startsWith('.'))) {
      const base = path.resolve(path.dirname(file), spec);
      const found = [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find(candidate => {
        try {
          readFileSync(candidate);

          return true;
        } catch {
          return false;
        }
      });
      if (found) {
        visit(found);
      }
    }
  };
  visit(path.join(SRC, entry));

  return [...reached];
};

// The page server mounts the preview endpoint on every process it runs: what a preview needs is loaded by the first one.
describe('the preview entry', () => {
  it('starts with the endpoint alone: neither the MCP SDK nor the preview it renders', () => {
    const graph = staticGraph('preview.ts');

    expect(graph.map(file => path.relative(SRC, file)).sort()).toEqual(['preview.ts', 'stages/preview.ts']);
    expect(graph.flatMap(valueImportsOf).filter(spec => !spec.startsWith('.'))).not.toContainEqual(
      expect.stringMatching(/^@modelcontextprotocol/u)
    );
  });

  it('renders a draft without the MCP SDK', () => {
    const packages = staticGraph('preview/createPreview.ts').flatMap(valueImportsOf);

    expect(packages).not.toContainEqual(expect.stringMatching(/^@modelcontextprotocol/u));
  });
});
