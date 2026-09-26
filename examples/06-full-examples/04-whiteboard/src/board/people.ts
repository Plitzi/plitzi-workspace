/**
 * Who is on a board, as the room shows them: a name and a colour, picked at random on a first visit and kept.
 *
 * The colours are NAMES for the same reason a board's are: the avatars, the cursors and the selection outlines all
 * resolve `--collab-<name>` from the page, so each person is one colour in every scheme and every place they appear.
 */
export const COLLAB_COLOURS = ['coral', 'amber', 'lime', 'teal', 'sky', 'indigo', 'orchid', 'rose'] as const;

export type CollabColour = (typeof COLLAB_COLOURS)[number];

/** A colour of a name's own, the same on every screen: what signs a card or a note, whoever is here to see it. */
export const colourOfName = (name: string): CollabColour => {
  let hash = 7;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }

  return COLLAB_COLOURS[hash % COLLAB_COLOURS.length];
};

export const GUEST_NAMES = [
  'Otter',
  'Heron',
  'Lynx',
  'Marten',
  'Puffin',
  'Ibex',
  'Kestrel',
  'Newt',
  'Oriole',
  'Tapir',
  'Wren',
  'Quokka',
  'Gecko',
  'Bison',
  'Moth',
  'Okapi'
] as const;

/** What a member announces on the room — the only shape the canvas reads from presence. */
export type Collaborator = {
  name: string;
  color: string;
  /** An AI agent on the board (`src/agent`), marked as one wherever it appears. */
  agent?: boolean;
};

export const isCollaborator = (value: unknown): value is Collaborator =>
  typeof value === 'object' &&
  value !== null &&
  'name' in value &&
  typeof value.name === 'string' &&
  'color' in value &&
  typeof value.color === 'string';
