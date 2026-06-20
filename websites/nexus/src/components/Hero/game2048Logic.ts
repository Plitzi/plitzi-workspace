export const SIZE = 4;
export type Dir = 'left' | 'right' | 'up' | 'down';

const slide = (line: number[]): { line: number[]; gained: number } => {
  const nums = line.filter(n => n !== 0);
  let gained = 0;
  for (let i = 0; i < nums.length - 1; i += 1) {
    if (nums[i] === nums[i + 1]) {
      nums[i] *= 2;
      gained += nums[i];
      nums.splice(i + 1, 1);
    }
  }

  while (nums.length < SIZE) {
    nums.push(0);
  }

  return { line: nums, gained };
};

// Read/write coordinate for cell j of line i, given a slide direction (always compressing toward index 0).
const coord = (dir: Dir, i: number, j: number): [number, number] => {
  if (dir === 'left') {
    return [i, j];
  }

  if (dir === 'right') {
    return [i, SIZE - 1 - j];
  }

  if (dir === 'up') {
    return [j, i];
  }

  return [SIZE - 1 - j, i];
};

export const move = (board: number[], dir: Dir): { board: number[]; gained: number; moved: boolean } => {
  const next = board.slice();
  let gained = 0;
  for (let i = 0; i < SIZE; i += 1) {
    const line: number[] = [];
    for (let j = 0; j < SIZE; j += 1) {
      const [r, c] = coord(dir, i, j);
      line.push(board[r * SIZE + c]);
    }

    const res = slide(line);
    gained += res.gained;
    for (let j = 0; j < SIZE; j += 1) {
      const [r, c] = coord(dir, i, j);
      next[r * SIZE + c] = res.line[j];
    }
  }

  const moved = next.some((v, k) => v !== board[k]);

  return { board: next, gained, moved };
};

export const spawn = (board: number[]): number[] => {
  const empties: number[] = [];
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === 0) {
      empties.push(i);
    }
  }

  if (!empties.length) {
    return board;
  }

  const next = board.slice();
  next[empties[Math.floor(Math.random() * empties.length)]] = Math.random() < 0.9 ? 2 : 4;

  return next;
};

export const freshBoard = (): number[] => spawn(spawn(new Array(SIZE * SIZE).fill(0)));

export const tileCount = (board: number[]): number => board.filter(n => n > 0).length;

// Colour climbs with the tile: deep purple at 2, heating through magenta and pink to red as the number grows. Driven
// by log2(value) so every doubling shifts the hue and brightness a notch.
export const tileStyle = (value: number): { background: string; color: string; boxShadow: string } => {
  if (value === 0) {
    return { background: 'rgba(124, 58, 237, 0.06)', color: 'transparent', boxShadow: 'none' };
  }

  const t = Math.log2(value);
  const hue = 258 + t * 10;
  const light = Math.min(60, 28 + t * 3);

  return {
    background: `hsl(${hue}, 72%, ${light}%)`,
    color: '#fff',
    boxShadow: `0 0 ${Math.min(20, t * 2)}px hsla(${hue}, 80%, 60%, 0.45)`
  };
};
