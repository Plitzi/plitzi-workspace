import Button from '@plitzi/plitzi-ui/Button';

import { CREDENTIAL_KINDS } from '@plitzi/sdk-shared/credentials';

import type { SpaceCredentialProvider } from '@plitzi/sdk-shared';

export type ProviderSummaryProps = {
  provider: SpaceCredentialProvider;
  /** Back to choosing another kind; absent when the kind is fixed (a credential edited, or the only one offered). */
  onChange?: () => void;
};

/** The kind being filled in, said at the top of its fields: what it is and what it signs in to. */
const ProviderSummary = ({ provider, onChange }: ProviderSummaryProps) => {
  const { label, icon, purpose } = CREDENTIAL_KINDS[provider];

  return (
    <div className="border-ui-line bg-ui-raised flex items-center gap-3 rounded-lg border p-3">
      <span className="bg-ui-panel text-ui-fg flex size-9 shrink-0 items-center justify-center rounded-md text-lg">
        <i className={icon} aria-hidden />
      </span>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-ui-fg text-sm font-medium">{label}</span>
        <span className="text-ui-fg-subtle text-xs">{purpose}</span>
      </span>
      {onChange && (
        <Button size="xs" intent="secondary" onClick={onChange}>
          Change
        </Button>
      )}
    </div>
  );
};

export default ProviderSummary;
