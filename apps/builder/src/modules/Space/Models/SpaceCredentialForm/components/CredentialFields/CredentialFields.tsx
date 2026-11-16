import Form from '@plitzi/plitzi-ui/Form';

import { CREDENTIAL_KINDS } from '@plitzi/sdk-shared/credentials';

import CredentialField from './components/CredentialField';

import type { SpaceCredentialProvider } from '@plitzi/sdk-shared';

export type CredentialFieldsProps = {
  provider: SpaceCredentialProvider;
};

/** A kind's fields in its catalogue's order, each one asked only when the values beside it call for it. */
const CredentialFields = ({ provider }: CredentialFieldsProps) => (
  <>
    {CREDENTIAL_KINDS[provider].fields.map(field => {
      if (!field.when) {
        return <CredentialField key={field.key} field={field} />;
      }

      return (
        <Form.Conditional key={field.key} when={`data.${field.when.key}`} is={field.when.is}>
          <CredentialField field={field} />
        </Form.Conditional>
      );
    })}
  </>
);

export default CredentialFields;
