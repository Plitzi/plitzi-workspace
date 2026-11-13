import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useId, useState } from 'react';

import { tagOf } from '../../helpers';

import type { KeyboardEvent } from 'react';

export type JourneyTagsProps = {
  tags?: string[];
  /** The tags the space's other journeys carry: offered as it is typed, so one thing keeps one spelling. */
  known: readonly string[];
  locked: boolean;
  onChange: (tags: string[] | undefined) => void;
};

/**
 * What a journey is about, as chips beside its Save — how a long list is told apart and filtered. A word typed and
 * Enter (or a comma) adds one, made one spelling as it is added; × takes it off.
 */
const JourneyTags = ({ tags = [], known, locked, onChange }: JourneyTagsProps) => {
  const [typed, setTyped] = useState('');
  const listId = useId();

  const add = useCallback(() => {
    const tag = tagOf(typed);
    setTyped('');
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
  }, [onChange, tags, typed]);
  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        add();
      }
    },
    [add]
  );
  const handleRemove = useCallback(
    (tag: string) => () => {
      const rest = tags.filter(each => each !== tag);
      onChange(rest.length > 0 ? rest : undefined);
    },
    [onChange, tags]
  );

  return (
    <div
      className="text-ui-fg-muted flex flex-wrap items-center gap-1.5 text-xs"
      role="group"
      aria-label="Its tags"
      title="What it is about: the list is filtered by these"
    >
      <i className="fa-solid fa-tag text-ui-fg-subtle text-[11px]" />
      {tags.map(tag => (
        <span key={tag} className="border-ui-line-strong flex items-center gap-1 rounded-full border px-2 py-0.5">
          {tag}
          {!locked && (
            <button
              type="button"
              aria-label={`Untag ${tag}`}
              className="text-ui-fg-subtle hover:text-red-600"
              onClick={handleRemove(tag)}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </span>
      ))}
      {!locked && (
        <div className="w-32">
          <Input
            size="xs"
            name="tag"
            aria-label="Add a tag"
            placeholder="Add a tag"
            list={listId}
            value={typed}
            onChange={setTyped}
            onKeyDown={handleKey}
            onBlur={add}
          />
          <datalist id={listId}>
            {known
              .filter(tag => !tags.includes(tag))
              .map(tag => (
                <option key={tag} value={tag} />
              ))}
          </datalist>
        </div>
      )}
    </div>
  );
};

export default JourneyTags;
