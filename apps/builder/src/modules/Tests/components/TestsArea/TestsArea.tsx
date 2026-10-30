import Button from '@plitzi/plitzi-ui/Button';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import clsx from 'clsx';
import { use, useCallback, useMemo, useState } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

import { problemsOfKind, testsNeedingLook } from '../../helpers';
import TestStudioContext from '../../studio/TestStudioContext';
import AreaStats from '../AreaStats';
import CanvasPane from '../CanvasPane';
import FlowList from '../FlowList';
import FlowPanel from '../FlowPanel';
import GateCard from '../GateCard';

import type { TSpaceRunE2eTestsMutation, TSpaceTests } from '@plitzi/sdk-shared/network';

export type TestsAreaProps = {
  externalStyle: string;
  answer?: TSpaceTests;
  /** What is wrong with the tests as written, read against the document being edited. */
  problems: readonly string[];
  serverRun?: TSpaceRunE2eTestsMutation;
  serverRunning: boolean;
  onRunOnServer: () => void;
  onViewServerRun: (id: string) => void;
  onChecks: () => void;
};

/** Today in the builder's own words: the draft is what is played, on the day it is played (UTC). */
const today = (): string =>
  new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * The space's flows, played on its page (RFC 0031): the page live on the left, the flows on the right — each with how it
 * went — and the flow chosen below, step by step. What is pressed on the right is played on the left; what is done on
 * the left, recorded, is written on the right. Above, where things stand: what is playing, and the numbers that count.
 */
const TestsArea = ({
  externalStyle,
  answer,
  problems,
  serverRun,
  serverRunning,
  onRunOnServer,
  onViewServerRun,
  onChecks
}: TestsAreaProps) => {
  const studio = use(TestStudioContext);
  const { tests, flow, dirty, mode, playingAll, paused, checking, plays, states, log, playedMs, outcome } = studio;
  const { select, create, remove, playAll, stop } = studio;
  const { showDialog } = useModal();
  const [definition] = useBuilderStore('schema.definition');
  const [view, setView] = useState<'steps' | 'run'>('steps');
  const [problem, setProblem] = useState<string>();
  const spaceName = typeof definition.name === 'string' && definition.name ? definition.name : 'This space';

  const flows = useMemo(() => tests.e2e ?? [], [tests]);
  const passing = flows.filter(each => states[each.id]?.state === 'passed').length;
  const unitTotal = (answer?.unitPassed ?? 0) + (answer?.unitFailed ?? 0);
  const running = plays.findIndex(each => each?.state === 'running' || each?.state === 'next');
  const playingFlow = flows.find(each => states[each.id]?.state === 'playing');

  const leaveUnsaved = useCallback(
    async () =>
      !dirty ||
      showDialog(
        <Modal.Header>
          <h4>Leave the journey without saving?</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="px-3 py-2">
            <h4>“{flow?.title || 'This journey'}” has changes that are not saved. They are lost if you leave it.</h4>
          </div>
        </Modal.Body>
      ),
    [dirty, flow?.title, showDialog]
  );
  const handleSelect = useCallback(
    async (id: string) => {
      if (await leaveUnsaved()) {
        setView('steps');
        select(id);
      }
    },
    [leaveUnsaved, select]
  );
  const handleCreate = useCallback(async () => {
    if (await leaveUnsaved()) {
      setView('steps');
      create(flow?.page ?? '/');
    }
  }, [create, flow?.page, leaveUnsaved]);
  const handleRemove = useCallback(
    async (id: string) => {
      const title = flows.find(each => each.id === id)?.title || id;
      const sure = await showDialog(
        <Modal.Header>
          <h4>Remove the journey</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="px-3 py-2">
            <h4>“{title}” stops being played at the next snapshot. Remove it?</h4>
          </div>
        </Modal.Body>
      );
      if (sure) {
        setProblem(await remove(id));
      }
    },
    [flows, remove, showDialog]
  );
  const handlePlayAll = useCallback(() => {
    setView('run');
    playAll();
  }, [playAll]);

  // What is happening, in a line: the builder's own way of saying what a terminal would print.
  const now = checking
    ? 'Click what must show on the page: its words become a check.'
    : mode === 'recording'
      ? `Recording “${flow?.title || 'a new journey'}”: each click and each thing typed on the page becomes a step.`
      : playingAll
        ? `Playing every journey in turn${playingFlow ? ` · “${playingFlow.title || playingFlow.id}”` : ''}`
        : mode === 'playing'
          ? `${paused ? 'Held at' : 'Playing'} “${flow?.title || 'the journey'}” · step ${String(Math.max(running, 0) + 1)} of ${String(flow?.steps.length ?? 0)}`
          : outcome
            ? outcome.said
            : 'Choose a journey to see it on the page, or play them all.';

  return (
    <div className="flex min-h-0 grow flex-col gap-4 overflow-hidden px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{spaceName}</span>
          <i className="fa-solid fa-chevron-right text-[9px] text-zinc-400" />
          <span
            className={clsx('flex min-w-0 items-center gap-2 truncate', {
              'text-zinc-700 dark:text-zinc-300': mode === 'idle' && !checking,
              'text-primary-700 dark:text-primary-200': mode === 'playing',
              'text-red-600 dark:text-red-400': mode === 'recording' || checking
            })}
          >
            {(mode !== 'idle' || checking) && (
              <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-current" />
            )}
            <span className="truncate">{now}</span>
          </span>
        </div>
        <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">Draft · {today()}</span>
        <Button size="sm" intent="secondary" disabled={serverRunning || flows.length === 0} onClick={onRunOnServer}>
          {serverRunning ? 'Playing on the server…' : 'Run on the server'}
        </Button>
        {/* Every flow played in turn is stopped where it was started: the rest are said as stopped. */}
        {playingAll ? (
          <Button iconPlacement="before" size="sm" intent="secondary" title="Stop playing the journeys" onClick={stop}>
            <Button.Icon icon="fa-solid fa-stop" />
            Stop
          </Button>
        ) : (
          <Button
            iconPlacement="before"
            size="sm"
            disabled={mode !== 'idle' || flows.length === 0}
            onClick={handlePlayAll}
          >
            <Button.Icon icon="fa-solid fa-play" />
            Play all
          </Button>
        )}
      </div>
      <AreaStats
        stats={[
          {
            value: String(passing),
            of: `/${String(flows.length)}`,
            label: 'Journeys pass',
            ...(flows.some(each => states[each.id]?.state === 'failed')
              ? { tone: 'bad' as const }
              : passing > 0 && passing === flows.length
                ? { tone: 'good' as const }
                : {})
          },
          { value: String(log.length), label: 'Steps played' },
          {
            value: String(answer?.unitPassed ?? 0),
            of: `/${String(unitTotal)}`,
            label: 'Element checks pass',
            ...(answer && answer.unitFailed > 0 ? { tone: 'bad' as const } : {})
          },
          {
            value: playedMs === undefined ? '—' : (playedMs / 1000).toFixed(1),
            ...(playedMs === undefined ? {} : { of: ' s' }),
            label: 'Last play'
          }
        ]}
      />
      {/* The page and the flow chosen, one above the other; the flows beside them, the whole height. */}
      <div className="flex min-h-0 grow gap-4">
        <div className="flex min-w-0 grow flex-col gap-4">
          <CanvasPane externalStyle={externalStyle} />
          <FlowPanel problems={problems} view={view} onView={setView} onSaved={setProblem} />
        </div>
        <div className="flex w-96 shrink-0 flex-col gap-4">
          <FlowList
            serverRun={serverRun}
            problems={problems}
            onSelect={handleSelect}
            onCreate={handleCreate}
            onRemove={handleRemove}
            onViewServerRun={onViewServerRun}
          />
          <GateCard
            ready={passing + (answer?.unitPassed ?? 0)}
            total={flows.length + unitTotal}
            flowsNeedLook={testsNeedingLook(problems, 'e2e')}
            checksNeedLook={problemsOfKind(problems, 'unit').length + (answer?.unitFailed ?? 0)}
            onChecks={onChecks}
            onShowFlow={handleSelect}
          />
          {problem && <p className="text-xs text-red-600 dark:text-red-400">{problem}</p>}
        </div>
      </div>
    </div>
  );
};

export default TestsArea;
