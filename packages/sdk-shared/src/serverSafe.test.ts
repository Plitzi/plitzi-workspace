import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The folders a server, a worker, a runner and a runtime load (RFC 0032, D13): what they reach at run time never
 * includes React, React DOM, nexus or plitzi-ui — optional peers of this package, which a server does not install. A
 * value import is followed through every relative path; `import type` loads nothing and is not.
 */
const SERVER_SAFE = [
  'actions',
  'activity',
  'conditions',
  'connectors',
  'dates',
  'flags',
  'functions',
  'helpers',
  'history',
  'network',
  'project',
  'realtime',
  'runs',
  'schema',
  'source',
  'state',
  'theme',
  'types'
];

const SRC = import.meta.dirname;
const FORBIDDEN = /^(react|react-dom|@plitzi\/nexus|@plitzi\/plitzi-ui)(\/|$)/;

const fileOf = (base: string): string | undefined =>
  [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx'), base].find(
    candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  );

/** Every forbidden import a file reaches through its value imports, each with the file that makes it. */
const reached = (file: string, seen = new Set<string>(), found: string[] = []): string[] => {
  if (seen.has(file)) {
    return found;
  }

  seen.add(file);
  const text = fs.readFileSync(file, 'utf8');
  for (const [, specifier = ''] of text.matchAll(/^(?:import|export)\s+(?!type\b)(?:[^'"]*?from\s+)?'([^']+)'/gm)) {
    if (FORBIDDEN.test(specifier)) {
      found.push(`${path.relative(SRC, file)} imports ${specifier}`);
    } else if (specifier.startsWith('.')) {
      const next = fileOf(path.resolve(path.dirname(file), specifier));
      if (next) {
        reached(next, seen, found);
      }
    }
  }

  return found;
};

describe('the folders a server loads', () => {
  it.each(SERVER_SAFE)('%s reaches no React, React DOM, nexus or plitzi-ui', folder => {
    const index = fileOf(path.join(SRC, folder, 'index'));

    expect(index, `${folder} has an index`).toBeDefined();
    expect(index ? reached(index) : []).toEqual([]);
  });
});
