import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import { visitViewOf } from '../visit';
import { visitorArgs, withVisitorOptions } from './options';

import type { VisitorOptions } from './options';

const parsed = (args: string[]): VisitorOptions => {
  const command = withVisitorOptions(new Command('page').exitOverride());
  command.parse(args, { from: 'user' });

  return command.opts<VisitorOptions>();
};

describe('the visitor flags', () => {
  it('are handed on as the flags a page command reads back the same', () => {
    const asked = [
      '--timezone',
      'America/Mexico_City',
      '--presence',
      '--clock',
      '2026-10-25T20:00:00.000Z',
      '--block',
      'player.js',
      '--block',
      'fonts.gstatic',
      '--hold',
      'iframe_api',
      '--autoplay',
      'refused',
      '--storage',
      'refused'
    ];
    const options = parsed(asked);

    expect(visitorArgs(options)).toEqual(asked);
    expect(parsed(visitorArgs(options))).toEqual(options);
  });

  it('make the view a page is visited with — nothing of what was not asked', () => {
    expect(visitViewOf(parsed([]))).toEqual({});
    expect(visitViewOf(parsed(['--timezone', 'Europe/Madrid', '--block', 'cdn', '--hold', 'iframe_api']))).toEqual({
      timezone: 'Europe/Madrid',
      conditions: { block: ['cdn'], hold: ['iframe_api'] }
    });
  });
});
