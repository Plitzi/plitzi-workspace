import type { Path } from '../../types';

const isPathAffected = (changed: Path, candidate: Path): boolean =>
  typeof changed !== 'string' ||
  changed === candidate ||
  changed.startsWith(candidate + '.') ||
  candidate.startsWith(changed + '.');

export default isPathAffected;
