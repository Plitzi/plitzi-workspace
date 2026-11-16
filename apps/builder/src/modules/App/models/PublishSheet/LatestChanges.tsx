import { useCallback } from 'react';

import { ENVIRONMENT_META } from '../../helpers/environments';

import type { PublishedEnvironment } from '../../helpers/environments';
import type { ChangeEvent } from 'react';

export type LatestChangesProps = {
  environment: PublishedEnvironment;
  /** The environments the plan includes, to keep them in: a choice only when there is more than one. */
  environments: readonly PublishedEnvironment[];
  /** Already kept as that version: nothing new to keep, it is published as it is. */
  keptAs: number | undefined;
  description: string;
  onEnvironment: (environment: PublishedEnvironment) => void;
  onDescription: (description: string) => void;
};

/**
 * What "your latest changes" asks before they go out: a line on what changed — kept with the version, for whoever looks
 * back — and, when the plan has more than one, which environment keeps them.
 */
const LatestChanges = ({
  environment,
  environments,
  keptAs,
  description,
  onEnvironment,
  onDescription
}: LatestChangesProps) => {
  const handleEnvironment = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const picked = environments.find(each => each === event.target.value);
      if (picked) {
        onEnvironment(picked);
      }
    },
    [environments, onEnvironment]
  );
  const handleDescription = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onDescription(event.target.value),
    [onDescription]
  );

  if (keptAs !== undefined) {
    return (
      <span className="text-ui-fg-subtle text-xs">
        Nothing changed since you kept them as {ENVIRONMENT_META[environment].label} r{keptAs}: that version is
        published.
      </span>
    );
  }

  return (
    <>
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
      {environments.length > 1 && (
        <label className="flex items-center gap-2 text-xs">
          <span className="text-ui-fg-subtle">Keep it as a version of</span>
          <select
            className="border-ui-line bg-ui-panel text-ui-fg rounded-md border px-1.5 py-1 text-xs"
            value={environment}
            onChange={handleEnvironment}
          >
            {environments.map(each => (
              <option key={each} value={each}>
                {ENVIRONMENT_META[each].label}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
};

export default LatestChanges;
