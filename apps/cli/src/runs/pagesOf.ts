import { authoredHandles } from './expectations';
import { readOwnership } from './ownership';

/**
 * The pages a task's files are drawn at, for a look at it (`task look`, a designer's review): each file's page is the
 * one that owns it, read off the imports (`walkFilter.ts` is `walks.ts`'s) — a shared one's, the pages that reach it
 * (`dogFilter.ts` is drawn at /walks, /visits, /reminders) — and its address is the authored space's —
 * a page of that id, or the pages a family of that name makes (`pet.ts` → `/pets/luna`, `/pets/bruno`). A page with a
 * parameter in its address is not one to open; what matches nothing is left out rather than guessed.
 */

const PAGES = 'src/space/pages/';
const MAX_PAGES = 6;

/** `walkFilter` → `walk-filter`: a file's name as a page's id is usually written. */
const kebab = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export const pagesOf = async (root: string, files: readonly string[]): Promise<string[]> => {
  const ownership = await readOwnership(root);
  // A shared file — a component, the theme — is drawn at the pages that reach it, not at none of them.
  const unitsOf = (file: string): string[] => {
    const owner = ownership.ownerOf.get(file);
    if (owner) {
      return [owner];
    }

    return ownership.shared.get(file) ?? [file];
  };
  const units = new Set(
    files.flatMap(unitsOf).flatMap(unit =>
      unit.startsWith(PAGES)
        ? [
            unit
              .slice(PAGES.length)
              .split('/')[0]
              ?.replace(/\.[cm]?tsx?$/, '') ?? ''
          ]
        : []
    )
  );
  if (units.size === 0) {
    return [];
  }

  const handles = await authoredHandles(root);
  if (!handles) {
    return [];
  }

  const names = [...units].filter(Boolean).flatMap(name => [name, kebab(name)]);
  const paths = Object.entries(handles.pages)
    .filter(([, page]) => page.params.length === 0 && !page.path.includes('*'))
    .filter(([id]) => names.some(name => id === name || id.startsWith(`${name}-`) || id === `${name}-page`))
    .map(([, page]) => page.path);

  return [...new Set(paths)].slice(0, MAX_PAGES);
};
