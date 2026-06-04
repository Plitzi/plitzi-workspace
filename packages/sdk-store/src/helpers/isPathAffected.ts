import type { Path } from '../types';

const isPathAffected = (changed: Path | undefined, candidate: Path): boolean =>
  typeof changed !== 'string' ||
  changed === candidate ||
  (changed.length > candidate.length && changed.startsWith(candidate) && changed[candidate.length] === '.') ||
  (candidate.length > changed.length && candidate.startsWith(changed) && candidate[changed.length] === '.');

export default isPathAffected;
