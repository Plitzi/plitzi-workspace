import Button from '@plitzi/plitzi-ui/Button';

import Notice from '../../components/Notice';

export type PublishDoneProps = {
  said: string;
  /** "Roll back to r3": offered when there is something to put back. */
  rollbackLabel?: string;
  onRollBack: () => void;
  onOpenSite: () => void;
  onDone: () => void;
};

/** What a publish, a schedule or a rollback did, and the next steps: look at the site, or undo it. */
const PublishDone = ({ said, rollbackLabel, onRollBack, onOpenSite, onDone }: PublishDoneProps) => (
  <div className="flex flex-col gap-4">
    <Notice tone="success">{said}</Notice>
    <div className="flex justify-end gap-2">
      {rollbackLabel && (
        <Button
          size="sm"
          intent="secondary"
          className="mr-auto whitespace-nowrap"
          iconPlacement="before"
          onClick={onRollBack}
        >
          <Button.Icon icon="fa-solid fa-rotate-left" />
          {rollbackLabel}
        </Button>
      )}
      <Button size="sm" intent="secondary" onClick={onOpenSite}>
        Open the site
      </Button>
      <Button size="sm" onClick={onDone}>
        Done
      </Button>
    </div>
  </div>
);

export default PublishDone;
