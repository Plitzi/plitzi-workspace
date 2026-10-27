import path from 'node:path';

import { locatedSpace } from '../commands/where';

/**
 * What of a page a task writes, read off its copy's space: the elements its files write, the outermost of them — what
 * a look pictures, when the task writes a part of a page others build too — and whether it writes a whole page (or
 * layout, or component). Undefined when the copy does not author: then the look shows the page whole, as before.
 */
export interface TaskParts {
  /** Every element the task's files write. */
  ids: Set<string>;
  /** Every element the space has: an id in neither is not an element (a class, a text). */
  all: Set<string>;
  /** The task's outermost elements, in the space's order: its parts of a page. */
  tops: string[];
  /** It writes a page's, a layout's or a component's root: the whole of it is its own. */
  ownsRoot: boolean;
}

export const taskParts = async (copy: string, files: readonly string[]): Promise<TaskParts | undefined> => {
  const located = await locatedSpace(copy);
  if ('problem' in located) {
    return undefined;
  }

  // Where each was written, as a project path of the copy: positions are said from the working directory.
  const fileOf = (file: string): string =>
    path.relative(copy, path.resolve(process.cwd(), file)).split(path.sep).join('/');
  const mine = new Set(
    located.flatMap(element =>
      element.position && files.includes(fileOf(element.position.file)) ? [element.elementId] : []
    )
  );
  const parentOf = new Map(
    located.flatMap(element => element.children.map(child => [child, element.elementId] as const))
  );
  const byId = new Map(located.map(element => [element.elementId, element] as const));
  // A provider with no tag, a channel, a plugin's that draws nothing: no box of its own — a picture is clipped to what
  // it holds, and one that holds nothing is not pictured (a run's look tried a task's two channels on 14 pages).
  const drawn = (id: string): string[] => {
    const element = byId.get(id);

    return element?.boxless ? element.children.flatMap(drawn) : [id];
  };
  const tops = located
    .filter(element => mine.has(element.elementId) && !mine.has(parentOf.get(element.elementId) ?? ''))
    .flatMap(element => drawn(element.elementId));

  return {
    ids: mine,
    all: new Set(located.map(element => element.elementId)),
    tops,
    ownsRoot: located.some(element => element.elementId === element.rootId && mine.has(element.elementId))
  };
};

/**
 * A page check's findings kept to the task's own elements: a line naming only elements of other tasks — a part still a
 * stub, a heading another part holds — is theirs. Answers the lines kept, and how many were set apart.
 */
export const findingsOf = (check: string, parts: TaskParts): { text: string; apart: number } => {
  let apart = 0;
  const lines = check.split('\n').filter(line => {
    if (!/^\s+- /.test(line)) {
      return true;
    }

    const named = [...line.matchAll(/"([\w-]+)"/g)].map(match => match[1]).filter(id => parts.all.has(id));
    const others = named.length > 0 && named.every(id => !parts.ids.has(id));
    if (others) {
      apart += 1;
    }

    return !others;
  });

  return { text: lines.join('\n'), apart };
};

/** How many of a task's parts of a page are pictured: a look is read by a model, and each picture costs it. */
const PARTS_PICTURED = 3;

/**
 * The parts a look pictures, each apart: the one asked for (`--within`, as page outline takes it) whatever the task drew;
 * else the task's own parts — none when it owns the page's root, or draws more of them than are pictured apart (`many`:
 * the page whole then, never the first three — a run's t-home changed six sections, and three went unseen).
 */
export const lookClips = (parts: TaskParts | undefined, within?: string): { clips: string[]; many: boolean } => {
  const many = parts !== undefined && !parts.ownsRoot && parts.tops.length > PARTS_PICTURED;

  return {
    clips: within !== undefined ? [within] : parts && !parts.ownsRoot && !many ? parts.tops : [],
    many: within === undefined && many
  };
};
