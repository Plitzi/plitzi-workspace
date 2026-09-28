import { memo, useCallback } from 'react';

import { doneLabelOf, KIND_LABELS, nameOf, statesOf } from '../../helpers.ts';

import type { OutlineColumn, OutlineItem } from '../../../../outline.ts';
import type { OutlineActions } from '../../types.ts';
import type { ChangeEvent } from 'react';

export type RowProps = {
  item: OutlineItem;
  /** The board's columns: where a card can be moved. */
  columns: readonly OutlineColumn[];
  /** The column it is in, for a card. */
  column: string | undefined;
  editable: boolean;
  actions: OutlineActions;
};

/** One thing on the board: what it is and says, and what can be done to it — each button named for what it does to it. */
const Row = ({ item, columns, column, editable, actions }: RowProps) => {
  const { id } = item;
  const name = nameOf(item);
  const states = statesOf(item);
  const done = doneLabelOf(item);
  const changes = editable && !item.faceDown && !item.locked;
  const writable = changes && item.kind !== 'picture' && item.kind !== 'stamp';
  const task = changes && (item.kind === 'card' || item.kind === 'comment');
  const movable = changes && item.kind === 'card' && columns.length > 1;

  const onShow = useCallback(() => actions.show(id), [actions, id]);
  const onEdit = useCallback(() => actions.edit(id), [actions, id]);
  const onDone = useCallback(() => actions.toggleDone(id), [actions, id]);
  const onRemove = useCallback(() => actions.remove(id), [actions, id]);
  const onMove = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => actions.moveCard(id, event.target.value),
    [actions, id]
  );

  return (
    <li className="board__outline-item" data-done={item.done ? 'true' : 'false'}>
      <p className="board__outline-line">
        <span className="board__outline-kind">{KIND_LABELS[item.kind]}</span>
        <span className="board__outline-label">{item.label || KIND_LABELS[item.kind]}</span>
      </p>
      {item.detail && <p className="board__outline-detail">{item.detail}</p>}
      {states && <p className="board__outline-states">{states}</p>}
      <div className="board__outline-actions">
        <button type="button" onClick={onShow} aria-label={`Show ${name} on the board`}>
          Show
        </button>
        {writable && (
          <button type="button" onClick={onEdit} aria-label={`Edit ${name}`}>
            Edit
          </button>
        )}
        {task && (
          <button type="button" onClick={onDone} aria-label={done.name}>
            {done.text}
          </button>
        )}
        {movable && (
          <select value={column} onChange={onMove} aria-label={`Move ${name} to another column`}>
            {columns.map(option => (
              <option key={option.id} value={option.id}>
                {option.id === column ? `In ${option.title}` : `Move to ${option.title}`}
              </option>
            ))}
          </select>
        )}
        {changes && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${name}`}>
            Remove
          </button>
        )}
      </div>
    </li>
  );
};

export default memo(Row);
