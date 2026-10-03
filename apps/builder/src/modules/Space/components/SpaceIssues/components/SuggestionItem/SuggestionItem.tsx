import clsx from 'clsx';

import { MUTED, SUGGESTION_TEXT } from '../../helpers';
import ElementChip from '../ElementChip';
import IssueFix from '../IssueFix';

import type { TSpaceSuggestion } from '@plitzi/sdk-shared';

/** Past this, the rest of the elements it is about are counted rather than listed. */
const SHOWN_ELEMENTS = 4;

export type SuggestionItemProps = {
  suggestion: TSpaceSuggestion;
  /** Called once an element is on screen, so whatever holds the list can get out of the way. */
  onDismiss: () => void;
};

/**
 * A shorter way to the same page: what it is, the short way, what taking it saves, and the elements it is about —
 * the copies of a header, the buttons holding a text — each a link to it.
 */
const SuggestionItem = ({ suggestion, onDismiss }: SuggestionItemProps) => {
  const { message, fix, saves, elementIds } = suggestion;
  const hidden = elementIds.length - SHOWN_ELEMENTS;

  return (
    <li className="flex gap-2 border-b border-zinc-100 py-2 last:border-b-0 dark:border-zinc-800">
      <i className={clsx('fa-solid fa-lightbulb mt-0.5 text-xs', SUGGESTION_TEXT)} />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">{message}</p>
        {fix && <IssueFix fix={fix} label="The short way" />}
        {saves > 0 && (
          <span className={clsx('text-[10px] tracking-wider uppercase', MUTED)}>
            {`Saves ${String(saves)} element${saves === 1 ? '' : 's'}`}
          </span>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {elementIds.slice(0, SHOWN_ELEMENTS).map(elementId => (
            <ElementChip key={elementId} elementId={elementId} onDismiss={onDismiss} />
          ))}
          {hidden > 0 && <span className={clsx('text-[11px]', MUTED)}>{`and ${String(hidden)} more`}</span>}
        </div>
      </div>
    </li>
  );
};

export default SuggestionItem;
