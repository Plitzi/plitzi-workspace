import clsx from 'clsx';
import { Fragment, use } from 'react';

import { momentsOf } from '../../helpers';
import { checkTitleOf, sentenceOf, sentenceText } from '../../studio/sentences';
import TestStudioContext from '../../studio/TestStudioContext';
import StepEditor from '../StepEditor';
import StudioStep from '../StudioStep';

import type { PlacedStep } from '../../helpers';
import type { StepPlay } from '../../studio/TestStudioContext';
import type { E2eStep } from '@plitzi/sdk-shared';

export type FlowStripProps = {
  steps: E2eStep[];
  plays: (StepPlay | undefined)[];
  /** What is wrong with a step as written, by its index: said on the step itself. */
  stepProblems?: ReadonlyMap<number, string[]>;
  /** The step open to be changed, if one is. */
  editing?: number;
  locked: boolean;
  nameOf: (target: string) => string;
  elements: { value: string; label: string }[];
  onPoint: (step: E2eStep | undefined) => void;
  onPlayTo: (index: number) => void;
  onEdit: (index: number) => void;
  onMove: (index: number, by: number) => void;
  onRemove: (index: number) => void;
  onDone: (index: number, step: E2eStep) => void;
};

/** A segment of the timeline: its step's kind as its colour, how it went as its fill. */
const segmentClass = (step: E2eStep, play: StepPlay | undefined): string => {
  const check = sentenceOf(step).check;
  if (play?.state === 'failed') {
    return 'bg-red-500';
  }

  if (play?.state === 'passed') {
    return check ? 'bg-emerald-500' : 'bg-primary-500';
  }

  if (play?.state === 'running' || play?.state === 'next') {
    return clsx('animate-pulse', check ? 'bg-emerald-400' : 'bg-primary-400');
  }

  return check ? 'bg-emerald-500/25' : 'bg-primary-500/25';
};

/**
 * A flow as it is read: its moments side by side — the page as it opens, then each thing done with what must hold once
 * it is, joined by arrows; when this, then that — each topped by a bar of its own steps, filled as they are played, red
 * where one failed, pressed to play up to it: the colour sits over the steps it stands for.
 */
const FlowStrip = (props: FlowStripProps) => {
  const { steps, plays, stepProblems, editing, locked, nameOf, elements } = props;
  const { onPoint, onPlayTo, onEdit, onMove, onRemove, onDone } = props;
  const titleOf = checkTitleOf(use(TestStudioContext).tests.unit ?? []);
  const moments = momentsOf(steps);
  const editingIn = (moment: (typeof moments)[number]) =>
    !locked &&
    editing !== undefined &&
    [...(moment.action ? [moment.action] : []), ...moment.checks].some(({ index }) => index === editing);
  // A step of the timeline: its kind as its colour, how it went as its fill — pressed, played up to it.
  const segment = ({ step, index }: PlacedStep) => (
    <button
      key={index}
      type="button"
      title={`${String(index + 1)}. ${sentenceText(step, nameOf, titleOf)}${locked ? '' : ' — press to play up to it'}`}
      disabled={locked}
      className={clsx(
        'h-full min-w-2 grow rounded-full transition-colors enabled:cursor-pointer',
        segmentClass(step, plays[index])
      )}
      onClick={() => onPlayTo(index)}
      onMouseEnter={() => onPoint(step)}
      onMouseLeave={() => onPoint(undefined)}
    />
  );
  const card = ({ step, index }: PlacedStep) =>
    editing === index && !locked ? (
      <StepEditor
        key={index}
        index={index}
        step={step}
        elements={elements}
        elementId={elements[0]?.value ?? ''}
        onDone={onDone}
        onRemove={onRemove}
      />
    ) : (
      <StudioStep
        key={index}
        index={index}
        count={steps.length}
        step={step}
        play={plays[index]}
        problems={stepProblems?.get(index)}
        nameOf={nameOf}
        locked={locked}
        onPoint={onPoint}
        onPlayTo={onPlayTo}
        onEdit={onEdit}
        onMove={onMove}
        onRemove={onRemove}
      />
    );

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex min-h-0 items-start gap-2 overflow-x-auto pb-1">
        {moments.map((moment, at) => (
          <Fragment key={moment.action?.index ?? 'opens'}>
            {/* Level with the cards: under each column's bar and the gap below it, at the middle of a step's card. */}
            {at > 0 && (
              <i className="fa-solid fa-arrow-right mt-[21px] shrink-0 text-xs text-zinc-400 dark:text-zinc-500" />
            )}
            {/* As wide as what it says, sharing what room there is: the columns fit the strip when their least does, and
                only past that does it scroll. A lone step needs less than one with its checks; the one being edited keeps
                room for its form. */}
            <section
              className={clsx(
                'flex max-w-104 flex-[1_1_auto] flex-col gap-1.5',
                editingIn(moment) ? 'min-w-88' : moment.checks.length > 0 ? 'min-w-60' : 'min-w-48'
              )}
              aria-label={
                moment.action ? `Step ${String(moment.action.index + 1)} and its checks` : 'The page as it opens'
              }
            >
              {/* The moment's own steps, in order, over the column that holds them: what the colour says is below it. */}
              <div className="flex h-1.5 shrink-0 gap-0.5" aria-label="Its steps, as played">
                {[...(moment.action ? [moment.action] : []), ...moment.checks].map(segment)}
              </div>
              {moment.action ? (
                <ol>{card(moment.action)}</ol>
              ) : (
                <span className="flex h-9 items-center gap-2 rounded-md border border-dashed border-gray-300 px-2.5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                  <i className="fa-solid fa-flag text-[11px] text-zinc-400" />
                  When the page opens
                </span>
              )}
              {moment.checks.length > 0 && (
                <ol className="ml-3 flex flex-col gap-1.5 border-l-2 border-emerald-500/40 pl-3">
                  <li className="text-[10px] font-semibold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
                    Then
                  </li>
                  {moment.checks.map(card)}
                </ol>
              )}
            </section>
          </Fragment>
        ))}
      </div>
    </div>
  );
};

export default FlowStrip;
