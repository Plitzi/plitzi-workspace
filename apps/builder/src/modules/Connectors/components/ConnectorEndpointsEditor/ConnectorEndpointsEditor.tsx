import Button from '@plitzi/plitzi-ui/Button';
import { useCallback, useMemo } from 'react';

import { DEFAULT_READ_ENDPOINT } from '@plitzi/sdk-shared/connectors';

import { removeEndpoint, renameEndpoint, setReadEndpoint, setWriteEndpoint } from '../../helpers/updateManifest';
import ConnectorEndpointEditor from '../ConnectorEndpointEditor';

import type { EndpointKind } from '../../helpers/updateManifest';
import type { ConnectorManifestDraft, ConnectorReadEndpoint, ConnectorWriteEndpoint } from '@plitzi/sdk-shared';

export type ConnectorEndpointsEditorProps = {
  manifest: ConnectorManifestDraft;
  onChange: (manifest: ConnectorManifestDraft) => void;
};

/** Free name for a new endpoint, so adding two in a row does not collide on the second. */
const nextName = (taken: string[], base: string) => {
  if (!taken.includes(base)) {
    return base;
  }

  let index = 2;
  while (taken.includes(`${base}${index}`)) {
    index += 1;
  }

  return `${base}${index}`;
};

/**
 * Every request the connector can make, read and write.
 *
 * Both sides are lists an author adds to, because a connector talks to a REST API and an API has as many operations
 * as it has — one read called `list` and three CRUD writes is the CMS special case, not the model.
 */
const ConnectorEndpointsEditor = ({ manifest, onChange }: ConnectorEndpointsEditorProps) => {
  const reads = useMemo(() => Object.entries(manifest.endpoints.read), [manifest.endpoints.read]);
  const writes = useMemo(() => Object.entries(manifest.endpoints.write ?? {}), [manifest.endpoints.write]);

  const handleAddRead = useCallback(() => {
    const name = nextName(
      reads.map(([key]) => key),
      reads.length ? 'detail' : DEFAULT_READ_ENDPOINT
    );
    onChange(setReadEndpoint(manifest, name, { path: '/{{resource}}', idPath: 'id' }));
  }, [manifest, reads, onChange]);

  const handleAddWrite = useCallback(() => {
    const name = nextName(
      writes.map(([key]) => key),
      'create'
    );
    onChange(setWriteEndpoint(manifest, name, { method: 'POST', path: '/{{resource}}' }));
  }, [manifest, writes, onChange]);

  const handleChangeRead = useCallback(
    (name: string, endpoint: ConnectorReadEndpoint | ConnectorWriteEndpoint) =>
      onChange(setReadEndpoint(manifest, name, endpoint as ConnectorReadEndpoint)),
    [manifest, onChange]
  );

  const handleChangeWrite = useCallback(
    (name: string, endpoint: ConnectorReadEndpoint | ConnectorWriteEndpoint) =>
      onChange(setWriteEndpoint(manifest, name, endpoint as ConnectorWriteEndpoint)),
    [manifest, onChange]
  );

  const handleRename = useCallback(
    (kind: EndpointKind) => (from: string, to: string) => onChange(renameEndpoint(manifest, kind, from, to)),
    [manifest, onChange]
  );

  const handleRemove = useCallback(
    (kind: EndpointKind) => (name: string) => onChange(removeEndpoint(manifest, kind, name)),
    [manifest, onChange]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">Read</span>
        <Button size="xs" intent="secondary" onClick={handleAddRead}>
          <Button.Icon icon="fa-solid fa-plus" />
          Read endpoint
        </Button>
      </div>
      {reads.map(([name, endpoint]) => (
        <ConnectorEndpointEditor
          key={name}
          kind="read"
          name={name}
          endpoint={endpoint}
          onChange={handleChangeRead}
          onRename={handleRename('read')}
          onRemove={handleRemove('read')}
        />
      ))}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">Write</span>
        <Button size="xs" intent="secondary" onClick={handleAddWrite}>
          <Button.Icon icon="fa-solid fa-plus" />
          Write endpoint
        </Button>
      </div>
      {writes.length === 0 && (
        <div className="rounded-sm border border-dashed border-gray-300 p-2 text-center text-xs text-gray-500 dark:border-zinc-600 dark:text-zinc-400">
          Read-only. Anything not declared here is refused by the server.
        </div>
      )}
      {writes.map(([name, endpoint]) => (
        <ConnectorEndpointEditor
          key={name}
          kind="write"
          name={name}
          endpoint={endpoint}
          onChange={handleChangeWrite}
          onRename={handleRename('write')}
          onRemove={handleRemove('write')}
        />
      ))}
    </div>
  );
};

export default ConnectorEndpointsEditor;
