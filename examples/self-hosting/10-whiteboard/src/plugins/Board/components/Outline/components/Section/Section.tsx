import { memo, useCallback, useId } from 'react';

import { takeField } from '../../helpers.ts';
import Row from '../Row/index.ts';

import type { OutlineColumn, OutlineSection } from '../../../../outline.ts';
import type { OutlineActions } from '../../types.ts';
import type { FormEvent } from 'react';

export type SectionProps = {
  section: OutlineSection;
  columns: readonly OutlineColumn[];
  editable: boolean;
  actions: OutlineActions;
};

/** A frame — or a column, with a field to add a card to it — and what it holds; or what lies outside every frame. */
const Section = ({ section, columns, editable, actions }: SectionProps) => {
  const heading = useId();
  const { id, title, column, completes, items } = section;
  const onAdd = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      const text = takeField(event, 'card');
      if (id && text) {
        actions.addCard(id, text);
      }
    },
    [actions, id]
  );
  const kind = column ? (completes ? ' · Column — the team’s Done' : ' · Column') : id ? ' · Frame' : '';

  return (
    <section className="board__outline-section" aria-labelledby={heading}>
      <h3 id={heading}>
        {title}
        <span className="board__outline-meta">{`${kind} · ${items.length}`}</span>
      </h3>
      {items.length > 0 && (
        <ul>
          {items.map(item => (
            <Row
              key={item.id}
              item={item}
              columns={columns}
              column={column ? id : undefined}
              editable={editable}
              actions={actions}
            />
          ))}
        </ul>
      )}
      {items.length === 0 && <p className="board__outline-empty">Empty</p>}
      {editable && column && (
        <form className="board__outline-form" onSubmit={onAdd}>
          <input name="card" maxLength={4000} placeholder="New card title" aria-label={`New card in ${title}`} />
          <button type="submit" aria-label={`Add the card to ${title}`}>
            Add card
          </button>
        </form>
      )}
    </section>
  );
};

export default memo(Section);
