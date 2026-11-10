import { describe, expect, it } from 'vitest';

import { buildProgram } from './program';
import { skillFiles } from './scaffold/skills';

import type { Command } from 'commander';

/**
 * Every `plitzi …` command a skill or a reference writes is one the CLI has. A skill is what an agent runs from: a
 * command renamed in the CLI and not in the skill (`add plugin`, which became `plugin add`) is a refusal every agent
 * that read it meets, and nothing else would say so.
 */

const named = (command: Command, name: string): Command | undefined =>
  command.commands.find(each => each.name() === name || each.aliases().includes(name));

/** `plitzi <command> [<subcommand>]` as written in inline code and in code blocks: the words, not their arguments. */
const commandsIn = (markdown: string): string[][] =>
  [...markdown.matchAll(/(?:^|[`\s$])plitzi ((?:[a-z][a-z-]*)(?: [a-z][a-z-]*)?)/gm)].map(match =>
    match[1].split(' ')
  );

describe('the commands the skills write', () => {
  const program = buildProgram();
  const files = Object.entries(skillFiles()).filter(([path]) => path.endsWith('.md'));

  it('are found in the skills', () => {
    expect(files.flatMap(([, content]) => commandsIn(content)).length).toBeGreaterThan(50);
  });

  it('are commands the CLI has, and subcommands of them where it has subcommands', () => {
    const stale = files.flatMap(([path, content]) =>
      commandsIn(content).flatMap(([first = '', second]) => {
        const command = named(program, first);
        if (!command) {
          return [`${path}: plitzi ${first}`];
        }

        // A command with subcommands takes one next; any other takes its arguments, whatever they are named.
        if (second && command.commands.length > 0 && !named(command, second)) {
          return [`${path}: plitzi ${first} ${second}`];
        }

        return [];
      })
    );

    expect([...new Set(stale)]).toEqual([]);
  });
});
