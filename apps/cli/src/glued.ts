/**
 * Flags a shell handed as one argument, split as they were meant: zsh does not split a variable, so `$FLAGS` holding
 * `--steps click a; click b` — or `--as mika --width 390` — arrives whole, and every run since the sixth was refused
 * "unknown option '--steps  click …'" for it. An option's name holds no space, so a word that starts with one and
 * goes on past a space can only be that option and its value — or several flags, split where each `--` starts.
 */

const GLUED = /^(--[a-z][a-z0-9-]*)\s+(\S[\s\S]*)$/;

/** Where another flag starts inside what followed the first: a space, then `--` and a letter. */
const NEXT_FLAG = /\s+(?=--[a-z])/;

export const unglued = (argv: readonly string[]): { args: string[]; split: string[] } => {
  const split: string[] = [];
  const args = argv.flatMap(arg => {
    const glued = GLUED.exec(arg);
    if (!glued) {
      return [arg];
    }

    split.push(arg);

    return arg
      .split(NEXT_FLAG)
      .flatMap(part => {
        const one = GLUED.exec(part.trim());

        return one ? [one[1], one[2].trim()] : [part.trim()];
      })
      .filter(part => part !== '');
  });

  return { args, split };
};
