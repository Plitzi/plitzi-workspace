import { useCallback } from 'react';

import { ENVIRONMENT_META } from '../../helpers/environments';

import type { PublishedEnvironment } from '../../helpers/environments';
import type { SpaceSnapshot, SpaceVersionChanges } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

export type SaveFirstProps = {
  environment: PublishedEnvironment;
  latest: SpaceSnapshot | undefined;
  /** What changed in the editor since that version: nothing, and there is nothing to keep. */
  changes: SpaceVersionChanges | undefined;
  checked: boolean;
  description: string;
  onChecked: (checked: boolean) => void;
  onDescription: (description: string) => void;
};

const countOf = (total: number) => (total === 1 ? '1 change' : `${String(total)} changes`);

/**
 * Whether what is in the editor is kept as the environment's next version before the domain shows its latest — the
 * step Snapshot is, done here; required when the environment has none, and not offered when nothing changed.
 */
const SaveFirst = ({
  environment,
  latest,
  changes,
  checked,
  description,
  onChecked,
  onDescription
}: SaveFirstProps) => {
  const label = ENVIRONMENT_META[environment].label;
  const handleChecked = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onChecked(event.target.checked),
    [onChecked]
  );
  const handleDescription = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onDescription(event.target.value),
    [onDescription]
  );

  if (latest && changes?.total === 0) {
    return (
      <span className="text-ui-fg-subtle flex items-center gap-1.5 text-xs">
        <i className="fa-solid fa-check text-emerald-500" aria-hidden />
        What is in the editor is already {label} v{latest.revision}.
      </span>
    );
  }

  return (
    <div className="bg-ui-raised flex flex-col gap-2 rounded-lg px-3 py-2.5">
      {latest ? (
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="accent-primary-500 mt-0.5 size-4"
            checked={checked}
            onChange={handleChecked}
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-ui-fg text-sm">Keep your current changes as a new {label} version first</span>
            <span className="text-ui-fg-subtle text-xs">
              {changes ? `${countOf(changes.total)} since v${String(latest.revision)}. ` : ''}
              {checked
                ? 'They go out with this publish.'
                : `Unchecked, it shows v${String(latest.revision)}; your changes wait in the editor.`}
            </span>
          </span>
        </label>
      ) : (
        <span className="text-ui-fg text-sm">
          {label} has no versions yet: your current changes are kept as its first.
        </span>
      )}
      {checked && (
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
      )}
    </div>
  );
};

export default SaveFirst;
