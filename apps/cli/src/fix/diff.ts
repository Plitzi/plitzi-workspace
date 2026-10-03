/** A line diff of a file, as `diff -u` prints it: the changed lines and two of context around each run of them. */
export const unifiedDiff = (file: string, before: string, after: string, context = 2): string => {
  const a = before.split('\n');
  const b = after.split('\n');
  // The longest run the two share, line by line: a table of how much of each tail matches.
  const common: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      common[i][j] = a[i] === b[j] ? common[i + 1][j + 1] + 1 : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }

  type Line = { kind: ' ' | '-' | '+'; text: string; at: number };
  const lines: Line[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push({ kind: ' ', text: a[i], at: i + 1 });
      i += 1;
      j += 1;
    } else if (i < a.length && (j === b.length || common[i + 1][j] >= common[i][j + 1])) {
      // What goes before what comes, as `diff -u` writes a change.
      lines.push({ kind: '-', text: a[i], at: i + 1 });
      i += 1;
    } else {
      lines.push({ kind: '+', text: b[j], at: i + 1 });
      j += 1;
    }
  }

  const keep = lines.map((_line, index) =>
    lines.slice(Math.max(0, index - context), index + context + 1).some(near => near.kind !== ' ')
  );
  const hunks: string[] = [];
  let open = false;
  lines.forEach((line, index) => {
    if (!keep[index]) {
      open = false;

      return;
    }

    if (!open) {
      hunks.push(`@@ line ${String(line.at)} @@`);
      open = true;
    }

    hunks.push(`${line.kind}${line.text}`);
  });

  return hunks.length === 0 ? '' : [`--- ${file}`, `+++ ${file}`, ...hunks].join('\n');
};
