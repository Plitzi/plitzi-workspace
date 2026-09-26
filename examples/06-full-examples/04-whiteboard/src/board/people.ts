/**
 * Who is on a board, as the room shows them: a name and a colour, picked at random on a first visit and kept.
 *
 * The colours are NAMES for the same reason a board's are: the avatars, the cursors and the selection outlines all
 * resolve `--collab-<name>` from the page, so each person is one colour in every scheme and every place they appear.
 */
export const COLLAB_COLOURS = ['coral', 'amber', 'lime', 'teal', 'sky', 'indigo', 'orchid', 'rose'] as const;

export type CollabColour = (typeof COLLAB_COLOURS)[number];

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
export type Collaborator = { name: string; color: string };

export const isCollaborator = (value: unknown): value is Collaborator =>
  typeof value === 'object' &&
  value !== null &&
  'name' in value &&
  typeof value.name === 'string' &&
  'color' in value &&
  typeof value.color === 'string';
