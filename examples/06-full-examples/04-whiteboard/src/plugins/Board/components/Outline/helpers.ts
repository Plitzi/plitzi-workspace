import type { OutlineItem, OutlineKind } from '../../outline.ts';
import type { FormEvent } from 'react';

/** What each kind of thing is called in the list. */
export const KIND_LABELS: Record<OutlineKind, string> = {
  card: 'Card',
  note: 'Note',
  text: 'Text',
  comment: 'Comment',
  shape: 'Shape',
  picture: 'Picture',
  stamp: 'Stamp'
};

/** What an item is called in a button's name: its first words, quoted — or what it is. */
export const nameOf = (item: OutlineItem): string => {
  const words = item.label.split('\n')[0];
  if (!words) {
    return `the ${KIND_LABELS[item.kind].toLowerCase()}`;
  }

  return `“${words.length > 60 ? `${words.slice(0, 59)}…` : words}”`;
};

/** What an item is, past its words: done, blocked, locked, voted, whose, and what it points to. */
export const statesOf = (item: OutlineItem): string =>
  [
    item.done ? (item.kind === 'comment' ? 'resolved' : 'done') : '',
    item.blockedBy.length ? `blocked by ${item.blockedBy.map(title => `“${title}”`).join(', ')}` : '',
    item.locked ? 'locked' : '',
    item.votes ? `${item.votes} ${item.votes === 1 ? 'vote' : 'votes'}` : '',
    item.author ? `by ${item.author}` : '',
    item.pointsTo.length ? `points to ${item.pointsTo.map(words => `“${words}”`).join(', ')}` : ''
  ]
    .filter(Boolean)
    .join(' · ');

/** The name of the button that ticks a task off, or opens it again. */
export const doneLabelOf = (item: OutlineItem): { text: string; name: string } => {
  const comment = item.kind === 'comment';
  if (item.done) {
    return { text: 'Reopen', name: `${comment ? 'Reopen' : 'Mark not done'}: ${nameOf(item)}` };
  }

  return { text: comment ? 'Resolve' : 'Done', name: `${comment ? 'Resolve' : 'Mark done'}: ${nameOf(item)}` };
};

/** A form's one field, read and emptied: what it was sent with. */
export const takeField = (event: FormEvent<HTMLFormElement>, name: string): string => {
  event.preventDefault();
  const field = event.currentTarget.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement)) {
    return '';
  }

  const value = field.value.trim();
  field.value = '';

  return value;
};
