import type { DiffLine, Hunk } from '../LogStoreBody';

const buildHunks = (diff: DiffLine[]): Hunk[] => {
  const hunks: Hunk[] = [];
  let start = -1;

  for (let i = 0; i < diff.length; i++) {
    if (diff[i].type !== 'same') {
      if (start === -1) {
        start = i;
      }
    } else if (start !== -1) {
      hunks.push({ start, end: i - 1 });
      start = -1;
    }
  }

  if (start !== -1) {
    hunks.push({ start, end: diff.length - 1 });
  }

  return hunks;
};

export default buildHunks;
