export type FunctionsGuideProps = {
  /** Whether the code declares any task yet. */
  hasTasks: boolean;
};

/** The inspector's place with no task in it: how to get one there. */
const FunctionsGuide = ({ hasTasks }: FunctionsGuideProps) => (
  <aside className="border-ui-line bg-ui-backdrop flex w-80 shrink-0 flex-col items-center justify-center gap-3 border-l p-6 text-center">
    <span className="bg-ui-raised text-ui-fg-subtle flex size-10 items-center justify-center rounded-full">
      <i className="fa-solid fa-bolt" />
    </span>
    {!hasTasks && (
      <span className="text-ui-fg-muted text-sm">
        Add a task with + in Tasks, or write one in <code>defineFunctions</code>: it shows up here as you type.
      </span>
    )}
    {hasTasks && <span className="text-ui-fg-muted text-sm">Pick a task to set its time limit and test it.</span>}
  </aside>
);

export default FunctionsGuide;
