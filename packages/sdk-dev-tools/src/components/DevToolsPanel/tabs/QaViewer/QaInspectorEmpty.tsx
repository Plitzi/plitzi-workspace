/** What the inspector side says before anything is picked. */
const QaInspectorEmpty = () => (
  <div className="border-ui-line text-ui-fg-subtle flex flex-col gap-1.5 rounded border border-dashed p-3">
    <span className="text-ui-fg font-medium">Nothing inspected yet</span>
    <span>
      Turn on <b>Inspect</b> and point at anything on the page: its box, type, colours and contrast show by the pointer.
      Click it to keep it here, with the CSS that reaches it. With one kept, hold <b>Alt</b> over another to measure the
      distance between them.
    </span>
  </div>
);

export default QaInspectorEmpty;
