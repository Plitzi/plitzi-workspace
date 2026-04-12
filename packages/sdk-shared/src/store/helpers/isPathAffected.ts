import type { Path } from '../../types';

// Returns true if `candidate` could have been affected by a change at `changed`.
// A listener at "user" is affected by a change at "user.name" (descendant).
// A listener at "user.name" is affected by a change at "user" (ancestor).
// A listener at "count" is NOT affected by a change at "user.name" (unrelated).
const isPathAffected = (changed: Path, candidate: Path): boolean =>
  typeof changed !== 'string' ||
  changed === candidate ||
  changed.startsWith(candidate + '.') ||
  candidate.startsWith(changed + '.');

export default isPathAffected;
