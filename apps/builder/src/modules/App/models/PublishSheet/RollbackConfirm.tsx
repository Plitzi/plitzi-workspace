import Button from '@plitzi/plitzi-ui/Button';

import { versionName } from './helpers';

import type { SpaceServedVersion } from '@plitzi/sdk-shared';

export type RollbackConfirmProps = {
  domain: string;
  version: SpaceServedVersion;
  holdsACopy: boolean;
  working: boolean;
  onKeep: () => void;
  onConfirm: () => void;
};

const QUIET_BUTTON = 'border-transparent bg-transparent text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover';

/** A rollback asked for, said before it happens: what goes back, how soon, and what it leaves as it is. */
const RollbackConfirm = ({ domain, version, holdsACopy, working, onKeep, onConfirm }: RollbackConfirmProps) => (
  <div
    role="alertdialog"
    aria-label="Roll back"
    className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
  >
    <p className="text-ui-fg">
      Put {versionName(version)} back on <b>{domain}</b>?{' '}
      {holdsACopy
        ? 'Its copy is shipped again — from the deploy kept for it when there is one.'
        : 'It is live at once.'}
    </p>
    <p className="text-ui-fg-subtle text-xs">
      Feature flags and the space’s data stay as they are now: they are the environment’s, not the version’s.
    </p>
    <div className="flex justify-end gap-2">
      <Button size="sm" intent="custom" className={QUIET_BUTTON} onClick={onKeep}>
        Keep it as it is
      </Button>
      <Button size="sm" intent="secondary" disabled={working} onClick={onConfirm}>
        {working ? 'Rolling back…' : 'Roll back'}
      </Button>
    </div>
  </div>
);

export default RollbackConfirm;
