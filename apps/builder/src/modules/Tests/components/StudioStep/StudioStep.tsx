import clsx from 'clsx';
import { use, useCallback } from 'react';

import { checkTitleOf, sentenceOf } from '../../studio/sentences';
import TestStudioContext from '../../studio/TestStudioContext';

import type { StepPlay } from '../../studio/TestStudioContext';
import type { E2eStep } from '@plitzi/sdk-shared';

export type StudioStepProps = {
  index: number;
  count: number;
  step: E2eStep;
  /** How it went the last time the test was played; none before. */
  play?: StepPlay;
  /** What is wrong with it as written: marked, and said on it. */
  problems?: readonly string[];
  /** What a person calls the element it names. */
  nameOf: (target: string) => string;
  /** Editing and moving are off while the test plays or records. */
  locked: boolean;
  onPoint: (step: E2eStep | undefined) => void;
  /** Plays the flow from its start up to this step, and holds there: the page as it stands at it. */
  onPlayTo: (index: number) => void;
  onEdit: (index: number) => void;
  onMove: (index: number, by: number) => void;
  onRemove: (index: number) => void;
};

const StatusMark = ({ index, play, check }: { index: number; play?: StepPlay; check: boolean }) => {
  if (play?.state === 'running') {
    return <i className="fa-solid fa-spinner fa-spin text-primary-text text-xs" title="Playing" />;
  }

  if (play?.state === 'passed') {
    return <i className="fa-solid fa-check text-xs text-emerald-600 dark:text-emerald-400" title="Passed" />;
  }

  if (play?.state === 'failed') {
    return <i className="fa-solid fa-xmark text-xs text-red-600 dark:text-red-400" title="Failed" />;
  }

  return (
    <span
      className={clsx('font-mono text-[11px]', {
        'text-emerald-600 dark:text-emerald-400': check && play === undefined,
        'text-gray-400 dark:text-zinc-500': !check || play !== undefined
      })}
    >
      {index + 1}
    </span>
  );
};

/**
 * One step of the test open in the studio, as a sentence: what is done, or what is checked — its element a chip, its
 * value quoted — with how it went when played. Pointing at it lights its element in the canvas.
 */
const StudioStep = ({
  index,
  count,
  step,
  play,
  problems = [],
  nameOf,
  locked,
  onPoint,
  onPlayTo,
  onEdit,
  onMove,
  onRemove
}: StudioStepProps) => {
  const titleOf = checkTitleOf(use(TestStudioContext).tests.unit ?? []);
  const sentence = sentenceOf(step);
  const handleEnter = useCallback(() => onPoint(step), [onPoint, step]);
  const handleLeave = useCallback(() => onPoint(undefined), [onPoint]);
  const handleEdit = useCallback(() => onEdit(index), [index, onEdit]);
  const handlePlayTo = useCallback(() => onPlayTo(index), [index, onPlayTo]);
  const handleUp = useCallback(() => onMove(index, -1), [index, onMove]);
  const handleDown = useCallback(() => onMove(index, 1), [index, onMove]);
  const handleRemove = useCallback(() => onRemove(index), [index, onRemove]);

  return (
    <li
      className={clsx(
        'group relative flex flex-col gap-1 rounded-md border px-2 py-1.5 transition-colors duration-150',
        {
          'border-primary-ui bg-primary-50 dark:bg-primary-400/10': play?.state === 'running' || play?.state === 'next',
          'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40': play?.state === 'failed',
          'border-amber-400 bg-amber-50 dark:border-amber-700/70 dark:bg-amber-950/30':
            problems.length > 0 && play?.state !== 'failed',
          'border-gray-300 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60':
            play?.state !== 'running' && play?.state !== 'next' && play?.state !== 'failed' && problems.length === 0,
          'opacity-50': play?.state === 'notRun'
        }
      )}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div className="flex items-start gap-2">
        <span className="flex h-5 w-4 shrink-0 items-center justify-center">
          <StatusMark index={index} play={play} check={sentence.check} />
        </span>
        <i
          className={clsx(sentence.icon, 'mt-1 w-3.5 shrink-0 text-center text-[11px]', {
            'text-emerald-600 dark:text-emerald-400': sentence.check,
            'text-zinc-500 dark:text-zinc-400': !sentence.check
          })}
        />
        <p className="flex min-w-0 grow flex-wrap items-center gap-1 text-sm leading-5 text-zinc-800 dark:text-zinc-200">
          {sentence.parts.map((part, at) =>
            'element' in part ? (
              <span
                key={at}
                title={part.element}
                className="bg-primary-100 text-primary-700 dark:bg-primary-400/15 dark:text-primary-200 max-w-full truncate rounded px-1.5 text-xs leading-5 font-medium"
              >
                {nameOf(part.element)}
              </span>
            ) : 'value' in part ? (
              <span key={at} className="max-w-full font-medium break-words text-zinc-900 dark:text-zinc-50">
                “{part.value}”
              </span>
            ) : 'check' in part ? (
              <span
                key={at}
                title={`Element check ${part.check}`}
                className="max-w-full truncate rounded bg-emerald-100 px-1.5 text-xs leading-5 font-medium text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200"
              >
                {titleOf(part.check)}
              </span>
            ) : (
              <span key={at}>{part.text}</span>
            )
          )}
        </p>
        {play?.state === 'passed' && (
          <span className="shrink-0 pt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">
            {(play.ms / 1000).toFixed(1)} s
          </span>
        )}
        {!locked && (
          <span className="absolute top-1 right-1 flex gap-0.5 rounded-md border border-gray-300 bg-white p-0.5 opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-800">
            <button type="button" className={ICON} title="Play up to this step, and hold there" onClick={handlePlayTo}>
              <i className="fa-solid fa-play" />
            </button>
            <button type="button" className={ICON} title="Change this step" onClick={handleEdit}>
              <i className="fa-solid fa-pen" />
            </button>
            <button type="button" className={ICON} title="Move up" disabled={index === 0} onClick={handleUp}>
              <i className="fa-solid fa-arrow-up" />
            </button>
            <button
              type="button"
              className={ICON}
              title="Move down"
              disabled={index === count - 1}
              onClick={handleDown}
            >
              <i className="fa-solid fa-arrow-down" />
            </button>
            <button type="button" className={ICON} title="Remove this step" onClick={handleRemove}>
              <i className="fa-solid fa-trash" />
            </button>
          </span>
        )}
      </div>
      {problems.length > 0 && (
        <p className="flex gap-1.5 pl-6 text-xs text-amber-800 dark:text-amber-200">
          <i className="fa-solid fa-circle-exclamation mt-0.5 text-amber-500" />
          {problems.join(' ')}
        </p>
      )}
      {play?.state === 'failed' && <p className="pl-6 text-xs text-red-700 dark:text-red-300">{play.read}</p>}
      {play?.state === 'next' && <p className="text-primary-text pl-6 text-xs">Next: press “Next step” to play it.</p>}
    </li>
  );
};

const ICON =
  'flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[11px] text-zinc-500 hover:bg-gray-200 hover:text-zinc-900 disabled:cursor-default disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100';

export default StudioStep;
