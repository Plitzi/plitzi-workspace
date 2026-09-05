import { authorSpace } from '../schema';
import { space as blankSpaceSpec } from './blank/spec';
// The declaration's own source, inlined at build time — the copy `plitzi create` writes into a project. Read as
// text rather than through the filesystem because this package is bundled for the browser too.
import specSource from './blank/spec.ts?raw';

import type { AuthoredSpace } from '../schema';

/**
 * The declaration itself, under the name the platform knows it by.
 *
 * It is exported from its own file as `space`, because that file is copied verbatim into projects created with
 * `plitzi create` — and there, `blankSpaceSpec` would be a puzzle: the developer is looking at their own site,
 * not at Plitzi's blank one. Renamed here rather than rewritten on the way out, so the copy is the file.
 */
export { space as blankSpaceSpec } from './blank/spec';

/**
 * The space a new space starts as — one page with a hero and four cards, not an empty document.
 *
 * It lives here rather than in the seeds of whichever server happens to create spaces, because two unrelated
 * things need it and they must not drift: the platform's `POST /spaces`, and `plitzi create`, which scaffolds a
 * project around it for somebody who has no account at all. When it was JSON inside one of them, the other kept a
 * copy — and a copy of a fixture is a fixture that is wrong six months later with nothing to say so.
 *
 * A declaration rather than an exported document, so whoever receives it can change it. `blankSpace()` is the
 * documents a renderer wants; `blankSpaceSource()` is the file itself, for a project that will edit it.
 */

/** The two documents, authored fresh — so one caller writing its own name in cannot mark the next one's copy. */
export const blankSpace = (): AuthoredSpace => authorSpace(blankSpaceSpec);

/**
 * The declaration as a file somebody can drop into their own project.
 *
 * The source is this package's own — the same text that produced the documents above, so what a project starts
 * with and what Plitzi creates cannot come apart. Its imports are relative here because it lives inside the
 * package; on the way out they are rewritten to the package name, which is how the copy resolves anywhere else.
 */
export const blankSpaceSource = (): string => toPortableSource(specSource);

/** Matches an import of this package's own modules — the only kind the copy has to be freed of. */
const RELATIVE_IMPORT = /^import (type )?\{([^}]*)\} from '\.\.[^']*';$/gm;

export const toPortableSource = (source: string): string => {
  const values = new Set<string>();
  const types = new Set<string>();

  for (const [, isType, names] of source.matchAll(RELATIVE_IMPORT)) {
    for (const name of names
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean)) {
      (isType ? types : values).add(name);
    }
  }

  const header = [
    values.size > 0 ? `import { ${[...values].sort().join(', ')} } from '@plitzi/sdk-authoring';` : '',
    types.size > 0 ? `import type { ${[...types].sort().join(', ')} } from '@plitzi/sdk-authoring';` : ''
  ]
    .filter(Boolean)
    .join('\n\n');

  /**
   * The whole leading import block goes, not one line at a time.
   *
   * A regex over the block would have to know how many lines it spans and how they are separated; counting from
   * the top until something that is neither an import nor blank appears cannot get that wrong.
   */
  const lines = source.split('\n');
  let end = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].startsWith('import ')) {
      end = index + 1;
    } else if (lines[index].trim() !== '') {
      break;
    }
  }

  return [header, ...lines.slice(end)].join('\n');
};
