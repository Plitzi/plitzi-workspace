export type ExportLockedProps = {
  /** The plan the workspace is on, to say what it is being compared with. */
  planName?: string;
};

/** What export is and which plans have it — in place of the result, for a workspace on the free plan. */
const ExportLocked = ({ planName = 'Free' }: ExportLockedProps) => (
  <div className="flex grow flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
      <i className="fa-solid fa-lock" />
    </div>
    <h5 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Export is part of the paid plans</h5>
    <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
      Take a copy of this space as JSON, or as the TypeScript that builds it with @plitzi/sdk-authoring — ready to paste
      into your editor or keep in version control. Your workspace is on the <b>{planName}</b> plan; upgrade it from the
      workspace’s billing to export.
    </p>
  </div>
);

export default ExportLocked;
