import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { AUTHORING_CODES, authoringCodeEntry } from './codes';
import { authoringErrorsPage } from './codesPage';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

const sources = (folder: string): string[] =>
  readdirSync(folder).flatMap(name => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) {
      return sources(path);
    }

    return path.endsWith('.ts') && !path.endsWith('.test.ts') && !path.endsWith('codes.ts') ? [path] : [];
  });

describe('authoring-errors.md', () => {
  // If this fails, a code changed and the page did not: `yarn generate:authoring-errors`.
  it('is the table the code raises its problems with', async () => {
    await expect(authoringErrorsPage()).toMatchFileSnapshot(
      '../../skills/plitzi-authoring/reference/authoring-errors.md'
    );
  });

  // The UPPER_CASE ones are raised by the documents' validators (`validateSchema`), outside this package.
  it('has no row for a code nothing here raises', () => {
    const code = sources(SRC)
      .map(path => readFileSync(path, 'utf-8'))
      .join('\n');
    const unused = Object.keys(AUTHORING_CODES).filter(
      name => name !== name.toUpperCase() && !code.includes(`'${name}'`)
    );

    expect(unused).toEqual([]);
  });

  it('answers a code with its row, and a code it does not hold with nothing', () => {
    expect(authoringCodeEntry('class-and-css')?.kind).toBe('refused');
    expect(authoringCodeEntry('ORPHANED_ELEMENT')).toBeUndefined();
  });
});
