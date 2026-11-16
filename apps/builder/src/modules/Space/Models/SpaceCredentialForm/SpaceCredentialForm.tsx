import Button from '@plitzi/plitzi-ui/Button';
import { useCallback, useState } from 'react';

import CredentialEditor from './components/CredentialEditor';
import ProviderPicker from './components/ProviderPicker';

import type { SpaceCredentialFormValues } from './helpers';
import type { SpaceCredentialProvider } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type SpaceCredentialFormProps = {
  name?: string;
  /** The kind it is: fixed when editing; a new one starts on it, or on choosing one when none is given. */
  provider?: SpaceCredentialProvider;
  /** The kinds the caller can use (a CDN takes a storage key); every kind when none. */
  providers?: SpaceCredentialProvider[];
  /**
   * Replaces the values of a credential that already exists. Its kind is fixed — a CDN, a domain, a deploy or a flow
   * reads its values as that kind's — and nothing it holds is shown: every value is typed again and all are replaced.
   */
  editing?: boolean;
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: SpaceCredentialFormValues) => void;
};

/** A space's credential: what it signs in to, chosen first, then that provider's own fields. */
const SpaceCredentialForm = ({
  name,
  provider: providerProp,
  providers,
  editing = false,
  onSubmit,
  onClose
}: SpaceCredentialFormProps) => {
  const only = providers?.length === 1 ? providers[0] : undefined;
  const fixed = editing || only !== undefined;
  const [provider, setProvider] = useState<SpaceCredentialProvider | undefined>(providerProp ?? only);

  const handleChangeProvider = useCallback(() => setProvider(undefined), []);

  if (!provider) {
    return (
      <div className="flex max-w-5xl flex-col gap-4">
        <ProviderPicker providers={providers} onChoose={setProvider} />
        <div className="border-ui-line flex justify-end border-t pt-4">
          <Button onClick={onClose} size="sm" intent="secondary">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <CredentialEditor
      key={provider}
      provider={provider}
      name={name}
      editing={editing}
      onChangeProvider={fixed ? undefined : handleChangeProvider}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
};

export default SpaceCredentialForm;
