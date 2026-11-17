import Button from '@plitzi/plitzi-ui/Button';

export type SheetFooterProps = {
  /** "Roll back to …", when there is something to go back to and no rollback is being asked already. */
  rollbackLabel?: string;
  rollbackTitle: string;
  /** A domain chosen in the publish view: Publish, Schedule and Cancel; otherwise only Close. */
  publishing: boolean;
  /** The plan that includes scheduling, when the space's does not; undefined while it may be offered at all. */
  schedule?: { lockedBy: string | undefined; shown: boolean };
  /** What Publish says, and whether it may be pressed. */
  action: { words: string; disabled: boolean };
  onRollBack: () => void;
  onSchedule: () => void;
  onClose: () => void;
  onPublish: () => void;
};

const QUIET_BUTTON = 'border-transparent bg-transparent text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover';

/** The sheet's actions: going back on the left; scheduling, leaving and publishing on the right. */
const SheetFooter = ({
  rollbackLabel,
  rollbackTitle,
  publishing,
  schedule,
  action,
  onRollBack,
  onSchedule,
  onClose,
  onPublish
}: SheetFooterProps) => (
  <div className="flex flex-wrap items-center justify-end gap-2">
    {rollbackLabel && (
      <Button
        size="sm"
        intent="secondary"
        className="mr-auto shrink-0 whitespace-nowrap"
        iconPlacement="before"
        title={rollbackTitle}
        onClick={onRollBack}
      >
        <Button.Icon icon="fa-solid fa-rotate-left" />
        {rollbackLabel}
      </Button>
    )}
    {publishing && schedule?.shown && (
      <Button
        size="sm"
        intent="custom"
        className={QUIET_BUTTON}
        iconPlacement="before"
        disabled={schedule.lockedBy !== undefined}
        title={
          schedule.lockedBy
            ? `Publishing at a set time is included in the ${schedule.lockedBy} plan`
            : 'Publish at a moment of your choosing'
        }
        onClick={onSchedule}
      >
        <Button.Icon icon={schedule.lockedBy ? 'fa-solid fa-lock' : 'fa-solid fa-clock'} />
        Schedule…
      </Button>
    )}
    <Button size="sm" intent="custom" className={QUIET_BUTTON} onClick={onClose}>
      {publishing ? 'Cancel' : 'Close'}
    </Button>
    {publishing && (
      <Button size="sm" disabled={action.disabled} onClick={onPublish}>
        {action.words}
      </Button>
    )}
  </div>
);

export default SheetFooter;
