import { describe, expect, it } from 'vitest';

import { createTurnHolder } from './turnHolder';

/** Turns the test hands out by hand, and what was given back. */
const handTurns = () => {
  const asked: ((id: number) => void)[] = [];
  const given: number[] = [];
  let next = 1;

  return {
    turns: {
      take: () => new Promise<number>(resolve => asked.push(resolve)),
      give: (id: number) => {
        given.push(id);
      }
    },
    grant: () => asked.shift()?.(next++),
    asked: () => asked.length,
    given
  };
};

describe('the turn an invocation holds', () => {
  it('is asked for once, however many answers come back at once', async () => {
    const source = handTurns();
    const holder = createTurnHolder(source.turns);
    const both = Promise.all([holder.take(), holder.take()]);

    expect(source.asked()).toBe(1);
    source.grant();
    await both;
    expect(holder.holds()).toBe(true);
    await holder.take();
    expect(source.asked()).toBe(0);
  });

  it('is given back while it waits, and nothing is given when it holds none', async () => {
    const source = handTurns();
    const holder = createTurnHolder(source.turns);
    const taken = holder.take();
    source.grant();
    await taken;

    holder.give();
    holder.give();

    expect(source.given).toEqual([1]);
    expect(holder.holds()).toBe(false);
  });

  it('goes straight back when it is handed one after it ended', async () => {
    const source = handTurns();
    const holder = createTurnHolder(source.turns);
    const taken = holder.take();

    holder.end();
    source.grant();
    await taken;

    expect(source.given).toEqual([1]);
    expect(holder.holds()).toBe(false);
  });
});
