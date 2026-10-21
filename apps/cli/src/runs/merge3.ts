/**
 * Two changes to one text file, from one base, put together line by line — what lets a task's change to a shared file go
 * in when the run's version moved since its copy was made (another task registered its page in the entry meanwhile).
 * Changes to different lines both go in; two additions at one place go in one after the other, the run's first; two
 * different changes to the same lines are a conflict, and nothing is merged. The same input always gives the same result.
 */

interface Hunk {
  /** The base lines it replaces: [start, end). An addition has start === end. */
  start: number;
  end: number;
  lines: string[];
}

const MAX_CELLS = 4_000_000;

/** What turns `base` into `next`, as the runs of lines that change. */
const hunksOf = (base: string[], next: string[]): Hunk[] | undefined => {
  if (base.length * next.length > MAX_CELLS) {
    return undefined;
  }

  const width = next.length + 1;
  const lcs = new Uint32Array((base.length + 1) * width);
  for (let i = base.length - 1; i >= 0; i -= 1) {
    for (let j = next.length - 1; j >= 0; j -= 1) {
      lcs[i * width + j] =
        base[i] === next[j]
          ? lcs[(i + 1) * width + j + 1] + 1
          : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    }
  }

  const hunks: Hunk[] = [];
  let open: Hunk | undefined;
  let i = 0;
  let j = 0;
  const close = (): void => {
    if (open) {
      hunks.push(open);
      open = undefined;
    }
  };
  while (i < base.length || j < next.length) {
    if (i < base.length && j < next.length && base[i] === next[j]) {
      close();
      i += 1;
      j += 1;
    } else if (i < base.length && (j >= next.length || lcs[(i + 1) * width + j] >= lcs[i * width + j + 1])) {
      open ??= { start: i, end: i, lines: [] };
      open.end = i + 1;
      i += 1;
    } else {
      open ??= { start: i, end: i, lines: [] };
      open.lines.push(next[j]);
      j += 1;
    }
  }

  close();

  return hunks;
};

const sameHunk = (a: Hunk, b: Hunk): boolean =>
  a.start === b.start &&
  a.end === b.end &&
  a.lines.length === b.lines.length &&
  a.lines.every((line, n) => line === b.lines[n]);

/** Whether two hunks touch the same base lines — two additions at one place do not: they go in one after the other. */
const overlap = (a: Hunk, b: Hunk): boolean => {
  const aAdds = a.start === a.end;
  const bAdds = b.start === b.end;
  if (aAdds && bAdds) {
    return false;
  }

  if (aAdds) {
    return a.start > b.start && a.start < b.end;
  }

  if (bAdds) {
    return b.start > a.start && b.start < a.end;
  }

  return a.start < b.end && b.start < a.end;
};

/**
 * Two changes to the same base lines that agree on what those lines become and differ only in what each adds after them
 * — `home` turned into `home,` by both, then each its own page — as one change: the shared part, the run's addition,
 * then the task's. Undefined when they change the lines differently: that is a conflict.
 */
const joinAdditions = (run: Hunk, mine: Hunk, baseLines: readonly string[]): Hunk | undefined => {
  if (run.start !== mine.start || run.end !== mine.end) {
    return undefined;
  }

  let prefix = 0;
  while (prefix < run.lines.length && prefix < mine.lines.length && run.lines[prefix] === mine.lines[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < run.lines.length - prefix &&
    suffix < mine.lines.length - prefix &&
    run.lines[run.lines.length - 1 - suffix] === mine.lines[mine.lines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  // What both made of the base lines must cover them all; the rest, on each side, is added.
  if (prefix + suffix < run.end - run.start) {
    return undefined;
  }

  const added = [
    ...run.lines.slice(prefix, run.lines.length - suffix),
    ...mine.lines.slice(prefix, mine.lines.length - suffix)
  ];
  // Both put a separator after the last base line (`z` became `z,`) to add after it: the additions are entries of one list,
  // so each but the last takes the separator too — `t` then `o` would not parse, `t,` then `o` does.
  const lastBase = baseLines[run.end - 1] ?? '';
  const madeOf = run.lines[prefix - 1] ?? '';
  const separator = prefix > 0 && madeOf.startsWith(lastBase) ? madeOf.slice(lastBase.length) : '';
  const entries =
    separator.trim() === ','
      ? added.map((line, n) => (n < added.length - 1 && !line.trimEnd().endsWith(',') ? `${line}${separator}` : line))
      : added;

  return {
    start: run.start,
    end: run.end,
    lines: [...run.lines.slice(0, prefix), ...entries, ...run.lines.slice(run.lines.length - suffix)]
  };
};

export type Merged = { ok: true; text: string } | { ok: false; conflicts: number; reason: string };

/**
 * A change with what the other side added too, somewhere else, taken out of what it writes: each run of two lines or more — not all
 * punctuation — the base has nowhere and the other version holds whole. Put in twice it is a key declared twice
 * (velada-dress: the tokens tasks added in their copies by the lead's word, and the requests that added them after
 * another entry). Answers the hunk left, `undefined` for an addition with nothing of its own left.
 */
const withoutAddedAlready = (hunk: Hunk, base: readonly string[], theirs: readonly string[]): Hunk | undefined => {
  if (hunk.lines.length > MAX_ADDED) {
    return hunk;
  }

  const meaningful = (line: string): boolean => /[\p{L}\p{N}]/u.test(line);
  const at = (lines: readonly string[], block: readonly string[]): boolean => {
    for (let from = 0; from + block.length <= lines.length; from += 1) {
      if (block.every((line, index) => lines[from + index] === line)) {
        return true;
      }
    }

    return false;
  };
  const left: string[] = [];
  let index = 0;
  while (index < hunk.lines.length) {
    // The longest run from here the other side added: two lines at least, one of them more than punctuation.
    let length = 0;
    for (let end = index + 2; end <= hunk.lines.length; end += 1) {
      const block = hunk.lines.slice(index, end);
      if (!at(theirs, block)) {
        break;
      }

      if (block.some(meaningful) && !at(base, block)) {
        length = end - index;
      }
    }

    if (length > 0) {
      index += length;
    } else {
      left.push(hunk.lines[index]);
      index += 1;
    }
  }

  if (left.length === hunk.lines.length) {
    return hunk;
  }

  // What it took out of the base still goes; an addition with nothing of its own left is none.
  return hunk.start === hunk.end && left.every(line => line.trim() === '') ? undefined : { ...hunk, lines: left };
};

/** The most lines of a change read for what the other side added too: past it, merged as it is. */
const MAX_ADDED = 400;

export const mergeLines = (base: string, ours: string, theirs: string): Merged => {
  if (ours === theirs || base === theirs) {
    return { ok: true, text: ours };
  }

  if (base === ours) {
    return { ok: true, text: theirs };
  }

  const baseLines = base.split('\n');
  const mine = hunksOf(baseLines, ours.split('\n'));
  const run = hunksOf(baseLines, theirs.split('\n'));
  if (!mine || !run) {
    return { ok: false, conflicts: 1, reason: 'too large to merge line by line' };
  }

  let conflicts = 0;
  const kept: { hunk: Hunk; order: number }[] = run.map(hunk => ({ hunk, order: 0 }));
  const theirLines = theirs.split('\n');
  for (const whole of mine) {
    const hunk = run.some(other => sameHunk(other, whole))
      ? undefined
      : withoutAddedAlready(whole, baseLines, theirLines);
    if (!hunk) {
      continue;
    }

    const clashing = run.filter(other => overlap(other, hunk));
    if (clashing.length === 0) {
      kept.push({ hunk, order: 1 });
      continue;
    }

    const joined = clashing.length === 1 ? joinAdditions(clashing[0], hunk, baseLines) : undefined;
    if (!joined) {
      conflicts += 1;
      continue;
    }

    const at = kept.findIndex(each => each.hunk === clashing[0]);
    kept[at] = { hunk: joined, order: 0 };
  }

  if (conflicts > 0) {
    return { ok: false, conflicts, reason: 'both changed the same lines' };
  }

  // Applied from the end, so each hunk's base positions still hold; at one place, the run's addition comes first.
  kept.sort((a, b) => b.hunk.start - a.hunk.start || b.hunk.end - a.hunk.end || b.order - a.order);
  const lines = [...baseLines];
  for (const { hunk } of kept) {
    lines.splice(hunk.start, hunk.end - hunk.start, ...hunk.lines);
  }

  return { ok: true, text: lines.join('\n') };
};
