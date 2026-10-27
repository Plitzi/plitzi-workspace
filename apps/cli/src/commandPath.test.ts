import { describe, expect, it } from 'vitest';

import { commandPath } from './commandPath';
import { buildProgram } from './program';

// Every reader of a run's usage took a command apart by its words, each its own way.
describe('a command line, as the program reads it', () => {
  const program = buildProgram();

  it('names its command, its options by their long names, and its first argument — an option’s value none of them', () => {
    expect(commandPath(program, ['page', 'check', '/rooms', '--as', 'dax', '--width', '390', '--json'])).toEqual({
      name: 'page check',
      options: ['--as', '--width', '--json'],
      args: ['/rooms']
    });
    expect(commandPath(program, ['task', 'look', '--as', 'juno', 't-home', '--fresh=true'])).toEqual({
      name: 'task look',
      options: ['--as', '--fresh'],
      args: ['t-home']
    });
    expect(commandPath(program, ['explain', '--list'])).toEqual({ name: 'explain', options: ['--list'], args: [] });
    expect(commandPath(program, ['explain', 'no', 'validate'])).toMatchObject({ args: ['no', 'validate'] });
  });

  it('names what it can of a line no command reads — refused as written', () => {
    expect(commandPath(program, ['page', 'check', '/', '--fresh'])).toMatchObject({
      name: 'page check',
      options: ['--fresh']
    });
    expect(commandPath(program, ['nope', 'x'])).toEqual({ name: '', options: [], args: ['nope', 'x'] });
  });
});
