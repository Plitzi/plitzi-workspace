import SpaceCredential from './SpaceCredential';

import type { SpaceCredentialProvider, SpaceCredential as TSpaceCredential } from '@plitzi/sdk-shared';

export type SpaceCredentialsProps = {
  providersSupported?: SpaceCredentialProvider[];
  credentials?: TSpaceCredential[];
  selected?: string;
  onSelect?: (identifier: string) => void;
  /** Offers replacing a credential's values. Left out, a row offers nothing but selecting and removing it. */
  onEdit?: (identifier: string) => void;
  onRemove?: (identifier: string) => void;
};

const SpaceCredentials = ({
  providersSupported,
  credentials,
  selected = '',
  onSelect,
  onEdit,
  onRemove
}: SpaceCredentialsProps) => {
  return (
    <div className="flex max-h-75 flex-col gap-2 overflow-y-auto">
      {credentials?.map(
        ({ name, identifier, provider, inUse, usedIn, createdAt, updatedAt }) => (
          <SpaceCredential
            key={identifier}
            providersSupported={providersSupported}
            identifier={identifier}
            name={name}
            selected={identifier === selected}
            provider={provider}
            inUse={inUse}
            usedIn={usedIn}
            createdAt={createdAt}
            updatedAt={updatedAt}
            onSelect={onSelect}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        ),
        []
      )}
    </div>
  );
};

export default SpaceCredentials;
