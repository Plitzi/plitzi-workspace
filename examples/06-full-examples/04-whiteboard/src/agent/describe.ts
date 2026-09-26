import { isConnector } from '../board/model.ts';

import type { Session } from './session.ts';
import type { BoardElement } from '../board/model.ts';

/**
 * A board as an agent reads it: short lines it can reason about, not the elements' JSON — each thing with its id,
 * what it is, what it says, where it is and what it is in; each connection as `a → b`; who is here; what was said.
 */

const round = (value: number): number => Math.round(value);

const words = (element: BoardElement): string => {
  const text = (element.text ?? '').replace(/\s+/g, ' ').trim();

  return text ? ` "${text.length > 160 ? `${text.slice(0, 157)}…` : text}"` : '';
};

const colourOf = (element: BoardElement): string =>
  element.type === 'sticky' || element.type === 'card' || element.type === 'frame' || element.fill !== 'none'
    ? ` ${element.fill}`
    : element.stroke === 'ink'
      ? ''
      : ` ${element.stroke}`;

/** One element on one line: its id first, so the agent can name it back. */
export const describeElement = (element: BoardElement, frames: Map<string, BoardElement>): string => {
  const box = `at (${round(element.x)}, ${round(element.y)}) size ${round(element.width)}×${round(element.height)}`;
  const inside = element.parent && frames.has(element.parent) ? ` in "${frames.get(element.parent)?.text ?? ''}"` : '';
  const marks = [
    element.done ? (element.type === 'comment' ? 'resolved' : 'done') : '',
    element.votes?.length ? `${element.votes.length} votes` : '',
    element.author ? `by ${element.author}` : '',
    element.layout === 'column' ? 'column (stacks what is dropped in)' : '',
    element.replies?.length
      ? `replies: ${element.replies.map(reply => `${reply.author}: "${reply.text}"`).join(' / ')}`
      : ''
  ].filter(Boolean);

  return `- ${element.id} ${element.type}${colourOf(element)}${words(element)} ${box}${inside}${marks.length ? ` [${marks.join('; ')}]` : ''}`;
};

export const describeBoard = (session: Session): string => {
  const elements = session.elements();
  const byId = new Map(elements.map(element => [element.id, element]));
  const frames = new Map(elements.filter(element => element.type === 'frame').map(element => [element.id, element]));
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
    elements.length
      ? `Everything lies between (${round(Math.min(...xs))}, ${round(Math.min(...ys))}) and (${round(Math.max(...xs))}, ${round(Math.max(...ys))}). Board units; x grows right, y grows down.`
      : 'The board is empty.',
    '',
    `Elements (${things.length}${drawings ? `, plus ${drawings} pen strokes` : ''}):`,
    ...things.map(element => describeElement(element, frames)),
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
