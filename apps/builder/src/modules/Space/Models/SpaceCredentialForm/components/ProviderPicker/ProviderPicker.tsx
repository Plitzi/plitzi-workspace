import { useMemo } from 'react';

import ProviderOption from './components/ProviderOption';
import { offeredGroups } from '../../helpers';

import type { SpaceCredentialProvider } from '@plitzi/sdk-shared';

export type ProviderPickerProps = {
  /** The kinds the caller can use; every kind when none. */
  providers?: SpaceCredentialProvider[];
  onChoose: (provider: SpaceCredentialProvider) => void;
};

/** What a new credential signs in to, chosen first: each kind with what it is for, in the catalogue's groups. */
const ProviderPicker = ({ providers, onChoose }: ProviderPickerProps) => {
  const groups = useMemo(() => offeredGroups(providers), [providers]);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-ui-fg text-sm font-medium">What does it sign in to?</p>
      {groups.map(group => (
        <section key={group.id} className="flex flex-col gap-2" aria-label={group.label}>
          <h5 className="text-ui-fg-subtle text-xs font-medium">{group.label}</h5>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-2">
            {group.providers.map(provider => (
              <ProviderOption key={provider} provider={provider} onChoose={onChoose} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default ProviderPicker;
