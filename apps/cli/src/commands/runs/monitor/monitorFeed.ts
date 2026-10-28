import type { Tone } from './monitorModel';
import type { FeedLine } from '../../../runs/view/monitor';

/** The activity as the panel tells it: each kind of event's tone, who said it to whom, and what opens under it. */

/** Each kind of event, at a glance: the tone of its dot and of its words. */
export const EVENT_TONE: Record<FeedLine['kind'], Tone> = {
  take: 'info',
  complete: 'link',
  review: 'link',
  approved: 'success',
  'sent-back': 'warning',
  message: 'muted',
  question: 'warning',
  agent: 'subtle',
  run: 'primary',
  problem: 'danger',
  other: 'subtle'
};

/** What an event says, its words quoted for a message — a question's asked — and a line cut short whole: the row clips it. */
export const whatOf = (line: FeedLine): string =>
  line.quote !== undefined
    ? `${line.kind === 'question' ? 'asks ' : ''}“${line.quote}”`
    : line.cut && line.detail !== undefined
      ? line.detail
      : line.text;

/** Whether a line opens under it: a group of repeats, or one whose text says less than its whole. */
export const opens = (line: FeedLine): boolean => line.count !== undefined || line.detail !== undefined;

/** A line as a person opens it: its newest time, who, and its words — the same through every read of the run. */
export const groupKey = (line: FeedLine): string => `${line.at}|${line.by}|${line.group ?? line.text}`;

/** What opens under a line: its whole words, or each of its repeats with its time — `⎿` under its line. */
export const openedRows = (line: FeedLine): { at?: string; text: string }[] => [
  ...(line.detail === undefined ? [] : [{ text: line.detail }]),
  ...(line.repeats ?? []).slice(1).map(each => ({ at: each.at, text: whatOf(each) }))
];
