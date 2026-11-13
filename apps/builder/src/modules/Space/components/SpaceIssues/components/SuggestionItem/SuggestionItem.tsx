import clsx from 'clsx';

import { MUTED } from '../../helpers';
import ElementChip from '../ElementChip';
import Message from '../Message';

import type { TSpaceSuggestion } from '@plitzi/sdk-shared/network';

/** Past this, the rest of the elements it is about are counted rather than listed. */
const SHOWN_ELEMENTS = 4;

export type SuggestionItemProps = {
  suggestion: TSpaceSuggestion;
  /** Called once an element is on screen, so whatever holds the list can get out of the way. */
  onDismiss: () => void;
};

/**
 * One shorter way to the same page, in its code's group: what it is, what taking it saves, and the elements it is
 * about — the copies of a header, the buttons holding a text — each a link to it. The short way is the group's.
 */
const SuggestionItem = ({ suggestion, onDismiss }: SuggestionItemProps) => {
  const { message, saves, elementIds } = suggestion;
  const hidden = elementIds.length - SHOWN_ELEMENTS;

  return (
    <li className="flex flex-col gap-1 border-t border-zinc-100 py-2 first:border-t-0 dark:border-zinc-800">
      <Message text={message} />
      <div className="flex flex-wrap items-center gap-1">
        {elementIds.slice(0, SHOWN_ELEMENTS).map(elementId => (
          <ElementChip key={elementId} elementId={elementId} onDismiss={onDismiss} />
        ))}
        {hidden > 0 && <span className={clsx('text-[11px]', MUTED)}>{`and ${String(hidden)} more`}</span>}
        {saves > 0 && (
          <span className={clsx('ml-auto text-[11px] tracking-wider uppercase', MUTED)}>
            {`Saves ${String(saves)} element${saves === 1 ? '' : 's'}`}
          </span>
        )}
      </div>
    </li>
  );
};

export default SuggestionItem;
