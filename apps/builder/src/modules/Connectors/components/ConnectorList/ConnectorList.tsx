import Button from '@plitzi/plitzi-ui/Button';
import Heading from '@plitzi/plitzi-ui/Heading';
import { useCallback } from 'react';

import type { SpaceConnector } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type ConnectorListProps = {
  connectors: SpaceConnector[];
  onSelect: (identifier: string) => void;
  onRemove: (identifier: string) => void;
  onCreate: () => void;
};

const ConnectorList = ({ connectors, onSelect, onRemove, onCreate }: ConnectorListProps) => {
  const handleSelect = useCallback((identifier: string) => () => onSelect(identifier), [onSelect]);

  const handleRemove = useCallback(
    (identifier: string) => (e: MouseEvent) => {
      e.stopPropagation();
      onRemove(identifier);
    },
    [onRemove]
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl grow basis-0 flex-col p-4">
      <div className="mb-4 flex w-full items-center justify-between">
        <Heading as="h5">Connectors</Heading>
        <Button size="sm" onClick={onCreate}>
          New Connector
        </Button>
      </div>
      {connectors.length === 0 && (
        <div className="rounded-sm border-2 border-dashed border-gray-300 p-4 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
          Connect the CMS you already run. A connector holds the endpoints; the credential stays on the server.
        </div>
      )}
      <div className="flex flex-col gap-2 overflow-auto">
        {connectors.map(connector => (
          <div
            key={connector.identifier}
            className="flex cursor-pointer items-center justify-between rounded-sm border border-gray-300 p-2 dark:border-zinc-600"
            onClick={handleSelect(connector.identifier)}
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{connector.name}</span>
              <span className="text-xs text-gray-500">{connector.identifier}</span>
            </div>
            <Button size="xs" onClick={handleRemove(connector.identifier)} title="Remove connector">
              <Button.Icon icon="fa-solid fa-trash" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConnectorList;
