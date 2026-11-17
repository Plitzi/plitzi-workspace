import { CREDENTIAL_KINDS } from '@plitzi/sdk-shared/credentials';

import CredentialField from './components/CredentialField';

import type { SpaceCredentialProvider } from '@plitzi/sdk-shared';

export type CredentialFieldsProps = {
  provider: SpaceCredentialProvider;
};

/** A kind's fields, in its catalogue's order. */
const CredentialFields = ({ provider }: CredentialFieldsProps) => (
  <>
    {CREDENTIAL_KINDS[provider].fields.map(field => (
      <CredentialField key={field.key} field={field} />
    ))}
  </>
);

export default CredentialFields;
