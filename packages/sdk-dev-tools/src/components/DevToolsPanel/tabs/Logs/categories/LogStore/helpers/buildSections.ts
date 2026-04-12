import type { DiffLine, Hunk, Section } from '../LogStoreBody';

const buildSections = (diff: DiffLine[], hunks: Hunk[], contextLines: number): Section[] => {
  if (hunks.length === 0) {
    return diff.map((line, i) => ({ kind: 'line', line, diffIndex: i, hunkIndex: null }));
  }

  const sections: Section[] = [];
  let lastEnd = -1;

  hunks.forEach((hunk, hunkIdx) => {
    const ctxStart = Math.max(0, hunk.start - contextLines);
    const ctxEnd = Math.min(diff.length - 1, hunk.end + contextLines);

    if (ctxStart > lastEnd + 1) {
      sections.push({ kind: 'separator', hunkIndex: hunkIdx, total: hunks.length });
    }

    for (let i = Math.max(ctxStart, lastEnd + 1); i <= ctxEnd; i++) {
      const inHunk = i >= hunk.start && i <= hunk.end;
      sections.push({ kind: 'line', line: diff[i], diffIndex: i, hunkIndex: inHunk ? hunkIdx : null });
    }

    lastEnd = ctxEnd;
  });

  return sections;
};

export default buildSections;
