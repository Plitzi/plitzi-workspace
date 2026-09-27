import { cardTitle, openBlockers } from '../board/dependencies.ts';
import { DUTY_PRESETS, instructionOf } from '../board/duties.ts';
import { isConnector } from '../board/model.ts';
import { describeSession } from '../board/sessions.ts';

import type { Session } from './session.ts';
import type { BoardElement } from '../board/model.ts';

/**
 * A board as an agent reads it: short lines it can reason about, not the elements' JSON — each thing with its id,
 * what it is, what it says, where it is and what it is in; each connection as `a → b`; who is here; what was said.
 */

const round = (value: number): number => Math.round(value);

/** Words on one line, in quotes, cut short past `limit`. */
const quoted = (value: string | undefined, limit = 160): string => {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();

  return text ? `"${text.length > limit ? `${text.slice(0, limit - 3)}…` : text}"` : '';
};

const words = (element: BoardElement): string => {
  const text = quoted(element.text);

  return text ? ` ${text}` : '';
};

const colourOf = (element: BoardElement): string =>
  element.type === 'sticky' || element.type === 'card' || element.type === 'frame' || element.fill !== 'none'
    ? ` ${element.fill}`
    : element.stroke === 'ink'
      ? ''
      : ` ${element.stroke}`;

/**
 * One element on one line: its id first, so the agent can name it back. One `faceDown` — written by someone else in a
 * session's writing step — says who is writing it, and nothing of what. `find` answers the others it names: the frame
 * it is in, the cards it waits on.
 */
export const describeElement = (
  element: BoardElement,
  find: (id: string) => BoardElement | undefined,
  faceDown: (element: BoardElement) => boolean = () => false
): string => {
  if (faceDown(element)) {
    return `- ${element.id} ${element.type} face down — ${element.author ?? 'someone'} is writing it (the session's writing step)`;
  }

  const box = `at (${round(element.x)}, ${round(element.y)}) size ${round(element.width)}×${round(element.height)}`;
  const frame = element.parent ? find(element.parent) : undefined;
  const inside = frame?.type === 'frame' ? ` in "${frame.text ?? ''}"` : '';
  const waits = (element.blockedBy ?? []).flatMap(id => {
    const blocker = find(id);

    return blocker ? [`${blocker.id} "${cardTitle(blocker)}" (${blocker.done ? 'done' : 'open'})`] : [];
  });
  const blocked = !element.done && openBlockers(element, find).length > 0;
  const marks = [
    element.locked ? 'locked' : '',
    element.done ? (element.type === 'comment' ? 'resolved' : 'done') : '',
    element.votes?.length ? `${element.votes.length} votes` : '',
    element.author ? `by ${element.author}` : '',
    waits.length ? `${blocked ? 'BLOCKED — ' : ''}waits on ${waits.join(', ')}` : '',
    element.description ? `description: ${quoted(element.description, 400)}` : '',
    element.layout === 'column' ? 'column (stacks what is dropped in)' : '',
    element.completes ? 'the team’s Done: a card moved into it is ticked off, out of it open again' : '',
    element.branchOf ? `branch of ${element.branchOf} — merge_branch takes it back into its place` : '',
    element.duty
      ? `duty for an agent: ${DUTY_PRESETS[element.duty.role].label}${element.duty.paused ? ', paused' : ''}, ${element.duty.agent ? `taken by ${element.duty.agent}` : 'free'} — ${quoted(instructionOf(element.duty), 300)}`
      : '',
    element.replies?.length
      ? `replies: ${element.replies.map(reply => `${reply.author}: "${reply.text}"`).join(' / ')}`
      : ''
  ].filter(Boolean);

  return `- ${element.id} ${element.type}${colourOf(element)}${words(element)} ${box}${inside}${marks.length ? ` [${marks.join('; ')}]` : ''}`;
};

export const describeBoard = (session: Session): string => {
  const running = session.session();
  const elements = session.elements();
  const byId = new Map(elements.map(element => [element.id, element]));
  const connectors = elements.filter(element => isConnector(element.type));
  const things = elements.filter(element => !isConnector(element.type) && element.type !== 'freehand');
  const drawings = elements.filter(element => element.type === 'freehand').length;
  const label = (id: string | undefined): string => {
    const target = id ? byId.get(id) : undefined;

    return target ? `${target.id}${words(target)}` : '(loose end)';
  };
  const people = session.members();
  const xs = elements.flatMap(element => [element.x, element.x + element.width]);
  const ys = elements.flatMap(element => [element.y, element.y + element.height]);

  return [
    `Board "${session.title}" — ${session.link}${session.readOnly ? ' (read-only: look and talk, change nothing)' : ''}`,
    people.length
      ? `Here now: ${people.map(person => `${person.name}${person.agent ? ' (agent)' : ''}`).join(', ')}`
      : 'Nobody else is here right now.',
    ...(running ? [`Session: ${describeSession(running)}`] : []),
    elements.length
      ? `Everything lies between (${round(Math.min(...xs))}, ${round(Math.min(...ys))}) and (${round(Math.max(...xs))}, ${round(Math.max(...ys))}). Board units; x grows right, y grows down.`
      : 'The board is empty.',
    '',
    `Elements (${things.length}${drawings ? `, plus ${drawings} pen strokes` : ''}):`,
    ...things.map(element => describeElement(element, session.element, session.faceDown)),
    ...(connectors.length
      ? [
          '',
          'Connections:',
          ...connectors.map(
            connector =>
              `- ${connector.id} ${connector.type}${connector.text ? ` "${connector.text}"` : ''}: ${label(connector.start?.id)} → ${label(connector.end?.id)}`
          )
        ]
      : []),
    ...(session.chat().length
      ? [
          '',
          'Chat, last lines:',
          ...session.chat().map(line => `- ${line.name}${line.agent ? ' (agent)' : ''}: ${line.text}`)
        ]
      : [])
  ].join('\n');
};
