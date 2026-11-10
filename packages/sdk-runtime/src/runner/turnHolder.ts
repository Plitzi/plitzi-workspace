/** Where turns come from: the runner's (`createTurns`), handed out in the order they were asked for. */
export type TurnSource = { take: () => Promise<number>; give: (id: number) => void };

/**
 * The turn at running JavaScript one invocation holds, if any. It gives it up while it waits on the platform and takes
 * one again before it hears back (`waitingOn`): a turn waited for is the runner's time, and an isolate that waits holds
 * none another could run in.
 */
export const createTurnHolder = (turns: TurnSource) => {
  let holding: number | undefined;
  /** A turn asked for and not yet given: two answers back at once ask once. */
  let taking: Promise<void> | undefined;
  /** Ended: a turn handed to it after that goes straight back. */
  let ended = false;

  const take = async (): Promise<void> => {
    if (holding !== undefined) {
      return;
    }

    taking ??= turns.take().then(id => {
      taking = undefined;
      if (ended) {
        turns.give(id);
      } else {
        holding = id;
      }
    });
    await taking;
  };

  const give = (): void => {
    if (holding !== undefined) {
      turns.give(holding);
      holding = undefined;
    }
  };

  return {
    take,
    give,
    holds: (): boolean => holding !== undefined,
    /** It ended: the turn it holds goes back, and so does one handed to it from now on. */
    end: (): void => {
      ended = true;
      give();
    }
  };
};

export type TurnHolder = ReturnType<typeof createTurnHolder>;
