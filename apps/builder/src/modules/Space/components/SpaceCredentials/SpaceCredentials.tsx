import SpaceCredential from './SpaceCredential';

import type { Credential } from '@plitzi/sdk-shared';

export type SpaceCredentialsProps = {
  credentials?: Credential[];
  selected?: string;
  onSelect?: (identifier: string) => void;
  onRemove?: (identifier: string) => void;
};

const SpaceCredentials = ({ credentials = [], selected = '', onSelect, onRemove }: SpaceCredentialsProps) => {
  return (
    <div className="flex max-h-75 flex-col gap-2 overflow-y-auto">
      {credentials.map(
        ({ name, identifier, provider, inUse, usedIn, createdAt, updatedAt }) => (
          <SpaceCredential
            key={identifier}
            identifier={identifier}
            name={name}
            selected={identifier === selected}
            provider={provider}
            inUse={inUse}
            usedIn={usedIn}
            createdAt={createdAt}
            updatedAt={updatedAt}
            onSelect={onSelect}
            onRemove={onRemove}
          />
        ),
        []
      )}
    </div>
  );
};

export default SpaceCredentials;
