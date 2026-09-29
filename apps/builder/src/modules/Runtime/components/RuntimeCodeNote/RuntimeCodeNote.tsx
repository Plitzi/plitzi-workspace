import idleDurationOf from '../../helpers/idleDurationOf';

export type RuntimeCodeNoteProps = {
  /** Whether the space has a runtime yet: without one, what a runtime is comes first. */
  pushed: boolean;
  /** How long a runtime may go unused before it is stopped; 0 when the platform never stops one. */
  idleMinutes: number;
};

/**
 * Where a runtime's code comes from, said where the question comes up: nothing in the builder changes it. It is a
 * project of the space owner's own — Node, its packages — packed and pushed from there, and published with the space.
 */
const RuntimeCodeNote = ({ pushed, idleMinutes }: RuntimeCodeNoteProps) => (
  <div className="flex flex-col gap-2 rounded-sm border border-gray-200 px-3 py-2 text-sm text-gray-600 dark:border-zinc-700 dark:text-zinc-300">
    {!pushed && (
      <p>
        A runtime is this space’s own server code, run beside it — for what its functions cannot be: a connection kept
        open, memory that outlives a request, Node and its packages.
      </p>
    )}
    <p>
      Its code lives in a project of yours — a folder, usually a repository — as <code>src/runtime.ts</code>, whose
      default export is <code>defineRuntime(…)</code>. It is written and changed there, not here. From that project:
    </p>
    <ol className="flex list-decimal flex-col gap-1 pl-5">
      <li>
        <code>plitzi login</code>, then <code>plitzi space</code> to choose this space.
      </li>
      <li>
        <code>plitzi runtime push</code> — packed and kept as the draft’s runtime, which starts on it.
      </li>
      <li>Publish the space — its published site starts on the same code.</li>
    </ol>
    <p>
      Here: how it runs, and the variables it starts with. A project made with <code>plitzi create</code> in server mode
      has what a push needs; any other, <code>npm install @plitzi/sdk-server</code>.
    </p>
    {idleMinutes > 0 && (
      <p>
        A runtime nobody uses for {idleDurationOf(idleMinutes)} — no request to its endpoints, no task run — stops by
        itself, so it spends nothing while idle. Start it again here; a push or a publish starts it too.
      </p>
    )}
  </div>
);

export default RuntimeCodeNote;
