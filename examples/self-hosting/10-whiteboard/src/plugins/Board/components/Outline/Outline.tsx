import { useCallback, useId } from 'react';

import Section from './components/Section/index.ts';
import { takeField } from './helpers.ts';

import type { OutlineActions } from './types.ts';
import type { Outline as OutlineData } from '../../outline.ts';
import type { FormEvent } from 'react';

export type OutlineProps = {
  outline: OutlineData;
  title: string;
  /** Shown as a panel beside the board — otherwise out of sight, and there for whoever reads the page another way. */
  open: boolean;
  editable: boolean;
  actions: OutlineActions;
};

/**
 * The board as a list (`outline.ts`), in the page: what the canvas shows, for whoever cannot read a canvas — a screen
 * reader, someone on the keyboard, an assistant driving the browser. Always there for them, out of sight; shown as a
 * panel beside the board when `open`, or while the focus is in it. Every change it offers is one the canvas makes.
 */
const Outline = ({ outline, title, open, editable, actions }: OutlineProps) => {
  const heading = useId();
  const count = outline.sections.reduce((sum, section) => sum + section.items.length, 0);
  const drawings = outline.drawings
    ? ` · ${outline.drawings} pen ${outline.drawings === 1 ? 'drawing' : 'drawings'}, not listed`
    : '';
  const onNote = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      const text = takeField(event, 'note');
      if (text) {
        actions.addNote(text);
      }
    },
    [actions]
  );

  return (
    <section className="board__outline" data-open={open ? 'true' : 'false'} aria-labelledby={heading}>
      <h2 id={heading}>{title ? `Board contents: ${title}` : 'Board contents'}</h2>
      <p className="board__outline-meta">
        {`${count} ${count === 1 ? 'thing' : 'things'}, in the order the board reads${drawings}${editable ? '' : ' · read-only'}`}
      </p>
      {editable && (
        <form className="board__outline-form" onSubmit={onNote}>
          <input name="note" maxLength={4000} placeholder="Write a note" aria-label="New note on the board" />
          <button type="submit">Add note</button>
        </form>
      )}
      {outline.sections.map(section => (
        <Section
          key={section.id ?? 'loose'}
          section={section}
          columns={outline.columns}
          editable={editable}
          actions={actions}
        />
      ))}
      {count === 0 && <p className="board__outline-empty">Nothing on the board yet.</p>}
    </section>
  );
};

export default Outline;
