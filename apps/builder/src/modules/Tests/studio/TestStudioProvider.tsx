import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { use, useCallback, useMemo, useRef, useState } from 'react';

import { runE2eTest } from '@plitzi/sdk-authoring';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { SPACE_THEME_AREA, useTheme } from '@plitzi/sdk-shared/theme';
import AppContext from '@pmodules/App/AppContext';

import { createCanvasPage } from './canvasPage';
import { canvasRun, deviceOf, documentOf, needsServer, playOf, seconds, stateOf, toneOf } from './flowPlay';
import { checkTitleOf, sentenceText, stepElementOf } from './sentences';
import { clearSpotlight, spotlight } from './spotlight';
import { pauseBefore, STEP_DELAY_S, stepDelayOf } from './stepDelay';
import TestStudioContext from './TestStudioContext';
import usePlayJourney from './usePlayJourney';
import { elementNameOf, newE2eTest, withE2eTest } from '../helpers';
import useSaveSpaceTests from '../hooks/useSaveSpaceTests';

import type { PlayHooks } from './flowPlay';
import type { FlowState, PlayLogLine, StepPlay, StudioMode, TestStudioValue } from './TestStudioContext';
import type { E2eResult } from '@plitzi/sdk-authoring';
import type { E2eStep, E2eTest, SpaceTests } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

/** How long the canvas may take to be drawn again before a play gives up on it. */
const CANVAS_MS = 15_000;

const TestStudioProvider = ({ children }: { children: ReactNode }) => {
  const { previewMode, setPreviewMode, displayMode, setDisplayMode } = use(AppContext);
  const { setTheme } = useTheme(SPACE_THEME_AREA);
  const [[navigate, flat, definition]] = useBuilderStore(['navigation.navigate', 'schema.flat', 'schema.definition']);
  const [runtimeState, setRuntimeState] = useBuilderStore('runtime.state');
  const asJourney = usePlayJourney();
  const [schema] = useBuilderStore('schema');
  const store = useSaveSpaceTests();
  // The person's own, kept as the builder keeps its other preferences.
  const [storedDelay, setStoredDelay] = useStorage<number>('builder-state.tests.stepDelay', STEP_DELAY_S);
  const stepDelay = stepDelayOf(storedDelay);
  const delayRef = useRef(stepDelay);
  delayRef.current = stepDelay;
  const setStepDelay = useCallback((seconds: number) => setStoredDelay(stepDelayOf(seconds)), [setStoredDelay]);
  // The flow last chosen in this space, chosen again when the area opens — a reload included.
  const spaceKey = typeof definition.permanentUrl === 'string' ? definition.permanentUrl : '';
  const [lastFlow, setLastFlow] = useStorage<string>(`builder-state.tests.flow.${spaceKey}`, '');

  const [active, setActive] = useState(false);
  const [tests, setTests] = useState<SpaceTests>({});
  const [flow, setFlow] = useState<E2eTest>();
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<StudioMode>('idle');
  const [playingAll, setPlayingAll] = useState(false);
  const [paused, setPaused] = useState(false);
  const [checking, setChecking] = useState(false);
  const [plays, setPlays] = useState<(StepPlay | undefined)[]>([]);
  const [states, setStates] = useState<Partial<Record<string, FlowState>>>({});
  const [log, setLog] = useState<PlayLogLine[]>([]);
  const [outcome, setOutcome] = useState<{ ok: boolean; said: string }>();
  const [playedMs, setPlayedMs] = useState<number>();
  const [canvasKey, setCanvasKey] = useState(0);

  const flowRef = useRef<E2eTest | undefined>(undefined);
  const testsRef = useRef<SpaceTests>({});
  // The id the chosen flow is saved under: none for one not saved yet.
  const savedId = useRef<string | undefined>(undefined);
  const dirtyRef = useRef(false);
  const canvas = useRef<HTMLIFrameElement | null>(null);
  const awaitingCanvas = useRef<((iframe: HTMLIFrameElement) => void) | undefined>(undefined);
  const abort = useRef<AbortController | undefined>(undefined);
  const hold = useRef<{ paused: boolean; release?: () => void }>({ paused: false });
  // What the builder was before the area opened — the author's state, preview, device — put back when it closes.
  const before = useRef<{ state: typeof runtimeState; preview: boolean; device: typeof displayMode } | undefined>(
    undefined
  );
  const flatRef = useRef(flat);
  flatRef.current = flat;
  // The document as edited, for the element checks a journey holds — read when it plays, not a reason to play again.
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

  const setChosen = useCallback((next: E2eTest | undefined) => {
    flowRef.current = next;
    setFlow(next);
  }, []);
  const setChanged = useCallback((changed: boolean) => {
    dirtyRef.current = changed;
    setDirty(changed);
  }, []);
  const setList = useCallback((next: SpaceTests) => {
    testsRef.current = next;
    setTests(next);
  }, []);
  const playAt = useCallback(
    (index: number, play: StepPlay) =>
      setPlays(current => {
        const next = [...current];
        next[index] = play;

        return next;
      }),
    []
  );
  const stateAt = useCallback(
    (id: string, state: FlowState) => setStates(current => ({ ...current, [id]: state })),
    []
  );
  const logged = useCallback((line: PlayLogLine) => setLog(current => [...current, line]), []);

  /** Draws the canvas anew and answers it once it is mounted: the page a play starts on is fresh. */
  const freshCanvas = useCallback(
    () =>
      new Promise<HTMLIFrameElement>((resolve, reject) => {
        const late = setTimeout(() => {
          awaitingCanvas.current = undefined;
          reject(new Error('The page on the left did not show again in time: choose the journey again.'));
        }, CANVAS_MS);
        awaitingCanvas.current = iframe => {
          clearTimeout(late);
          resolve(iframe);
        };
        setRuntimeState({});
        setCanvasKey(key => key + 1);
      }),
    [setRuntimeState]
  );

  /** A flow opened on its page and device, as a new visitor: what choosing it shows before anything is played. */
  const openOnCanvas = useCallback(
    (opened: E2eTest) => {
      setDisplayMode(deviceOf(opened.width));
      setRuntimeState({});
      setCanvasKey(key => key + 1);
      navigate(opened.page);
    },
    [navigate, setDisplayMode, setRuntimeState]
  );

  /**
   * One flow played on a fresh canvas, as a new visitor: the state empty, the page drawn again — and none of the
   * editor's session, as the server plays it (`playingJourney`): a guest, or the flow's own account (`as`).
   */
  const playOnCanvas = useCallback(
    (played: E2eTest, hooks: PlayHooks): Promise<E2eResult> =>
      asJourney(async () => {
        // Its device first, then the page drawn anew in it: the canvas the run holds is the one it plays on.
        setDisplayMode(deviceOf(played.width));
        const iframe = await freshCanvas();
        const page = createCanvasPage({
          iframe,
          navigate,
          back: () => window.history.back(),
          resize: width => setDisplayMode(deviceOf(width)),
          // A flow that says nothing of the scheme plays on the canvas as it is: the person's choice is not overridden.
          scheme: scheme => {
            if (played.scheme) {
              setTheme(scheme);
            }
          }
        });

        // Its element checks as they stand in the area, saved or not.
        return runE2eTest(page, played, canvasRun(played, hooks, { ...schemaRef.current, tests: testsRef.current }));
      }),
    [asJourney, freshCanvas, navigate, setDisplayMode, setTheme]
  );

  /** A step played, as a line of the log. */
  const lineOf = useCallback(
    (played: E2eTest, index: number, step: { ok: boolean; read?: string }, started: number): PlayLogLine => {
      const said = sentenceText(
        played.steps[index],
        target => elementNameOf(flatRef.current, target),
        checkTitleOf(testsRef.current.unit ?? [])
      );

      return {
        at: Date.now() - started,
        flow: played.title || played.id,
        text: step.ok ? said : `${said} — ${step.read ?? ''}`,
        ok: step.ok
      };
    },
    []
  );

  const stop = useCallback(() => {
    abort.current?.abort();
    hold.current.paused = false;
    hold.current.release?.();
    setPaused(false);
  }, []);

  const choose = useCallback(
    (chosen: E2eTest | undefined, saved: string | undefined) => {
      stop();
      savedId.current = saved;
      setChosen(chosen);
      setChanged(saved === undefined && chosen !== undefined);
      setPlays([]);
      setOutcome(undefined);
      setChecking(false);
      setMode('idle');
      clearSpotlight(documentOf(canvas));
      if (chosen) {
        openOnCanvas(chosen);
      }

      if (saved !== undefined) {
        setLastFlow(saved);
      }
    },
    [openOnCanvas, setChanged, setChosen, setLastFlow, stop]
  );

  const enter = useCallback(
    (entered: SpaceTests) => {
      if (!before.current) {
        before.current = { state: runtimeState, preview: previewMode, device: displayMode };
      }

      setPreviewMode(true);
      setActive(true);
      setList(entered);
      setStates({});
      setLog([]);
      setPlayedMs(undefined);
      const list = entered.e2e ?? [];
      const first = list.find(each => each.id === lastFlow) ?? list.at(0);
      choose(first, first?.id);
    },
    [choose, displayMode, lastFlow, previewMode, runtimeState, setList, setPreviewMode]
  );

  const leave = useCallback(() => {
    stop();
    clearSpotlight(documentOf(canvas));
    setActive(false);
    setChosen(undefined);
    setMode('idle');
    setChecking(false);
    const kept = before.current;
    before.current = undefined;
    if (kept) {
      setRuntimeState(kept.state ?? {});
      setPreviewMode(kept.preview);
      setDisplayMode(kept.device);
    }
  }, [setChosen, setDisplayMode, setPreviewMode, setRuntimeState, stop]);

  const load = useCallback(
    (loaded: SpaceTests) => {
      setList(loaded);
      if (!dirtyRef.current && savedId.current !== undefined) {
        const again = loaded.e2e?.find(each => each.id === savedId.current);
        if (again) {
          setChosen(again);
        }
      }
    },
    [setChosen, setList]
  );

  const select = useCallback(
    (id: string) => {
      const chosen = testsRef.current.e2e?.find(each => each.id === id);
      if (chosen) {
        choose(chosen, id);
      }
    },
    [choose]
  );

  const create = useCallback(
    (page: string) => choose(newE2eTest(page, testsRef.current.e2e ?? []), undefined),
    [choose]
  );

  const edit = useCallback(
    (next: E2eTest) => {
      const was = flowRef.current;
      setChosen(next);
      setChanged(true);
      setPlays([]);
      setOutcome(undefined);
      if (was && (next.width !== was.width || next.page !== was.page)) {
        openOnCanvas(next);
      }
    },
    [openOnCanvas, setChanged, setChosen]
  );

  const add = useCallback(
    (step: E2eStep) => {
      const current = flowRef.current;
      if (!current) {
        return;
      }

      setChosen({ ...current, steps: [...current.steps, step] });
      setChanged(true);
      setOutcome(undefined);
      setChecking(false);
      spotlight(documentOf(canvas), stepElementOf(step), toneOf(step));
    },
    [setChanged, setChosen]
  );

  const record = useCallback((on: boolean) => {
    setMode(on ? 'recording' : 'idle');
    setChecking(false);
    setOutcome(undefined);
    clearSpotlight(documentOf(canvas));
  }, []);

  const check = useCallback((on: boolean) => setChecking(on), []);

  const play = useCallback(
    ({ stepping = false, until }: { stepping?: boolean; until?: number } = {}) => {
      const played = flowRef.current;
      if (!played) {
        return;
      }

      const server = needsServer(played);
      if (server) {
        setOutcome({
          ok: false,
          said: `This journey needs a browser of its own (${server}): press "Run on the server".`
        });
        stateAt(played.id, { state: 'server', why: server });

        return;
      }

      const controller = new AbortController();
      abort.current = controller;
      hold.current = { paused: stepping };
      setPaused(stepping);
      setMode('playing');
      setPlayingAll(false);
      setChecking(false);
      setOutcome(undefined);
      setPlayedMs(undefined);
      setLog([]);
      setPlays(played.steps.map(() => undefined));
      stateAt(played.id, { state: 'playing', played: 0 });
      const started = Date.now();

      const run = async () => {
        const result = await playOnCanvas(played, {
          signal: controller.signal,
          beforeStep: async (step, index) => {
            spotlight(documentOf(canvas), stepElementOf(step), toneOf(step));
            // Played up to the step pressed: held before the one after it, the page as it stands there.
            if (until !== undefined && index === until + 1) {
              hold.current.paused = true;
              setPaused(true);
            }

            if (hold.current.paused) {
              playAt(index, { state: 'next' });
              await new Promise<void>(resolve => {
                hold.current.release = resolve;
              });
              hold.current.release = undefined;
            }

            if (controller.signal.aborted) {
              return;
            }

            playAt(index, { state: 'running' });
            await pauseBefore(delayRef, index);
          },
          onStep: (_page, step, index) => {
            playAt(index, playOf(step));
            stateAt(played.id, { state: 'playing', played: index + 1 });
            logged(lineOf(played, index, step, started));
            if (!step.ok) {
              spotlight(documentOf(canvas), stepElementOf(played.steps[index]), 'failed');
            }

            return Promise.resolve(undefined);
          }
        });
        setPlays(result.steps.map(step => (step.notRun ? { state: 'notRun' } : playOf(step))));
        stateAt(played.id, stateOf(result));
        setPlayedMs(result.ms);
        const failedAt = result.steps.findIndex(step => !step.ok && step.notRun !== true);
        setOutcome(
          result.problem
            ? { ok: false, said: result.problem }
            : result.stopped
              ? { ok: false, said: 'Stopped. The page stays as the last step left it.' }
              : result.ok
                ? { ok: true, said: `Passed: ${String(result.steps.length)} steps in ${seconds(result.ms)}.` }
                : {
                    ok: false,
                    said: `Failed at step ${String(failedAt + 1)}: ${result.steps[failedAt]?.read ?? 'it did not hold'}.`
                  }
        );
        if (result.ok) {
          clearSpotlight(documentOf(canvas));
        }
      };

      void run()
        .catch((error: unknown) => {
          const said = error instanceof Error ? error.message : String(error);
          setOutcome({ ok: false, said });
          stateAt(played.id, { state: 'failed', read: said });
        })
        .finally(() => {
          abort.current = undefined;
          hold.current = { paused: false };
          setPaused(false);
          setMode('idle');
        });
    },
    [lineOf, logged, playAt, playOnCanvas, stateAt]
  );

  const playAll = useCallback(() => {
    const chosen = flowRef.current;
    // The flow chosen plays as it is being edited; the rest as saved.
    const list = (testsRef.current.e2e ?? []).map(each => (chosen && each.id === savedId.current ? chosen : each));
    const controller = new AbortController();
    abort.current = controller;
    hold.current = { paused: false };
    setMode('playing');
    setPlayingAll(true);
    setChecking(false);
    setOutcome(undefined);
    setPlayedMs(undefined);
    setLog([]);
    setPlays([]);
    setStates(
      Object.fromEntries(
        list.map((each): [string, FlowState] => {
          const server = needsServer(each);

          return [each.id, server ? { state: 'server', why: server } : { state: 'queued' }];
        })
      )
    );
    const started = Date.now();

    const run = async () => {
      let passed = 0;
      let failed = 0;
      for (const each of list) {
        if (needsServer(each)) {
          continue;
        }

        if (controller.signal.aborted) {
          stateAt(each.id, { state: 'stopped' });
          continue;
        }

        const isChosen = chosen?.id === each.id;
        stateAt(each.id, { state: 'playing', played: 0 });
        if (isChosen) {
          setPlays(each.steps.map(() => undefined));
        }

        const result = await playOnCanvas(each, {
          signal: controller.signal,
          beforeStep: async (step, index) => {
            spotlight(documentOf(canvas), stepElementOf(step), toneOf(step));
            if (isChosen) {
              playAt(index, { state: 'running' });
            }

            await pauseBefore(delayRef, index);
          },
          onStep: (_page, step, index) => {
            stateAt(each.id, { state: 'playing', played: index + 1 });
            if (isChosen) {
              playAt(index, playOf(step));
            }

            logged(lineOf(each, index, step, started));

            return Promise.resolve(undefined);
          }
        }).catch((error: unknown): E2eResult => ({
          id: each.id,
          title: each.title,
          ok: false,
          ms: 0,
          steps: [],
          problem: error instanceof Error ? error.message : String(error)
        }));
        stateAt(each.id, stateOf(result));
        if (result.ok) {
          passed += 1;
        } else if (!result.stopped) {
          failed += 1;
        }
      }

      clearSpotlight(documentOf(canvas));
      setPlayedMs(Date.now() - started);
      setOutcome(
        controller.signal.aborted
          ? { ok: false, said: 'Stopped.' }
          : failed === 0
            ? { ok: true, said: `${String(passed)} ${passed === 1 ? 'journey' : 'journeys'}. All pass.` }
            : { ok: false, said: `${String(failed)} of ${String(passed + failed)} journeys fail.` }
      );
    };

    void run().finally(() => {
      abort.current = undefined;
      setPlayingAll(false);
      setMode('idle');
    });
  }, [lineOf, logged, playAt, playOnCanvas, stateAt]);

  const pause = useCallback(() => {
    hold.current.paused = true;
    setPaused(true);
  }, []);
  const resume = useCallback(() => {
    hold.current.paused = false;
    setPaused(false);
    hold.current.release?.();
  }, []);
  const next = useCallback(() => hold.current.release?.(), []);

  const point = useCallback((step: E2eStep | undefined) => {
    if (step) {
      spotlight(documentOf(canvas), stepElementOf(step), toneOf(step));
    } else {
      clearSpotlight(documentOf(canvas));
    }
  }, []);

  const save = useCallback(async (): Promise<string | undefined> => {
    const current = flowRef.current;
    if (!current) {
      return undefined;
    }

    const saved = withE2eTest(testsRef.current, current, savedId.current ?? current.id);
    const answer = await store(saved);
    if (!answer.ok) {
      return answer.problem;
    }

    setList(saved);
    savedId.current = current.id;
    setChanged(false);

    return undefined;
  }, [setChanged, setList, store]);

  const discard = useCallback(() => {
    const list = testsRef.current.e2e ?? [];
    const kept = list.find(each => each.id === savedId.current) ?? list.at(0);
    choose(kept, kept?.id);
  }, [choose]);

  const remove = useCallback(
    async (id: string): Promise<string | undefined> => {
      const left = withE2eTest(testsRef.current, undefined, id);
      const answer = await store(left);
      if (!answer.ok) {
        return answer.problem;
      }

      setList(left);
      if (savedId.current === id) {
        const first = left.e2e?.at(0);
        choose(first, first?.id);
      }

      return undefined;
    },
    [choose, setList, store]
  );

  const attach = useCallback((iframe: HTMLIFrameElement | null) => {
    canvas.current = iframe;
    if (iframe && awaitingCanvas.current) {
      const answer = awaitingCanvas.current;
      awaitingCanvas.current = undefined;
      answer(iframe);
    }
  }, []);

  const value = useMemo<TestStudioValue>(
    () => ({
      active,
      tests,
      flow,
      dirty,
      mode,
      playingAll,
      paused,
      checking,
      plays,
      states,
      log,
      outcome,
      playedMs,
      canvasKey,
      stepDelay,
      setStepDelay,
      enter,
      leave,
      load,
      select,
      create,
      edit,
      add,
      record,
      check,
      play,
      playAll,
      pause,
      resume,
      next,
      stop,
      point,
      save,
      discard,
      remove,
      attach
    }),
    [
      active,
      add,
      attach,
      canvasKey,
      check,
      checking,
      create,
      dirty,
      discard,
      edit,
      enter,
      flow,
      leave,
      load,
      log,
      mode,
      next,
      outcome,
      pause,
      paused,
      play,
      playAll,
      playedMs,
      playingAll,
      plays,
      point,
      record,
      remove,
      resume,
      save,
      select,
      setStepDelay,
      stepDelay,
      states,
      stop,
      tests
    ]
  );

  return <TestStudioContext value={value}>{children}</TestStudioContext>;
};

export default TestStudioProvider;
