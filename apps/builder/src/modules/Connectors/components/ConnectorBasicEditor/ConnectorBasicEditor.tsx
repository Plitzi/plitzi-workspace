import Button from '@plitzi/plitzi-ui/Button';
import Icon from '@plitzi/plitzi-ui/Icon';
import Input from '@plitzi/plitzi-ui/Input';
import KVInput from '@plitzi/plitzi-ui/KVInput';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, useMemo } from 'react';

import SpaceCredentialSelectorModal from '@pmodules/Space/components/SpaceCredentialSelectorModal';

import { fieldDocs, paginationDocs } from '../../helpers/manifestDoc';
import { setAuth, setConnection, setList, setMediaBaseUrl, setWrite } from '../../helpers/updateManifest';
import ConnectorSection from '../ConnectorSection';
import ConnectorWriteEditor from '../ConnectorWriteEditor';
import TokenInput from '../TokenInput';

import type {
  ConnectorManifestDraft,
  ConnectorPagination,
  ConnectorWriteAction,
  ConnectorWriteOperation,
  SpaceCredentialProvider
} from '@plitzi/sdk-shared';

export type ConnectorBasicEditorProps = {
  manifest: ConnectorManifestDraft;
  onChange: (manifest: ConnectorManifestDraft) => void;
};

const WRITE_ACTIONS: ConnectorWriteAction[] = ['create', 'update', 'delete'];

/** Connector secrets are generic key/value bags; the storage providers cannot authenticate a CMS. */
const CREDENTIAL_PROVIDERS: SpaceCredentialProvider[] = ['custom'];

const ConnectorBasicEditor = ({ manifest, onChange }: ConnectorBasicEditorProps) => {
  const { list } = manifest.endpoints;
  const pagination = manifest.pagination ?? 'offset';
  const paginationDoc = useMemo(() => paginationDocs.find(doc => doc.value === pagination), [pagination]);

  const handleChangeBaseUrl = useCallback(
    (value: string) => onChange(setConnection(manifest, 'baseUrl', value)),
    [manifest, onChange]
  );

  const handleSelectCredential = useCallback(
    (identifier: string) => onChange(setConnection(manifest, 'credential', identifier)),
    [manifest, onChange]
  );

  const handleClearCredential = useCallback(
    () => onChange(setConnection(manifest, 'credential', undefined)),
    [manifest, onChange]
  );

  const handleChangeAuthIn = useCallback(
    (value: string) => onChange(setAuth(manifest, 'in', value as 'header' | 'query')),
    [manifest, onChange]
  );

  const handleChangeAuthName = useCallback(
    (value: string) => onChange(setAuth(manifest, 'name', value)),
    [manifest, onChange]
  );

  const handleChangeAuthValue = useCallback(
    (value: string) => onChange(setAuth(manifest, 'value', value)),
    [manifest, onChange]
  );

  const handleChangeHeaders = useCallback(
    (_entries: [string, string][], obj: Record<string, string>) =>
      onChange(setConnection(manifest, 'headers', Object.keys(obj).length ? obj : undefined)),
    [manifest, onChange]
  );

  const handleChangePath = useCallback(
    (value: string) => onChange(setList(manifest, 'path', value)),
    [manifest, onChange]
  );

  const handleChangeQuery = useCallback(
    (_entries: [string, string][], obj: Record<string, string>) => onChange(setList(manifest, 'query', obj)),
    [manifest, onChange]
  );

  const handleChangeItemsPath = useCallback(
    (value: string) => onChange(setList(manifest, 'itemsPath', value)),
    [manifest, onChange]
  );

  const handleChangeTotalPath = useCallback(
    (value: string) => onChange(setList(manifest, 'totalPath', value)),
    [manifest, onChange]
  );

  const handleChangeIdPath = useCallback(
    (value: string) => onChange(setList(manifest, 'idPath', value)),
    [manifest, onChange]
  );

  const handleChangeValuesPath = useCallback(
    (value: string) => onChange(setList(manifest, 'valuesPath', value)),
    [manifest, onChange]
  );

  const handleChangePagination = useCallback(
    (value: string) => onChange(setConnection(manifest, 'pagination', value as ConnectorPagination)),
    [manifest, onChange]
  );

  const handleChangeOperators = useCallback(
    (_entries: [string, string][], obj: Record<string, string>) => onChange(setConnection(manifest, 'operators', obj)),
    [manifest, onChange]
  );

  const handleChangeMedia = useCallback(
    (value: string) => onChange(setMediaBaseUrl(manifest, value)),
    [manifest, onChange]
  );

  const handleChangeWrite = useCallback(
    (action: ConnectorWriteAction, operation: ConnectorWriteOperation | undefined) =>
      onChange(setWrite(manifest, action, operation)),
    [manifest, onChange]
  );

  return (
    <div className="flex flex-col gap-4">
      <ConnectorSection title="Connection" description="Where the CMS is and how Plitzi identifies itself to it.">
        <Input
          value={manifest.baseUrl}
          label="Base URL"
          placeholder="https://cms.example.com"
          size="xs"
          onChange={handleChangeBaseUrl}
        />
        <span className="text-xs text-gray-500 dark:text-zinc-400">{fieldDocs.baseUrl}</span>
        <div className="flex items-end gap-2">
          <div className="flex grow flex-col gap-1">
            <span className="text-xs font-medium">Credential</span>
            <div className="flex h-8 items-center rounded-sm border border-gray-300 px-2 text-xs dark:border-zinc-600">
              {manifest.credential || <span className="text-gray-400">None</span>}
            </div>
          </div>
          <SpaceCredentialSelectorModal
            providersSupported={CREDENTIAL_PROVIDERS}
            selected={manifest.credential}
            onSelect={handleSelectCredential}
          >
            <Button size="xs" intent="secondary">
              Choose
            </Button>
          </SpaceCredentialSelectorModal>
          {manifest.credential && (
            <Button size="xs" intent="secondary" onClick={handleClearCredential} title="Use no credential">
              <Button.Icon icon="fa-solid fa-xmark" />
            </Button>
          )}
        </div>
        <span className="text-xs text-gray-500 dark:text-zinc-400">{fieldDocs.credential}</span>
      </ConnectorSection>

      <ConnectorSection title="Authentication" description="Leave empty for a public CMS that needs no credential.">
        <Select value={manifest.auth?.in ?? 'header'} label="Send as" size="xs" onChange={handleChangeAuthIn}>
          <option value="header">Header</option>
          <option value="query">Query parameter</option>
        </Select>
        <Input
          value={manifest.auth?.name ?? ''}
          label="Name"
          placeholder="Authorization"
          size="xs"
          onChange={handleChangeAuthName}
        />
        <TokenInput
          label="Value"
          description={fieldDocs.authValue}
          value={manifest.auth?.value ?? ''}
          placeholder="Bearer {{credential.token}}"
          onChange={handleChangeAuthValue}
        />
        <KVInput value={manifest.headers ?? {}} label="Extra headers" size="xs" onChange={handleChangeHeaders} />
      </ConnectorSection>

      <ConnectorSection title="Reading records" description="The request Plitzi makes to list a content type.">
        <TokenInput
          label="Path"
          description={fieldDocs.listPath}
          value={list.path}
          placeholder="/api/{{resource}}"
          onChange={handleChangePath}
        />
        <KVInput value={list.query ?? {}} label="Query parameters" size="xs" onChange={handleChangeQuery} />
        <span className="text-xs text-gray-500 dark:text-zinc-400">{fieldDocs.listQuery}</span>
        <Input
          value={list.itemsPath ?? ''}
          label="Records path"
          placeholder="data"
          size="xs"
          onChange={handleChangeItemsPath}
        />
        <span className="text-xs text-gray-500 dark:text-zinc-400">{fieldDocs.itemsPath}</span>
        <Input
          value={list.totalPath ?? ''}
          label="Total path"
          placeholder="meta.pagination.total"
          size="xs"
          onChange={handleChangeTotalPath}
        />
        <span className="text-xs text-gray-500 dark:text-zinc-400">{fieldDocs.totalPath}</span>
        <Input value={list.idPath ?? ''} label="Id path" placeholder="id" size="xs" onChange={handleChangeIdPath} />
        <Input
          value={list.valuesPath ?? ''}
          label="Fields path"
          placeholder="."
          size="xs"
          onChange={handleChangeValuesPath}
        />
        <span className="text-xs text-gray-500 dark:text-zinc-400">{fieldDocs.valuesPath}</span>
      </ConnectorSection>

      <ConnectorSection title="Pagination" description="How this provider asks for the next window of records.">
        <Select value={pagination} label="Style" size="xs" onChange={handleChangePagination}>
          {paginationDocs.map(doc => (
            <option key={doc.value} value={doc.value}>
              {doc.label}
            </option>
          ))}
        </Select>
        {paginationDoc && (
          <div className="flex gap-2 rounded-sm bg-gray-100 p-2 text-xs text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">
            <Icon icon="fa-solid fa-circle-info" />
            <span>{paginationDoc.description}</span>
          </div>
        )}
      </ConnectorSection>

      <ConnectorSection title="Filters" description={fieldDocs.operators}>
        <KVInput value={manifest.operators ?? {}} label="Operators" size="xs" onChange={handleChangeOperators} />
      </ConnectorSection>

      <ConnectorSection title="Media" description={fieldDocs.mediaBaseUrl}>
        <Input
          value={manifest.media?.baseUrl ?? ''}
          label="Media base URL"
          placeholder="https://cms.example.com"
          size="xs"
          onChange={handleChangeMedia}
        />
      </ConnectorSection>

      <ConnectorSection
        title="Writing records"
        description="Forms can only reach actions declared here. Anything left off is refused by the server."
      >
        {WRITE_ACTIONS.map(action => (
          <ConnectorWriteEditor
            key={action}
            action={action}
            operation={manifest.endpoints.write?.[action]}
            onChange={handleChangeWrite}
          />
        ))}
      </ConnectorSection>
    </div>
  );
};

export default ConnectorBasicEditor;
