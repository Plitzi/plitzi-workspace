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
});
