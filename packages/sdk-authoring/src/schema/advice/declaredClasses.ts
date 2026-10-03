import type { Style } from '@plitzi/sdk-shared';

/** The classes a space declares, at any breakpoint — what an element wears by name, as opposed to its own styles. */
export const declaredClasses = (style: Style): Set<string> =>
  new Set(
    Object.values(style.platform).flatMap(items =>
      Object.values(items)
        .filter(item => item.type === 'class')
        .map(item => item.name)
    )
  );
