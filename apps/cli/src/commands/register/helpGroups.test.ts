import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import { groupHelp } from './helpGroups';

const group = (...names: string[]): Command => {
  const command = new Command('run');
  names.forEach(name => command.command(name).description(`${name} it`));

  return command;
};

// A help table left behind listed eleven commands gone, and sent new ones under its last heading unsaid.
describe('the headings of a group’s help', () => {
  it('refuses a command under no heading, and a heading naming a command there is not', () => {
    expect(() => {
      groupHelp(group('open', 'watch', 'keep'), [{ heading: 'Yours:', commands: ['open', 'extend'] }], ['keep']);
    }).toThrow("plitzi run's help is not its commands: under no heading: watch; no such command: extend");
  });

  it('shows the headings and their commands in the table’s order, whatever order they were added in', () => {
    const run = group('finish', 'watch', 'open');
    groupHelp(run, [
      { heading: 'Follow:', commands: ['watch'] },
      { heading: 'Yours:', commands: ['open', 'finish'] }
    ]);
    const help = run.helpInformation();

    expect(help.indexOf('Follow:')).toBeLessThan(help.indexOf('Yours:'));
    expect(help.indexOf('  open')).toBeLessThan(help.indexOf('  finish'));
  });
});
