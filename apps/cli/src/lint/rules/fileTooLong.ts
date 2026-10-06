import { finding } from '../catalog';

import type { Rule } from '../types';

/**
 * Past this many lines that say something, a file is no longer read whole — by a person or by an agent, which reads it
 * in pieces and writes the next part without the rest in view.
 */
export const MAX_LINES = 400;

export const fileTooLong: Rule = ({ files }) =>
  files.flatMap(source => {
    const lines = source.text.split('\n').filter(line => line.trim() !== '').length;
    if (lines <= MAX_LINES) {
      return [];
    }

    return [
      finding(
        'file-too-long',
        `${String(lines)} non-blank lines (more than ${String(MAX_LINES)}): split it by what changes together — a section or a page per file, a block placed again as a component or a function, its rows as data — so each part is read whole.`,
        { file: source.file, line: 1, column: 1 }
      )
    ];
  });
