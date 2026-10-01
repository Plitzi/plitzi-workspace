export type FunctionsGuideProps = {
  /** Whether the code declares any task yet. */
  hasTasks: boolean;
};

/** The inspector's place with no task in it: how to get one there. */
const FunctionsGuide = ({ hasTasks }: FunctionsGuideProps) => (
  <aside className="flex w-80 shrink-0 flex-col items-center justify-center gap-3 border-l border-gray-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
    <span className="flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
      <i className="fa-solid fa-bolt" />
    </span>
    {!hasTasks && (
      <span className="text-sm text-gray-600 dark:text-zinc-300">
        Add a task with + in Tasks, or write one in <code>defineFunctions</code>: it shows up here as you type.
      </span>
    )}
    {hasTasks && (
      <span className="text-sm text-gray-600 dark:text-zinc-300">Pick a task to set its time limit and test it.</span>
    )}
  </aside>
);

export default FunctionsGuide;
