import { useCallback, useEffect, useState } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

import type { FlowState } from '../studio/TestStudioContext';

/** A play of the journeys on the server, as it goes: each journey reached, the one playing now and the page after its step. */
export type ServerPlay = {
  run: string;
  /** How many journeys the run plays. */
  of: number;
  journeys: Partial<Record<string, FlowState>>;
  now: { test: string; at: number; played: number; steps: number; frame?: string };
  /** Its last journey ended: what the run answers is the report from here on. */
  ended: boolean;
};

/** A play heard of no more for this long is over: its server went away mid-run, and nothing else would say so. */
const QUIET_MS = 60_000;

/**
 * The journeys the server is playing on asking — this person's "Run on the server", someone else's, an agent's — heard
 * on the space's channel step by step (`SPACE_TESTS_PLAYING`). The latest run only: one plays at a time per space. `settle` ends it when the run's own answer arrives.
 */
const useServerPlay = (): { play?: ServerPlay; settle: () => void } => {
  const { subscriptionManager } = useBuilderNetwork();
  const [play, setPlay] = useState<ServerPlay>();

  useEffect(
    () =>
      subscriptionManager.subscribe('SPACE_TESTS_PLAYING', ({ run, test, at, of, played, steps, ok, ended, frame }) =>
        setPlay(current => {
          const same = current?.run === run ? current : undefined;
          const state: FlowState = ended
            ? ok
              ? { state: 'passed', ms: 0, steps }
              : { state: 'failed', read: 'It failed on the server: open its run to see the step.' }
            : { state: 'playing', played };
          // A journey's closing word carries no picture: the one after its last step stays.
          const kept = frame ?? (same?.now.test === test ? same.now.frame : undefined);

          return {
            run,
            of,
            journeys: { ...same?.journeys, [test]: state },
            now: { test, at, played, steps, ...(kept ? { frame: kept } : {}) },
            ended: ended === true && at === of - 1
          };
        })
      ),
    [subscriptionManager]
  );

  const settle = useCallback(
    () => setPlay(current => (current && !current.ended ? { ...current, ended: true } : current)),
    []
  );

  useEffect(() => {
    if (!play || play.ended) {
      return;
    }

    const quiet = setTimeout(settle, QUIET_MS);

    return () => clearTimeout(quiet);
  }, [play, settle]);

  return { play, settle };
};

export default useServerPlay;
