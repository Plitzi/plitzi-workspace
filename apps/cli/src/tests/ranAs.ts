import { commandPath } from '../commandPath';
import { buildProgram } from '../program';

import type { CommandPath } from '../commandPath';

const program = buildProgram();

/** A command line's words as a shell splits them: quoted words kept whole. */
const words = (line: string): string[] =>
  (line.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(word => word.replace(/^(["'])(.*)\1$/, '$2'));

/** A command line — `plitzi page check / --as dax` — as the CLI keeps it in a run: read off the program, as `startUsage` reads it. */
export const ranAs = (line: string): CommandPath => commandPath(program, words(line).slice(1));
