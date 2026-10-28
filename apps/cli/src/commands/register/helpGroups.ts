import { Help } from 'commander';

import type { Command } from 'commander';

/** A heading of `--help`, and the commands under it. */
export interface HelpGroup {
  heading: string;
  commands: readonly string[];
}

/**
 * Puts each command under its heading in `--help`. A command under none, or a heading naming one there is not, is a bug
 * said where the program is put together: a table left behind listed eleven commands gone, and sent new ones under
 * the last heading unsaid.
 */
export const groupHelp = (group: Command, table: readonly HelpGroup[], internal: readonly string[] = []): void => {
  const names = group.commands.map(command => command.name()).filter(name => name !== 'help');
  const listed = table.flatMap(each => each.commands);
  const unlisted = names.filter(name => !listed.includes(name) && !internal.includes(name));
  const gone = [...listed, ...internal].filter(name => !names.includes(name));
  if (unlisted.length > 0 || gone.length > 0) {
    throw new Error(
      `plitzi ${group.name()}'s help is not its commands: ${[...(unlisted.length > 0 ? [`under no heading: ${unlisted.join(', ')}`] : []), ...(gone.length > 0 ? [`no such command: ${gone.join(', ')}`] : [])].join('; ')}`
    );
  }

  for (const command of group.commands) {
    const heading = table.find(each => each.commands.includes(command.name()))?.heading;
    if (heading) {
      command.helpGroup(heading);
    }
  }

  // Shown in the table's order — its headings, and each heading's commands as it lists them: commander shows a heading
  // where its first command was registered, so the order commands happen to be added in decided what a reader met first.
  const rank = (command: Command): number => {
    const at = listed.indexOf(command.name());

    return at === -1 ? listed.length : at;
  };
  const headingAt = (heading: string): number => {
    const at = table.findIndex(each => each.heading === heading);

    return at === -1 ? table.length : at;
  };
  group.configureHelp({
    visibleCommands: command => new Help().visibleCommands(command).sort((a, b) => rank(a) - rank(b)),
    groupItems: (unsorted, visible, getGroup) =>
      new Map([...new Help().groupItems(unsorted, visible, getGroup)].sort(([a], [b]) => headingAt(a) - headingAt(b)))
  });
};
