import Button from '@plitzi/plitzi-ui/Button';

export type ExportLockedProps = {
  /** The plan the workspace is on, to say what it is being compared with. */
  planName?: string;
  /** Shows the JSON instead, which every plan exports. */
  onPickJson: () => void;
};

/** What exporting as code is and which plans have it — in place of the result, for a workspace on the free plan. */
const ExportLocked = ({ planName = 'Free', onPickJson }: ExportLockedProps) => (
  <div className="flex grow flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
    <div className="bg-primary-100 text-primary-600 dark:bg-primary-400/15 dark:text-primary-300 flex h-11 w-11 items-center justify-center rounded-full">
      <i className="fa-solid fa-lock" />
    </div>
    <h5 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
      Exporting as code is part of the paid plans
    </h5>
    <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
      The TypeScript that builds this space with @plitzi/sdk-authoring — ready to paste into your editor or keep in
      version control. Your workspace is on the <b>{planName}</b> plan; upgrade it from the workspace’s billing to
      export it. Your work is yours on every plan: its documents download as JSON.
    </p>
    <Button size="sm" intent="secondary" onClick={onPickJson}>
      Export as JSON
    </Button>
  </div>
);

export default ExportLocked;
