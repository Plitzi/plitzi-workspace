import Button from '@plitzi/plitzi-ui/Button';

import EmptyState from '@pmodules/App/components/EmptyState';
import ResourceRow from '@pmodules/App/components/ResourceRow';
import ViewPage from '@pmodules/App/components/ViewPage';

import type { SpaceConnector } from '@plitzi/sdk-shared';

export type ConnectorListProps = {
  connectors: SpaceConnector[];
  onSelect: (identifier: string) => void;
  onRemove: (identifier: string) => void;
  onCreate: () => void;
};

const DESCRIPTION =
  'Connect the CMS you already run. A connector holds the endpoints; the credential stays on the server.';

const ConnectorList = ({ connectors, onSelect, onRemove, onCreate }: ConnectorListProps) => {
  const createButton = (
    <Button size="sm" onClick={onCreate} iconPlacement="before">
      <Button.Icon icon="fa-solid fa-plus" />
      New Connector
    </Button>
  );

  return (
    <ViewPage
      description={connectors.length > 0 ? DESCRIPTION : undefined}
      actions={connectors.length > 0 && createButton}
    >
      {connectors.length === 0 && (
        <EmptyState icon="fa-solid fa-plug" title="No connectors yet" description={DESCRIPTION} action={createButton} />
      )}
      {connectors.length > 0 && (
        <div className="flex flex-col gap-2">
          {connectors.map(connector => (
            <ResourceRow
              key={connector.identifier}
              id={connector.identifier}
              icon="fa-solid fa-plug"
              title={connector.name}
              subtitle={connector.identifier}
              removeTitle="Remove connector"
              onSelect={onSelect}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </ViewPage>
  );
};

export default ConnectorList;
