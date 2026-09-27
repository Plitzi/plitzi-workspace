import { use, useCallback, useMemo } from 'react';

import { RootElement, useElement, usePlitziServiceContext } from '@plitzi/plitzi-sdk';

import './StickyStack.css';

import declaration from './declaration';

import type { InteractionCallback } from '@plitzi/plitzi-sdk';
import type { KeyboardEvent, PointerEvent } from 'react';

export type StickyStackProps = {
  /**
   * The pads, as paper colour names, comma-separated — none where a note is made some other way (a sticky tool) and
   * only the pile is wanted. The first colour, or yellow, is the pile's paper.
   */
  colors?: string;
  /** Also offer a whole pile, to put on the board for everyone to take notes from. */
  pile?: boolean | string;
  className?: string;
};

const TRIGGERS: Record<string, InteractionCallback> = declaration.triggers;

const NAMES: Record<string, string> = {
  yellow: 'Yellow',
  red: 'Pink',
  orange: 'Orange',
  green: 'Green',
  blue: 'Blue',
  violet: 'Violet'
};

/**
 * The pads. Each is a button: pressed with a pointer it hands the note over at once, so a drag carries it straight
 * onto the board; pressed with Enter or Space it hands it over the same way, and the board places it on the next click.
 */
const StickyStack = ({ colors = 'yellow', pile = true, className }: StickyStackProps) => {
  const { id } = useElement();
  const {
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use(InteractionsContext);
  const pads = useMemo(
    () =>
      colors
        .split(',')
        .map(colour => colour.trim())
        .filter(colour => Object.hasOwn(NAMES, colour)),
    [colors]
  );

  const pick = useCallback(
    (fill: string, kind: string) =>
      void interactionsManager.interactionTrigger(id, declaration.triggers.onPick.action, { fill, kind }),
    [id, interactionsManager]
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return;
      }

      // No focus, no text selection: the pointer is about to carry a note, not press a button.
      event.preventDefault();
      pick(event.currentTarget.value, event.currentTarget.dataset.kind ?? 'sticky');
    },
    [pick]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        pick(event.currentTarget.value, event.currentTarget.dataset.kind ?? 'sticky');
      }
    },
    [pick]
  );

  return (
    <RootElement
      className={className ? `sticky-stack ${className}` : 'sticky-stack'}
      interactionTriggers={TRIGGERS}
      interactionCallbacks={{}}
    >
      {pads.map(colour => (
        <button
          key={colour}
          type="button"
          value={colour}
          className="sticky-stack__pad"
          data-paper={colour}
          data-kind="sticky"
          title={`${NAMES[colour]} sticky — drag it onto the board`}
          aria-label={`${NAMES[colour]} sticky note`}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
        />
      ))}
      {(pile === true || pile === 'true') && (
        <button
          type="button"
          value={pads[0] ?? 'yellow'}
          className="sticky-stack__pad sticky-stack__pile"
          data-paper={pads[0] ?? 'yellow'}
          data-kind="stack"
          title="A pile of notes — put it on the board for everyone to take from"
          aria-label="Pile of sticky notes"
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
        >
          <span className="sticky-stack__count" aria-hidden="true">
            ∞
          </span>
        </button>
      )}
    </RootElement>
  );
};

export default StickyStack;
