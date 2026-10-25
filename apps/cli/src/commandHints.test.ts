import { describe, expect, it } from 'vitest';

import { commandHint } from './commandHints';
import { buildProgram } from './program';

/** 22 command lines refused as written, each found again by the next session that wrote it. */
describe('what a refused command line meant', () => {
  it('says a shell variable that held two flags arrived as one', () => {
    const hint = commandHint("error: unknown option '--as mika'", ['page', 'check', '/', '--as mika']);
    expect(hint).toContain('not split by zsh');
    expect(hint).toContain('${=FLAGS}');
  });

  it('names what this page command calls an option another has', () => {
    expect(commandHint("error: unknown option '--element'", ['page', 'shot', '/', '--element', 'hero'])).toContain(
      '--clip <element>'
    );
    expect(commandHint("error: unknown option '--element'", ['page', 'check', '/'])).toBeUndefined();
    expect(commandHint("error: unknown option '--full'", ['page', 'shot', '/', '--full'])).toContain('--viewport');
  });

  it('names the command that answers one another group has', () => {
    expect(commandHint("error: unknown command 'agents'", ['run', 'agents', 'shop-3'])).toContain('run status');
    expect(commandHint("error: unknown command 'list'", ['task', 'list'])).toContain('run status');
    expect(commandHint("error: unknown command 'nope'", ['run', 'nope'])).toBeUndefined();
  });

  it('says a bare option takes its value, and where what a command takes none of is read', () => {
    expect(
      commandHint("error: option '--as <username>' argument missing", ['page', 'play', '/u/juno', '--as'])
    ).toContain('--as <value>');
    expect(
      commandHint("error: too many arguments for 'inbox'. Expected 0 arguments but got 1: d-x.", [
        'task',
        'inbox',
        'd-x'
      ])
    ).toContain('plitzi task show <task>');
    expect(commandHint("error: unknown option '--clip'", ['task', 'look', 'd-x', '/', '--clip', 'hero'])).toContain(
      'page shot <path> --clip'
    );
  });

  it('is said by every command, each copying the program’s output', () => {
    const program = buildProgram();
    const shot = program.commands.find(each => each.name() === 'page')?.commands.find(each => each.name() === 'shot');
    expect(shot?.configureOutput()).toEqual(program.configureOutput());
  });
});
