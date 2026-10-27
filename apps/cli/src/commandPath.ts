import type { Command } from 'commander';

/**
 * A command line as the program reads it: the command it names (`page check`), the options it was given by their long
 * names, and its first argument. Read off the program's own tree — every reader of a run's usage once took a command
 * apart by its words, each its own way (`--list` matched in the text, the name the first two words not a flag).
 */
export interface CommandPath {
  /** The command, its group first: `page check`, `task look`, `explain` — none for a line no command of it reads. */
  name: string;
  /** The options given, each by its long name (`-m` is `--mode`), once each. */
  options: string[];
  /** Its arguments, in order: the page, the task, the topic it is about — what no option holds. */
  args: string[];
}

export const commandPath = (program: Command, args: readonly string[]): CommandPath => {
  let command = program;
  const names: string[] = [];
  let index = 0;
  for (; index < args.length; index += 1) {
    const word = args[index];
    const sub = command.commands.find(each => each.name() === word || each.aliases().includes(word));
    if (!sub) {
      break;
    }

    names.push(sub.name());
    command = sub;
  }

  const options: string[] = [];
  const positional: string[] = [];
  for (let at = index; at < args.length; at += 1) {
    const word = args[at];
    if (!word.startsWith('-') || word === '-') {
      positional.push(word);
      continue;
    }

    const flag = word.split('=')[0];
    const option = command.options.find(each => each.long === flag || each.short === flag);
    const long = option?.long ?? flag;
    if (!options.includes(long)) {
      options.push(long);
    }

    // Its value is the next word, not the command's argument.
    if (option && (option.required || option.optional) && !word.includes('=')) {
      at += 1;
    }
  }

  return { name: names.join(' '), options, args: positional };
};
