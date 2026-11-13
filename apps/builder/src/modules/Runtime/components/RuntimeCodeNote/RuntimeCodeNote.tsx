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
const CODE = 'rounded bg-ui-raised px-1.5 py-0.5 font-mono text-[12px] text-ui-fg';

const STEP =
  'flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-semibold text-primary-700 dark:bg-primary-400/15 dark:text-primary-200';

/** How a runtime gets here: it is written in a project of the author's and pushed, never edited in the builder. */
const RuntimeCodeNote = ({ pushed, idleMinutes }: RuntimeCodeNoteProps) => (
  <div className="border-ui-line text-ui-fg-muted flex flex-col gap-4 rounded-lg border p-4 text-sm leading-relaxed">
    <p>
      {pushed ? 'Its code' : 'The code'} lives in a project of yours — a folder, usually a repository — as{' '}
      <code className={CODE}>src/runtime.ts</code>, whose default export is{' '}
      <code className={CODE}>defineRuntime(…)</code>. It is written and changed there, not here. From that project:
    </p>
    <ol className="flex flex-col gap-2.5">
      <li className="flex items-start gap-3">
        <span className={STEP}>1</span>
        <span>
          <code className={CODE}>plitzi login</code>, then <code className={CODE}>plitzi space use</code> to choose this
          space.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className={STEP}>2</span>
        <span>
          <code className={CODE}>plitzi runtime push</code> — packed and kept as the draft’s runtime, which starts on
          it.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className={STEP}>3</span>
        <span>Publish the space — its published site starts on the same code.</span>
      </li>
    </ol>
    <p className="text-ui-fg-subtle text-xs">
      A project made with <code className={CODE}>plitzi create</code> in server mode has what a push needs; any other,{' '}
      <code className={CODE}>npm install @plitzi/sdk-server @plitzi/sdk-runtime</code>.
      {idleMinutes > 0 &&
        ` A runtime nobody uses for ${idleDurationOf(idleMinutes)} — no request to its endpoints, no task run — stops by itself, so it spends nothing while idle. Start it again here; a push or a publish starts it too.`}
    </p>
  </div>
);

export default RuntimeCodeNote;
