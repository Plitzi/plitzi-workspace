import Button from '@plitzi/plitzi-ui/Button';
import Heading from '@plitzi/plitzi-ui/Heading';
import Text from '@plitzi/plitzi-ui/Text';

import SpaceCredentialsEmpty from './SpaceCredentialsEmpty';
import SpaceCredentials from '../SpaceCredentials';

import type { SpaceCredential, SpaceCredentialProvider } from '@plitzi/sdk-shared';

export type ModalBodyProps = {
  providersSupported?: SpaceCredentialProvider[];
  credentials?: SpaceCredential[];
  credentialSelected?: string;
  onClickAddCredential?: () => void;
  onSelectCredential?: (identifier: string) => void;
  onRemoveCredential?: (identifier: string) => void;
};

const ModalBody = ({
  providersSupported,
  credentials,
  credentialSelected,
  onClickAddCredential,
  onSelectCredential,
  onRemoveCredential
}: ModalBodyProps) => {
  return (
    <>
      <div className="flex flex-col">
        <Heading as="h4">My Credentials</Heading>
        <Text size="sm" className="text-gray-500">
          Manage your authentication credentials and API keys
        </Text>
      </div>
      {credentials && credentials.length > 0 && (
        <div className="flex items-center justify-between">
          <span>
            {credentials.length === 1
              ? `${credentials.length} credential configured`
              : `${credentials.length} credentials configured`}
          </span>
          <Button size="xs" onClick={onClickAddCredential}>
            Add Credential
          </Button>
        </div>
      )}
      {credentials && credentials.length > 0 && (
        <SpaceCredentials
          providersSupported={providersSupported}
          credentials={credentials}
          selected={credentialSelected}
          onSelect={onSelectCredential}
          onRemove={onRemoveCredential}
        />
      )}
      {(!credentials || credentials.length === 0) && (
        <SpaceCredentialsEmpty>
          <Button size="xs" onClick={onClickAddCredential}>
            Add Credential
          </Button>
        </SpaceCredentialsEmpty>
      )}
    </>
  );
};

export default ModalBody;
