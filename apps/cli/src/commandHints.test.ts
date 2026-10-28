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
      'plitzi page shot <path> --within <element>'
    );
    expect(commandHint("error: unknown option '--clip'", ['page', 'shot', '/', '--clip', 'hero'])).toContain(
      '--within <element>'
    );
    expect(commandHint("error: unknown option '--element'", ['page', 'check', '/'])).toBeUndefined();
    expect(commandHint("error: unknown option '--full'", ['page', 'shot', '/', '--full'])).toContain('--viewport');
    expect(commandHint("error: unknown option '--clip'", ['task', 'look', 'd-x', '/', '--clip', 'hero'])).toContain(
      'plitzi task look <task> --within <element>'
    );
  });

  it('names the command that answers one written by its plain name', () => {
    expect(commandHint("error: unknown command 'agents'", ['run', 'agents', 'shop-3'])).toContain('run status');
    expect(commandHint("error: unknown command 'list'", ['task', 'list'])).toContain('run status');
    expect(commandHint("error: unknown command 'pages'", ['space', 'pages'])).toContain('plitzi space overview');
    expect(commandHint("error: unknown command 'take'", ['task', 'take', 't-home'])).toContain(
      'plitzi task next <task>'
    );
    // Asking, blocking and handing off are what task tell says; a stage is stacked by run open.
    expect(commandHint("error: unknown command 'ask'", ['task', 'ask', 'Which title?'])).toContain(
      'plitzi task tell "…" --ask'
    );
    expect(commandHint("error: unknown command 'block'", ['task', 'block'])).toContain('--blocked');
    expect(commandHint("error: unknown command 'request'", ['task', 'request', 'src/a.ts'])).toContain(
      'task propose --file <file>'
    );
    expect(commandHint("error: unknown command 'extend'", ['run', 'extend', 'stage.json'])).toContain(
      'plitzi run open <stage>'
    );
    expect(commandHint("error: unknown command 'purge'", ['run', 'purge', 'r'])).toContain('plitzi run abort <run>');
    expect(commandHint("error: unknown command 'wait'", ['task', 'wait', 'src/a.ts'])).toContain(
      'plitzi task claim <file> --wait'
    );
    expect(commandHint("error: unknown command 'push'", ['runtime', 'push'])).toContain('plitzi space push runtime');
    expect(commandHint("error: unknown command 'pull'", ['functions', 'pull'])).toContain('space pull functions');
    expect(commandHint("error: unknown command 'nope'", ['run', 'nope'])).toBeUndefined();
    expect(commandHint('', ['task', 'wait', 'x'])).toBeUndefined();
  });

  it('names what proves an acceptance, and a flag a command does by itself', () => {
    expect(commandHint("error: unknown option '--before'", ['task', 'check', 't-x', '--before'])).toContain(
      'plitzi task prove <task> --before'
    );
    expect(commandHint("error: unknown option '--tasks'", ['task', 'check', '--tasks', 's.json'])).toContain(
      'plitzi run open <stage.json> --dry-run --lines'
    );
    expect(commandHint("error: unknown option '--take'", ['task', 'next', '--take'])).toContain('--peek');
    expect(commandHint("error: unknown option '--shot'", ['page', 'play', '/r/x', '--shot'])).toContain('shot opened');
    expect(commandHint("error: unknown option '--until'", ['run', 'watch', '--until', 'lead'])).toContain('lead');
    expect(commandHint("error: unknown option '--search'", ['explain', '--search', 'carousel end'])).toContain(
      'plitzi explain "carousel end"'
    );
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
  });

  it('is said by every command, each copying the program’s output', () => {
    const program = buildProgram();
    const shot = program.commands.find(each => each.name() === 'page')?.commands.find(each => each.name() === 'shot');
    expect(shot?.configureOutput()).toEqual(program.configureOutput());
  });
});
