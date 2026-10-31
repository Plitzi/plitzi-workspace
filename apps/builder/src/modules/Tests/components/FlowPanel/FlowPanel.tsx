import Button from '@plitzi/plitzi-ui/Button';
import IconGroup from '@plitzi/plitzi-ui/IconGroup';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import clsx from 'clsx';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getPageFullPath } from '@plitzi/sdk-navigation';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import {
  elementNameOf,
  elementOptions,
  emptyOf,
  moved,
  flowProblemsOf,
  STEP_KINDS,
  stepKindOf,
  stepOf
} from '../../helpers';
import useMayTest from '../../hooks/useMayTest';
import TestStudioContext from '../../studio/TestStudioContext';
import FlowStrip from '../FlowStrip';
import StartState from '../StartState';

import type { E2eStep } from '@plitzi/sdk-shared';

const DEVICES = [
  { width: 390, icon: 'fas fa-mobile-alt', title: 'Phone · 390 px' },
  { width: 768, icon: 'fas fa-tablet-alt', title: 'Tablet · 768 px' },
  { width: 1440, icon: 'fas fa-desktop', title: 'Desktop · 1440 px' }
];

export type FlowPanelProps = {
  /** What the server said is wrong with the tests as written: the flow chosen says its own. */
  problems: readonly string[];
  /** The flow chosen, or every flow played in turn — its log, and what came of it. */
  view: 'steps' | 'run';
  onView: (view: 'steps' | 'run') => void;
  /** Says why a save was refused, or nothing once it was kept. */
  onSaved: (problem: string | undefined) => void;
};

/**
 * The flow chosen, below the page and the list: what plays, records and keeps it, then its steps in words — each
 * pointed at lights its element on the page, each pressed plays the flow up to it. While every flow plays in turn, the
 * log of their steps; once they have, what came of it in a line.
 */
const FlowPanel = ({ problems, view, onView, onSaved }: FlowPanelProps) => {
  const studio = use(TestStudioContext);
  const { flow, dirty, mode, playingAll, paused, checking, plays, log, outcome, playedMs, tests } = studio;
  const { edit, play, pause, resume, next, stop, record, check, point, save, discard, stepDelay, setStepDelay } =
    studio;
  const [[flat, pageDefinitions, pageFolders]] = useBuilderStore([
    'schema.flat',
    'pageDefinitions',
    'schema.pageFolders'
  ]);
  const [editing, setEditing] = useState<number>();
  const [saving, setSaving] = useState(false);
  const logRef = useRef<HTMLOListElement>(null);
  const elements = useMemo(() => elementOptions(flat), [flat]);
  const pages = useMemo(
    () => Object.keys(pageDefinitions).map(id => getPageFullPath(pageDefinitions, pageFolders, id, true)),
    [pageDefinitions, pageFolders]
  );
  const nameOf = useCallback((target: string) => elementNameOf(flat, target), [flat]);
  const { mayTest } = useMayTest();
  // Played by anyone; written only by whoever may write the tests — for the rest, every field reads as it is.
  const locked = mode !== 'idle' || !mayTest;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log.length]);

  const steps = useMemo(() => flow?.steps ?? [], [flow]);
  // What is wrong with the flow, each where it is fixed: where it starts, its device, a step — or the flow itself.
  const placed = useMemo(() => (flow ? flowProblemsOf(problems, flow.id) : undefined), [flow, problems]);
  const setSteps = useCallback((next: E2eStep[]) => flow && edit({ ...flow, steps: next }), [edit, flow]);
  const handleTitle = useCallback((title: string) => flow && edit({ ...flow, title }), [edit, flow]);
  const handlePage = useCallback((page: string) => flow && edit({ ...flow, page }), [edit, flow]);
  const handleGiven = useCallback(
    (state: Record<string, unknown> | undefined) => {
      if (!flow) {
        return;
      }

      const { given: _given, ...rest } = flow;
      edit(state ? { ...rest, given: { state } } : rest);
    },
    [edit, flow]
  );
  const handleWidth = useCallback((width: number) => () => flow && edit({ ...flow, width }), [edit, flow]);
  // Who it plays as: a guest, or one of the space's test accounts (`as`).
  const handleAs = useCallback(
    (as: string) => {
      if (!flow) {
        return;
      }

      const { as: _as, ...rest } = flow;
      edit(as ? { ...rest, as } : rest);
    },
    [edit, flow]
  );
  const handlePlay = useCallback(() => play(), [play]);
  const handleStepping = useCallback(() => play({ stepping: true }), [play]);
  const handlePlayTo = useCallback((index: number) => play({ until: index }), [play]);
  const handleRecord = useCallback(() => record(mode !== 'recording'), [mode, record]);
  const handleCheck = useCallback(() => check(!checking), [check, checking]);
  const handleDone = useCallback(
    (index: number, step: E2eStep) => {
      setSteps(steps.map((each, at) => (at === index ? step : each)));
      setEditing(undefined);
    },
    [setSteps, steps]
  );
  const handleMove = useCallback((index: number, by: number) => setSteps(moved(steps, index, by)), [setSteps, steps]);
  const handleRemove = useCallback(
    (index: number) => {
      setSteps(steps.filter((_, at) => at !== index));
      setEditing(undefined);
      point(undefined);
    },
    [point, setSteps, steps]
  );
  const handleAddByHand = useCallback(
    (kind: string) => {
      const spec = stepKindOf(kind);
      if (spec) {
        setSteps([...steps, stepOf(emptyOf(kind, spec, elements[0]?.value ?? '', studio.tests.unit?.[0]?.id))]);
        setEditing(steps.length);
      }
    },
    [elements, setSteps, steps, studio.tests.unit]
  );
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      onSaved(await save());
    } finally {
      setSaving(false);
    }
  }, [onSaved, save]);
  const handleShowSteps = useCallback(() => onView('steps'), [onView]);
  // Words as the person types them: a number of seconds, none below 0 — what is not a number yet is left as it was.
  const handleDelay = useCallback(
    (text: string) => {
      const seconds = Number.parseFloat(text.replace(',', '.'));
      if (Number.isFinite(seconds)) {
        setStepDelay(seconds);
      }
    },
    [setStepDelay]
  );

  const status = checking
    ? { said: 'Click what must show on the page', tone: 'check' }
    : mode === 'recording'
      ? { said: 'Recording · use the page above', tone: 'record' }
      : mode === 'playing'
        ? { said: paused ? 'Held' : 'Playing', tone: 'play' }
        : outcome
          ? { said: outcome.ok ? 'Passed' : 'Failed', tone: outcome.ok ? 'check' : 'record' }
          : { said: dirty ? 'Not saved' : 'Ready', tone: 'idle' };

  return (
    <section
      aria-label="The journey chosen"
      className={clsx(
        'flex shrink-0 flex-col overflow-hidden rounded-lg border border-gray-300 dark:border-zinc-700',
        // As tall as what it holds, up to a share of the room — the page above keeps the rest; the log of every flow a
        // fixed height, as it grows while it is read.
        view === 'run' ? 'h-[42%] min-h-64' : 'max-h-[46%] min-h-44'
      )}
    >
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-300 px-3 py-2 dark:border-zinc-700">
        {view === 'steps' && flow ? (
          <>
            <div className="min-w-56 grow basis-0">
              <Input
                size="sm"
                name="title"
                aria-label="What it checks"
                placeholder="What it checks: a visitor orders a loaf on their phone"
                value={flow.title}
                disabled={locked}
                onChange={handleTitle}
              />
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{steps.length} steps · starts on</span>
            <span
              className={clsx('flex items-center gap-1.5 rounded-md', {
                'ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900': placed?.page.length
              })}
              title={placed?.page.join(' ')}
            >
              {placed?.page.length ? <i className="fa-solid fa-circle-exclamation pl-1 text-amber-500" /> : null}
              <Select
                size="sm"
                name="page"
                aria-label="Starts on"
                value={flow.page}
                disabled={locked}
                onChange={handlePage}
              >
                {[...new Set([flow.page, ...pages])].map(page => (
                  <option key={page} value={page}>
                    {page}
                  </option>
                ))}
              </Select>
            </span>
            <IconGroup
              gap={4}
              className={clsx('h-8', {
                'rounded-md ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900':
                  placed?.device.length
              })}
            >
              {DEVICES.map(device => (
                <IconGroup.Icon
                  key={device.width}
                  icon={device.icon}
                  title={device.title}
                  cursor={locked ? 'disabled' : 'pointer'}
                  active={(flow.width ?? 1440) === device.width}
                  onClick={locked ? undefined : handleWidth(device.width)}
                />
              ))}
            </IconGroup>
            <Select
              size="sm"
              name="as"
              aria-label="Plays as"
              title="Who it plays as: a guest, or a test account signed in"
              value={flow.as ?? ''}
              disabled={locked}
              onChange={handleAs}
            >
              <option value="">As a guest</option>
              {(tests.accounts ?? []).map(account => (
                <option key={account.id} value={account.id}>
                  As {account.id}
                </option>
              ))}
            </Select>
          </>
        ) : (
          <>
            <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {view === 'run' ? 'Every journey, in turn' : 'No journey chosen'}
            </span>
            {view === 'run' && (
              <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">— each as a new visitor</span>
            )}
          </>
        )}
        <span
          className={clsx('ml-auto flex shrink-0 items-center gap-1.5 text-xs font-medium', {
            'text-red-600 dark:text-red-400': status.tone === 'record',
            'text-emerald-600 dark:text-emerald-400': status.tone === 'check',
            'text-primary-700 dark:text-primary-200': status.tone === 'play',
            'text-zinc-500 dark:text-zinc-400': status.tone === 'idle'
          })}
        >
          {(mode !== 'idle' || checking) && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
          {status.said}
        </span>
        {view === 'run' && playingAll && (
          <Button iconPlacement="before" size="xs" intent="secondary" onClick={stop}>
            <Button.Icon icon="fa-solid fa-stop" />
            Stop
          </Button>
        )}
        {view === 'run' && !playingAll && (
          <Button size="xs" intent="secondary" onClick={handleShowSteps}>
            Back to the journey
          </Button>
        )}
      </header>
      {view === 'steps' && flow && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-gray-300 px-3 py-2 dark:border-zinc-700">
          {mode === 'playing' ? (
            <>
              {paused ? (
                <>
                  <Button iconPlacement="before" size="xs" onClick={resume}>
                    <Button.Icon icon="fa-solid fa-play" />
                    Continue
                  </Button>
                  <Button iconPlacement="before" size="xs" intent="secondary" onClick={next}>
                    <Button.Icon icon="fa-solid fa-forward-step" />
                    Next step
                  </Button>
                </>
              ) : (
                <Button iconPlacement="before" size="xs" intent="secondary" onClick={pause}>
                  <Button.Icon icon="fa-solid fa-pause" />
                  Pause
                </Button>
              )}
              <Button iconPlacement="before" size="xs" intent="secondary" onClick={stop}>
                <Button.Icon icon="fa-solid fa-stop" />
                Stop
              </Button>
            </>
          ) : (
            <>
              <Button
                iconPlacement="before"
                size="xs"
                disabled={steps.length === 0 || mode === 'recording'}
                title="Play every step on the page, as a new visitor"
                onClick={handlePlay}
              >
                <Button.Icon icon="fa-solid fa-play" />
                Play
              </Button>
              <Button
                iconPlacement="before"
                size="xs"
                intent="secondary"
                disabled={steps.length === 0 || mode === 'recording'}
                title="Play one step at a time"
                onClick={handleStepping}
              >
                <Button.Icon icon="fa-solid fa-forward-step" />
                Step by step
              </Button>
            </>
          )}
          <label
            className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300"
            title="How long a play waits between two steps, so each can be seen working on the page. 0 plays them at once."
          >
            <i className="fa-solid fa-stopwatch text-zinc-400" />
            Pause
            <span className="w-18">
              <Input
                size="xs"
                type="number"
                name="stepDelay"
                aria-label="Pause between steps, in seconds"
                min={0}
                step={0.05}
                value={String(stepDelay)}
                onChange={handleDelay}
              />
            </span>
            s
          </label>
          <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-zinc-700" />
          <Button
            iconPlacement="before"
            size="xs"
            intent="secondary"
            disabled={mode === 'playing' || !mayTest}
            title={mode === 'recording' ? 'Stop recording' : 'Add steps by using the page'}
            onClick={handleRecord}
          >
            <Button.Icon
              icon={mode === 'recording' ? 'fa-solid fa-square' : 'fa-solid fa-circle'}
              className="text-red-500"
            />
            {mode === 'recording' ? 'Stop recording' : 'Record'}
          </Button>
          <Button
            iconPlacement="before"
            size="xs"
            intent={checking ? 'primary' : 'secondary'}
            disabled={mode === 'playing' || !mayTest}
            title="Click something on the page that must show"
            onClick={handleCheck}
          >
            <Button.Icon icon="fa-solid fa-circle-check" />
            {checking ? 'Pick on the page…' : 'Add a check'}
          </Button>
          {!locked && (
            <div className="w-52">
              <Select size="xs" name="add" value="" aria-label="Add a step by hand" onChange={handleAddByHand}>
                <option value="">+ Add a step by hand…</option>
                {Object.entries(STEP_KINDS).map(([kind, each]) => (
                  <option key={kind} value={kind}>
                    {each.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <span className="grow" />
          <Button size="xs" intent="secondary" disabled={!dirty || locked} onClick={discard}>
            Discard
          </Button>
          <Button size="xs" disabled={!dirty || saving || locked} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}
      {view === 'run' ? (
        <div className="flex min-h-0 grow">
          {!playingAll && outcome && (
            <div className="flex w-[40%] shrink-0 flex-col justify-center gap-2 border-r border-gray-300 px-6 dark:border-zinc-700">
              <span
                className={clsx('text-4xl leading-tight font-semibold tracking-tight', {
                  'text-zinc-900 dark:text-zinc-50': outcome.ok,
                  'text-red-600 dark:text-red-400': !outcome.ok
                })}
              >
                {outcome.said}
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {log.length} steps in {((playedMs ?? 0) / 1000).toFixed(1)} s, on the draft, each journey as a new
                visitor.
              </span>
            </div>
          )}
          <ol
            ref={logRef}
            className="flex grow flex-col gap-0.5 overflow-y-auto px-4 py-2 font-mono text-[11px] leading-4"
          >
            {log.length === 0 && <li className="text-zinc-400">Waiting for the first step…</li>}
            {log.map((line, at) => (
              <li key={at} className="flex flex-col">
                {line.flow !== log[at - 1]?.flow && (
                  <span className="text-primary-700 dark:text-primary-300 mt-1.5 truncate font-sans text-xs font-medium first:mt-0">
                    {line.flow}
                  </span>
                )}
                <span className="flex gap-2">
                  <span className="w-10 shrink-0 text-right text-zinc-400">{(line.at / 1000).toFixed(1)}</span>
                  <span
                    className={line.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
                  >
                    {line.ok ? '✓' : '✗'}
                  </span>
                  <span className={line.ok ? 'text-zinc-700 dark:text-zinc-300' : 'text-red-700 dark:text-red-300'}>
                    {line.text}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : flow ? (
        <div className="flex min-h-0 grow">
          <div className="flex min-w-0 grow flex-col gap-2 overflow-y-auto px-3 py-3">
            {outcome && (
              <div
                role="status"
                className={clsx('rounded-md px-2.5 py-1.5 text-xs', {
                  'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200': outcome.ok,
                  'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200': !outcome.ok
                })}
              >
                {outcome.said}
              </div>
            )}
            {placed && placed.page.length + placed.device.length + placed.other.length > 0 && (
              <div
                role="status"
                className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100"
              >
                <i className="fa-solid fa-circle-exclamation mt-0.5 text-amber-500" />
                <ul className="flex flex-col gap-0.5">
                  {placed.page.map(said => (
                    <li key={said}>
                      <b className="font-semibold">Starts on {flow.page}:</b> {said} Choose one of its pages above.
                    </li>
                  ))}
                  {placed.device.map(said => (
                    <li key={said}>
                      <b className="font-semibold">Device:</b> {said} Choose a phone, a tablet or a desktop above.
                    </li>
                  ))}
                  {placed.other.map(said => (
                    <li key={said}>{said}</li>
                  ))}
                  <li className="text-amber-700 dark:text-amber-300">A snapshot waits until it is fixed.</li>
                </ul>
              </div>
            )}
            {mode === 'playing' && paused && (
              <div
                role="status"
                className="bg-primary-50 text-primary-700 dark:bg-primary-400/10 dark:text-primary-200 rounded-md px-2.5 py-1.5 text-xs"
              >
                Held here: the page above is as this step leaves it. Next step plays one more; Continue plays the rest.
              </div>
            )}
            <StartState state={flow.given?.state} locked={locked} onChange={handleGiven} />
            {steps.length === 0 ? (
              <div className="flex flex-col items-center gap-1 rounded-md border border-dashed border-gray-300 px-4 py-6 text-center dark:border-zinc-700">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">No steps yet</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Press <b>Record</b> and use the page as a visitor would, then <b>Add a check</b> and click what must
                  show.
                </span>
              </div>
            ) : (
              <FlowStrip
                stepProblems={placed?.steps}
                steps={steps}
                plays={plays}
                editing={editing}
                locked={locked}
                nameOf={nameOf}
                elements={elements}
                onPoint={point}
                onPlayTo={handlePlayTo}
                onEdit={setEditing}
                onMove={handleMove}
                onRemove={handleRemove}
                onDone={handleDone}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex grow items-center justify-center px-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Choose a journey to see it played on the page — or start a new one and write it by using the page.
        </div>
      )}
    </section>
  );
};

export default FlowPanel;
