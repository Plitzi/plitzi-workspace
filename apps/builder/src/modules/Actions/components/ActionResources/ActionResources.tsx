import Button from '@plitzi/plitzi-ui/Button';
import Label from '@plitzi/plitzi-ui/Label';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, use, useMemo } from 'react';

import SpaceCredentialSelectorModal from '@pmodules/Space/components/SpaceCredentialSelectorModal';

import ConnectorsContext from '../../../Connectors/ConnectorsContext';

import type { SpaceCredentialProvider } from '@plitzi/sdk-shared';

export type ActionResourcesProps = {
  credentials: string[];
  connectors: string[];
  onChange: (changes: { credentials?: string[]; connectors?: string[] }) => void;
};

/** The generic key/value bag — the same set a connector can authenticate with. */
const CREDENTIAL_PROVIDERS: SpaceCredentialProvider[] = ['custom'];

/**
 * What this action may reach.
 *
 * Picked, never typed: an identifier written by hand is a run that fails at request time with "credential not
 * available", and the author has no way to tell a typo from a credential that was never created. The same modal
 * the connector panel uses, so a credential created in one place is choosable in the other.
 *
 * Declaring a resource here is only half the gate — a STEP still has to name the credential it uses, and it only
 * ever sees that one. This list is what the action may ask for at all.
 */
const ActionResources = ({ credentials, connectors, onChange }: ActionResourcesProps) => {
  const { connectors: available } = use(ConnectorsContext);
  const connectorOptions = useMemo(
    () => Object.values(available).filter(connector => !connectors.includes(connector.identifier)),
    [available, connectors]
  );

  const handleAddCredential = useCallback(
    (identifier: string) => {
      if (identifier && !credentials.includes(identifier)) {
        onChange({ credentials: [...credentials, identifier] });
      }
    },
    [credentials, onChange]
  );

  const handleRemoveCredential = useCallback(
    (identifier: string) => () => onChange({ credentials: credentials.filter(item => item !== identifier) }),
    [credentials, onChange]
  );

  const handleAddConnector = useCallback(
    (identifier: string) => {
      if (identifier && !connectors.includes(identifier)) {
        onChange({ connectors: [...connectors, identifier] });
      }
    },
    [connectors, onChange]
  );

  const handleRemoveConnector = useCallback(
    (identifier: string) => () => onChange({ connectors: connectors.filter(item => item !== identifier) }),
    [connectors, onChange]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label size="xs">Credentials this action may use</Label>
        <div className="flex flex-wrap items-center gap-2">
          {credentials.map(identifier => (
            <span
              key={identifier}
              className="flex items-center gap-1 rounded-sm border border-gray-300 px-2 py-1 text-xs dark:border-zinc-600"
            >
              {identifier}
              <Button size="xs" intent="secondary" onClick={handleRemoveCredential(identifier)} title="Remove">
                <Button.Icon icon="fa-solid fa-xmark" />
              </Button>
            </span>
          ))}
          <SpaceCredentialSelectorModal providersSupported={CREDENTIAL_PROVIDERS} onSelect={handleAddCredential}>
            <Button size="xs" intent="secondary" title="Choose or create a credential">
              <Button.Icon icon="fa-solid fa-key" />
            </Button>
          </SpaceCredentialSelectorModal>
        </div>
        <span className="text-xs text-gray-500">
          A step still names the one it uses, and never sees the others. The values stay on the server.
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <Label size="xs">Connectors this action may call</Label>
        <div className="flex flex-wrap items-center gap-2">
          {connectors.map(identifier => (
            <span
              key={identifier}
              className="flex items-center gap-1 rounded-sm border border-gray-300 px-2 py-1 text-xs dark:border-zinc-600"
            >
              {identifier}
              <Button size="xs" intent="secondary" onClick={handleRemoveConnector(identifier)} title="Remove">
                <Button.Icon icon="fa-solid fa-xmark" />
              </Button>
            </span>
          ))}
          {connectorOptions.length > 0 && (
            <Select value="" size="xs" onChange={handleAddConnector}>
              <option value="">Add connector…</option>
              {connectorOptions.map(connector => (
                <option key={connector.identifier} value={connector.identifier}>
                  {connector.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActionResources;
