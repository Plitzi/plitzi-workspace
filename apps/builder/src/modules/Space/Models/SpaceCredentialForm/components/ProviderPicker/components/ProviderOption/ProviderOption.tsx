import { useCallback } from 'react';

import { CREDENTIAL_KINDS } from '@plitzi/sdk-shared/credentials';

import type { SpaceCredentialProvider } from '@plitzi/sdk-shared';

export type ProviderOptionProps = {
  provider: SpaceCredentialProvider;
  onChoose: (provider: SpaceCredentialProvider) => void;
};

/** One kind of credential to choose: its mark, its name and what it signs in to. */
const ProviderOption = ({ provider, onChoose }: ProviderOptionProps) => {
  const { label, icon, purpose } = CREDENTIAL_KINDS[provider];

  const handleClick = useCallback(() => onChoose(provider), [onChoose, provider]);

  return (
    <button
      type="button"
      title={purpose}
      onClick={handleClick}
      className="group border-ui-line bg-ui-panel hover:border-primary-400 hover:bg-ui-hover focus-visible:ring-primary-500 flex items-start gap-3 rounded-lg border p-3 text-left transition-colors duration-150 outline-none focus-visible:ring-2"
    >
      <span className="bg-ui-raised text-ui-fg group-hover:text-primary-500 flex size-8 shrink-0 items-center justify-center rounded-md text-base">
        <i className={icon} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-ui-fg text-sm font-medium">{label}</span>
        <span className="text-ui-fg-subtle line-clamp-3 text-xs">{purpose}</span>
      </span>
    </button>
  );
};

export default ProviderOption;
