// Shared bits for the terminal benchmark runners (cli / nestedCli / reactCli) so the ANSI palette, the column
// formatting and the median helper live in one place instead of being copied per runner.

export const BOLD = '\x1b[1m';
export const DIM = '\x1b[2m';
export const RESET = '\x1b[0m';
export const GREEN = '\x1b[32m';
export const YELLOW = '\x1b[33m';

export const padStart = (value: string, width: number): string => value.padStart(width);

// Formats one cell ranked against the best (lowest) value in its row: the winner is green and tagged `best`, the rest
// show their `×` slowdown, and `NaN` renders as `—` (a skipped measurement). `format` turns the raw number into its
// unit string (e.g. `12.34ms`, `30`).
export const rankCell = (value: number, best: number, width: number, format: (n: number) => string): string => {
  if (Number.isNaN(value)) {
    return padStart('—', width);
  }

  const isBest = value <= best;
  const ratio = best > 0 ? value / best : value > 0 ? Infinity : 1;
  const body = isBest ? `${format(value)}  best` : `${format(value)}  ${ratio.toFixed(1)}×`;
  const padded = padStart(body, width);

  return isBest ? `${GREEN}${padded}${RESET}` : padded;
};

// Repeats a measurement `reps` times and returns the median sample (robust to GC/JIT spikes), ranked by `ms`.
export const medianBy = <T>(run: () => T, reps: number, ms: (sample: T) => number): T => {
  const samples: T[] = [];
  for (let r = 0; r < reps; r++) {
    samples.push(run());
  }

  samples.sort((a, b) => ms(a) - ms(b));

  return samples[Math.floor(samples.length / 2)];
};
