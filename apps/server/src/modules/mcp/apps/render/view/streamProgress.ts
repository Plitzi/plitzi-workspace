/** What the host has streamed of the tool call so far, reduced to the little a placeholder can honestly show.
 *
 *  The wait a user sees is almost entirely the model TYPING this batch — the server render takes milliseconds —
 *  so the only way to look alive is to read the arguments while they are still arriving. The host sends them as
 *  "healed" JSON (it closes the braces the model has not written yet), which means every field may be missing and
 *  the last operation is usually half-written: nothing here may assume a shape, and a fragment it cannot read
 *  simply contributes nothing. */
export type StreamProgress = { elements: number; title?: string; patch: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// A repeat renders its template once per row, so the rows are what the user will actually count on screen. An
// items list that has not started streaming yet still stands for at least the one template being written.
const rowsOf = (items: unknown): number => Math.max(asArray(items).length, 1);

const countElements = (node: unknown): number => {
  if (!isRecord(node)) {
    return 0;
  }

  const repeat = isRecord(node.repeat) ? node.repeat : undefined;
  const nested = repeat ? countElements(repeat.template) * rowsOf(repeat.items) : 0;

  return asArray(node.children).reduce<number>((total, child) => total + countElements(child), 1 + nested);
};

// The first heading the batch declares is the widget's own title far more often than not, so showing it turns the
// placeholder from "something is happening" into "your pricing table is coming". A heading inside a repeat
// template is skipped: its content is a {{item.…}} placeholder, which would read as a glitch.
const findTitle = (node: unknown): string | undefined => {
  if (!isRecord(node)) {
    return undefined;
  }

  const props = isRecord(node.props) ? node.props : undefined;
  const content = props?.content;
  if (node.type === 'heading' && typeof content === 'string' && content.trim() !== '' && !content.includes('{{')) {
    return content.trim();
  }

  for (const child of asArray(node.children)) {
    const found = findTitle(child);
    if (found) {
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

  return { elements, title, patch: record.patch === true };
};
