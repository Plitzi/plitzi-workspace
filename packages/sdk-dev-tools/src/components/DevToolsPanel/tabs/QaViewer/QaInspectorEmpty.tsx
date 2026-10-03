/** What the inspector side says before anything is picked. */
const QaInspectorEmpty = () => (
  <div className="flex flex-col gap-1.5 rounded border border-dashed border-zinc-200 p-3 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
    <span className="font-medium text-zinc-700 dark:text-zinc-200">Nothing inspected yet</span>
    <span>
      Turn on <b>Inspect</b> and point at anything on the page: its box, type, colours and contrast show by the pointer.
      Click it to keep it here, with the CSS that reaches it. With one kept, hold <b>Alt</b> over another to measure the
      distance between them.
    </span>
  </div>
);

export default QaInspectorEmpty;
