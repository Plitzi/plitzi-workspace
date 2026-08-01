/** What the host has streamed of the tool call so far, reduced to the little a placeholder can honestly show.
 *
 *  The wait a user sees is almost entirely the model TYPING this batch — the server render takes milliseconds —
 *  so the only way to look alive is to read the arguments while they are still arriving. The host sends them as
 *  "healed" JSON (it closes the braces the model has not written yet), which means every field may be missing and
 *  the last operation is usually half-written: nothing here may assume a shape, and a fragment it cannot read
 *  simply contributes nothing.
 *
 *  Two properties this module owes the view, because a placeholder that misbehaves is worse than none:
 *  - it is TOTAL — no input throws, and every number it returns is a finite count;
 *  - it only ever moves FORWARD (see mergeProgress) — healing is best-effort and the spec warns that fields may
 *    change between notifications, so a frame that recovers less than the one before it must not shrink the
 *    placeholder, which the eye reads as flicker. */
export type StreamProgress = { elements: number; title?: string; patch: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// The walk is over a structure this code did not build, so it is bounded rather than trusted: a pathological
// nesting would otherwise turn a placeholder into a stack overflow, which kills the view for good — including
// the widget that was on its way. Far beyond anything a real widget nests.
const MAX_DEPTH = 64;

// A title is a label in a small panel: whitespace collapsed so a multi-line heading cannot push the bars off
// screen, and cut where it stops being a label.
const MAX_TITLE = 80;

// A repeat renders its template once per row, so the rows are what the user will actually count on screen. An
// items list that has not started streaming yet still stands for at least the one template being written.
const rowsOf = (items: unknown): number => Math.max(asArray(items).length, 1);

const countElements = (node: unknown, depth = 0): number => {
  if (!isRecord(node) || depth > MAX_DEPTH) {
    return 0;
  }

  const repeat = isRecord(node.repeat) ? node.repeat : undefined;
  const nested = repeat ? countElements(repeat.template, depth + 1) * rowsOf(repeat.items) : 0;

  return asArray(node.children).reduce<number>((total, child) => total + countElements(child, depth + 1), 1 + nested);
};

// A heading's content arrives one fragment at a time, so this runs against half-written text: `{{` rules out a
// repeat template's placeholder (a literal "{{item.name}}" on screen reads as a bug, not as progress), and an
// empty string is what a heading looks like before its content exists at all.
const titleOf = (content: unknown): string | undefined => {
  if (typeof content !== 'string' || content.includes('{{')) {
    return undefined;
  }

  const text = content.replace(/\s+/gu, ' ').trim();
  if (text === '') {
    return undefined;
  }

  return text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE)}…` : text;
};

// The first heading the batch declares is the widget's own title far more often than not, so showing it turns the
// placeholder from "something is happening" into "your pricing table is coming".
const findTitle = (node: unknown, depth = 0): string | undefined => {
  if (!isRecord(node) || depth > MAX_DEPTH) {
    return undefined;
  }

  const props = isRecord(node.props) ? node.props : undefined;
  if (node.type === 'heading') {
    const title = titleOf(props?.content);
    if (title !== undefined) {
      return title;
    }
  }

  for (const child of asArray(node.children)) {
    const found = findTitle(child, depth + 1);
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
};

// An op either builds a tree (upsertElement) or repeats one (repeatElement); anything else — a definition, a
// binding, the truncated tail — adds no elements to count.
const treeOf = (op: Record<string, unknown>): unknown => {
  if (isRecord(op.element)) {
    return op.element;
  }

  return isRecord(op.template) ? op.template : undefined;
};

export const streamProgress = (args: unknown): StreamProgress => {
  const record = isRecord(args) ? args : {};
  let elements = 0;
  let title: string | undefined;

  for (const op of asArray(record.operations)) {
    if (!isRecord(op)) {
      continue;
    }

    const tree = treeOf(op);
    if (tree === undefined) {
      continue;
    }

    elements += countElements(tree) * (isRecord(op.template) ? rowsOf(op.items) : 1);
    title ??= findTitle(tree);
  }

  return { elements: Number.isFinite(elements) ? elements : 0, title, patch: record.patch === true };
};

/** Fold a freshly read frame into what the placeholder already shows. Monotonic on purpose — the count never goes
 *  down and a title, once read, is never taken away — because the healed JSON of frame N+1 can legitimately
 *  recover LESS than frame N, and a placeholder that shrinks and grows is the flicker this whole thing exists to
 *  avoid. Returns the previous object unchanged when nothing moved, so an unchanged frame costs no re-render. */
export const mergeProgress = (previous: StreamProgress | undefined, next: StreamProgress): StreamProgress => {
  if (!previous) {
    return next;
  }

  const merged: StreamProgress = {
    elements: Math.max(previous.elements, next.elements),
    title: next.title ?? previous.title,
    patch: previous.patch || next.patch
  };
  if (merged.elements === previous.elements && merged.title === previous.title && merged.patch === previous.patch) {
    return previous;
  }

  return merged;
};
