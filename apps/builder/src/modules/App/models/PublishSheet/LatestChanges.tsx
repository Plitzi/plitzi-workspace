import { useCallback } from 'react';

import { revisionName } from '../../helpers/environments';

import type { PublishedEnvironment } from '../../helpers/environments';
import type { ChangeEvent } from 'react';

export type LatestChangesProps = {
  environment: PublishedEnvironment;
  /** Already kept as that version: nothing new to keep, it is published as it is. */
  keptAs: number | undefined;
  description: string;
  onDescription: (description: string) => void;
};

/** What "your latest changes" asks before they go out: a line on what changed, kept with the version for whoever looks back. */
const LatestChanges = ({ environment, keptAs, description, onDescription }: LatestChangesProps) => {
  const handleDescription = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onDescription(event.target.value),
    [onDescription]
  );

  if (keptAs !== undefined) {
    return (
      <span className="text-ui-fg-subtle text-xs">
        Nothing changed since you kept them as {revisionName(environment, keptAs)}: that version is published.
      </span>
    );
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-ui-fg text-xs font-medium">What changed? (optional)</span>
      <input
        type="text"
        maxLength={200}
        value={description}
        placeholder="New pricing section, fixed the contact form…"
        className="border-ui-line bg-ui-panel text-ui-fg focus:border-primary-500 rounded-md border px-2 py-1.5 text-sm outline-none"
        onChange={handleDescription}
      />
    </label>
  );
};

export default LatestChanges;
