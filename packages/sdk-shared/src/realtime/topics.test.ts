import { describe, expect, it } from 'vitest';

import { channelLimits, channelProblems, isValidTopic, matchChannel } from './topics';

import type { ChannelDeclarations } from '../types/RealtimeTypes';

const declarations: ChannelDeclarations = {
  'board:{id}': { access: { mode: 'public' }, presence: true },
  lobby: { access: { mode: 'session' }, publish: 'server' }
};

describe('matchChannel', () => {
  it('matches a topic to the pattern that covers it', () => {
    expect(matchChannel('board:7f3a', declarations)?.pattern).toBe('board:{id}');
    expect(matchChannel('lobby', declarations)?.declaration.publish).toBe('server');
  });

  it('refuses what no pattern covers, and a parameter that spans a separator', () => {
    expect(matchChannel('chat:1', declarations)).toBeUndefined();
    expect(matchChannel('board:', declarations)).toBeUndefined();
    expect(matchChannel('board:a:b', declarations)).toBeUndefined();
    expect(matchChannel('lobby2', declarations)).toBeUndefined();
  });

  it('refuses a topic with characters a topic cannot hold', () => {
    expect(isValidTopic('board:../x')).toBe(false);
    expect(isValidTopic('board x')).toBe(false);
    expect(matchChannel('board:<script>', declarations)).toBeUndefined();
  });

  it('takes a pattern literally apart from its parameters', () => {
    expect(matchChannel('room.1', { 'room.{n}': { access: { mode: 'public' } } })?.pattern).toBe('room.{n}');
    expect(matchChannel('roomX1', { 'room.{n}': { access: { mode: 'public' } } })).toBeUndefined();
  });
});

describe('channelLimits', () => {
  it('fills in what a declaration leaves out', () => {
    expect(channelLimits({ access: { mode: 'public' } })).toEqual({ maxMessageBytes: 4096, messagesPerSecond: 30 });
  });
});

describe('channelProblems', () => {
  it('accepts what the server can serve', () => {
    expect(channelProblems('board:{id}', { access: { mode: 'public' }, publish: 'server', presence: true })).toEqual(
      []
    );
    expect(channelProblems('lobby', { access: { mode: 'role', permissions: ['boardEdit'] } })).toEqual([]);
  });

  it('names each thing that is wrong, and how to write it', () => {
    expect(channelProblems('board {id}', { access: { mode: 'public' } })).toHaveLength(1);
    expect(channelProblems('', { access: { mode: 'public' } })).toHaveLength(1);
    expect(channelProblems('board:{id}', 'public')).toEqual([
      'a channel is an object: `{ access: { mode: "public" } }`'
    ]);
    expect(
      channelProblems('board:{id}', {
        access: { mode: 'role' },
        publish: 'everyone',
        presence: 'yes',
        messagesPerSecond: 0.5
      })
    ).toHaveLength(4);
  });
});
