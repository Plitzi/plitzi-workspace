import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import KVInput from '@plitzi/plitzi-ui/KVInput';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import { fieldDocs } from '../../helpers/manifestDoc';
import { hasResponseMapping, summarizeEndpoint } from '../../helpers/summarizeManifest';
import ConnectorSection from '../ConnectorSection';
import FieldHelp from '../FieldHelp';
import TokenInput from '../TokenInput';

import type { EndpointKind } from '../../helpers/updateManifest';
import type { ConnectorReadEndpoint, ConnectorWriteEndpoint } from '@plitzi/sdk-shared';

export type ConnectorEndpointEditorProps = {
  kind: EndpointKind;
  name: string;
  endpoint: ConnectorReadEndpoint | ConnectorWriteEndpoint;
  onChange: (name: string, endpoint: ConnectorReadEndpoint | ConnectorWriteEndpoint) => void;
  onRename: (from: string, to: string) => void;
  onRemove: (name: string) => void;
};

const READ_METHODS = ['GET', 'POST'];
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * One named request.
 *
 * Reads and writes share this editor because they are the same thing to an author — a method, a path, and how to
 * read the answer — and differ only in which extra fields apply. Splitting them into two components would duplicate
 * the path, query and header rows, which are where the templating lives.
 */
const ConnectorEndpointEditor = ({
  kind,
  name,
  endpoint,
  onChange,
  onRename,
  onRemove
}: ConnectorEndpointEditorProps) => {
  const isRead = kind === 'read';
  const read = endpoint as ConnectorReadEndpoint;
  const write = endpoint as ConnectorWriteEndpoint;

  const handleChangeName = useCallback((value: string) => onRename(name, value), [name, onRename]);

  const handleChangeMethod = useCallback(
    (value: string) => onChange(name, { ...endpoint, method: value as ConnectorWriteEndpoint['method'] }),
    [name, endpoint, onChange]
  );

  const handleChangePath = useCallback(
    (value: string) => onChange(name, { ...endpoint, path: value }),
    [name, endpoint, onChange]
  );

  const handleChangeQuery = useCallback(
    (_entries: [string, string][], obj: Record<string, string>) => onChange(name, { ...endpoint, query: obj }),
    [name, endpoint, onChange]
  );

  const handleChangeHeaders = useCallback(
    (_entries: [string, string][], obj: Record<string, string>) => onChange(name, { ...endpoint, headers: obj }),
    [name, endpoint, onChange]
  );

  const handleChangeMapping = useCallback(
    (key: 'itemsPath' | 'totalPath' | 'idPath' | 'valuesPath') => (value: string) => {
      if (isRead) {
        onChange(name, { ...read, [key]: value });

        return;
      }

      onChange(name, { ...write, response: { ...write.response, [key]: value } });
    },
    [isRead, name, read, write, onChange]
  );

  const handleChangeBodyPath = useCallback(
    (value: string) => onChange(name, { ...write, bodyPath: value }),
    [name, write, onChange]
  );

  const handleRemove = useCallback(() => onRemove(name), [name, onRemove]);

  const mapping = isRead ? read : (write.response ?? {});

  return (
    <ConnectorSection id={`${kind}.${name}`} title={name} summary={summarizeEndpoint(endpoint)}>
      <div className="flex items-end gap-2">
        <Input className="grow" value={name} label="Name" size="xs" onChange={handleChangeName} />
        <Button size="xs" intent="secondary" title="Remove this endpoint" onClick={handleRemove}>
          <Button.Icon icon="fa-solid fa-trash" />
        </Button>
      </div>
      <FieldHelp>
        {isRead
          ? 'Elements address this endpoint by name. "list" is the one they use when they name none.'
          : 'Interactions invoke this endpoint by name. Anything not declared here is refused by the server.'}
      </FieldHelp>
      <div className="flex gap-2">
        <div className="w-24 shrink-0">
          <Select
            value={endpoint.method ?? 'GET'}
            label="Method"
            size="xs"
            title={fieldDocs.method}
            onChange={handleChangeMethod}
          >
            {(isRead ? READ_METHODS : WRITE_METHODS).map(method => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </Select>
        </div>
        <div className="grow">
          <TokenInput
            label="Path"
            title={fieldDocs.path}
            value={endpoint.path}
            scope={isRead ? 'request' : 'write'}
            placeholder="/{{resource}}"
            onChange={handleChangePath}
          />
        </div>
      </div>
      <FieldHelp>{fieldDocs.path}</FieldHelp>
      <KVInput value={endpoint.query ?? {}} label="Query parameters" size="xs" onChange={handleChangeQuery} />
      <FieldHelp>{isRead ? fieldDocs.listQuery : fieldDocs.writeQuery}</FieldHelp>
      <KVInput value={endpoint.headers ?? {}} label="Headers" size="xs" onChange={handleChangeHeaders} />
      <FieldHelp>{fieldDocs.endpointHeaders}</FieldHelp>
      {!isRead && write.method !== 'DELETE' && (
        <>
          <Input
            value={write.bodyPath ?? ''}
            label="Body key"
            placeholder="data"
            title={fieldDocs.writeBodyPath}
            size="xs"
            onChange={handleChangeBodyPath}
          />
          <FieldHelp>{fieldDocs.writeBodyPath}</FieldHelp>
        </>
      )}
      <ConnectorSection
        id={`${kind}.${name}.response`}
        title="Response"
        summary={isRead && hasResponseMapping(read) ? 'Customized' : 'Defaults'}
        highlight={isRead && hasResponseMapping(read)}
        description="Where the records sit inside this endpoint's response. The preset already knows; change it only if the API was customized."
      >
        <Input
          value={mapping.itemsPath ?? ''}
          label="Records path"
          placeholder="data"
          title={fieldDocs.itemsPath}
          size="xs"
          onChange={handleChangeMapping('itemsPath')}
        />
        <FieldHelp>{fieldDocs.itemsPath}</FieldHelp>
        {isRead && (
          <>
            <Input
              value={mapping.totalPath ?? ''}
              label="Total path"
              placeholder="meta.pagination.total"
              title={fieldDocs.totalPath}
              size="xs"
              onChange={handleChangeMapping('totalPath')}
            />
            <FieldHelp>{fieldDocs.totalPath}</FieldHelp>
          </>
        )}
        <div className="flex gap-2">
          <Input
            className="grow"
            value={mapping.idPath ?? ''}
            label="Id path"
            placeholder="id"
            title={fieldDocs.idPath}
            size="xs"
            onChange={handleChangeMapping('idPath')}
          />
          <Input
            className="grow"
            value={mapping.valuesPath ?? ''}
            label="Fields path"
            placeholder="."
            title={fieldDocs.valuesPath}
            size="xs"
            onChange={handleChangeMapping('valuesPath')}
          />
        </div>
        <FieldHelp>{fieldDocs.valuesPath}</FieldHelp>
      </ConnectorSection>
    </ConnectorSection>
  );
};

export default ConnectorEndpointEditor;
