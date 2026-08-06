import Button from '@plitzi/plitzi-ui/Button';
import { useCallback, useMemo } from 'react';

import { READ_ENDPOINT_NAMES, WRITE_ENDPOINT_NAMES } from '@plitzi/sdk-shared/connectors';

import { removeEndpoint, renameEndpoint, setReadEndpoint, setWriteEndpoint } from '../../helpers/updateManifest';
import ConnectorEndpointEditor from '../ConnectorEndpointEditor';

import type { EndpointKind } from '../../helpers/updateManifest';
import type {
  ConnectorHttpMethod,
  ConnectorManifestDraft,
  ConnectorReadEndpoint,
  ConnectorWriteEndpoint
} from '@plitzi/sdk-shared';

export type ConnectorEndpointsEditorProps = {
  manifest: ConnectorManifestDraft;
  onChange: (manifest: ConnectorManifestDraft) => void;
};

/** The verb each suggested write name implies, so a fresh endpoint does not start on the wrong one. */
const SUGGESTED_METHODS: Record<string, ConnectorHttpMethod> = { create: 'POST', update: 'PUT', delete: 'DELETE' };

/**
 * Picks the name an author was about to type.
 *
 * A connector's reads are almost always a list, then a single-record fetch, then a search — in that order — so the
 * suggestions follow the vocabulary rather than counting. Past the vocabulary it falls back to a numbered name:
 * inventing a fourth noun would be guessing at a domain we know nothing about.
 */
const nextName = (taken: string[], vocabulary: readonly string[], fallback: string) => {
  const free = vocabulary.find(name => !taken.includes(name));
  if (free) {
    return free;
  }

  let index = taken.length + 1;
  while (taken.includes(`${fallback}${index}`)) {
    index += 1;
  }

  return `${fallback}${index}`;
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
      READ_ENDPOINT_NAMES,
      'read'
    );
    // A second read is usually the single-record fetch a detail page needs, so it starts addressed by route param.
    const path = reads.length ? '/{{resource}}/{{routeParams.id}}' : '/{{resource}}';
    onChange(setReadEndpoint(manifest, name, { path, idPath: 'id' }));
  }, [manifest, reads, onChange]);

  const handleAddWrite = useCallback(() => {
    const taken = writes.map(([key]) => key);
    const name = nextName(taken, WRITE_ENDPOINT_NAMES, 'write');
    const method = SUGGESTED_METHODS[name] ?? 'POST';
    const path = method === 'POST' ? '/{{resource}}' : '/{{resource}}/{{id}}';
    onChange(setWriteEndpoint(manifest, name, { method, path }));
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
      {reads.map(([name, endpoint], index) => (
        // Keyed by position, not by name: the name is the value being edited, so keying on it remounts the row on
        // every keystroke — which drops focus mid-rename and resets the section. Order is insertion order and
        // `renameEndpoint` preserves it, so position is the stable identity here.
        <ConnectorEndpointEditor
          key={`read-${index}`}
          kind="read"
          index={index}
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
      {writes.map(([name, endpoint], index) => (
        <ConnectorEndpointEditor
          key={`write-${index}`}
          kind="write"
          index={index}
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
