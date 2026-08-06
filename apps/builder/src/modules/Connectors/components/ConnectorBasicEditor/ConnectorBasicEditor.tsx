import Button from '@plitzi/plitzi-ui/Button';
import Icon from '@plitzi/plitzi-ui/Icon';
import Input from '@plitzi/plitzi-ui/Input';
import KVInput from '@plitzi/plitzi-ui/KVInput';
import Label from '@plitzi/plitzi-ui/Label';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, useMemo } from 'react';

import SpaceCredentialSelectorModal from '@pmodules/Space/components/SpaceCredentialSelectorModal';

import { fieldDocs, paginationDocs } from '../../helpers/manifestDoc';
import { hasResponseMapping, summarize } from '../../helpers/summarizeManifest';
import { setAuth, setConnection, setList, setMediaBaseUrl, setWrite } from '../../helpers/updateManifest';
import ConnectorSection from '../ConnectorSection';
import ConnectorWriteEditor from '../ConnectorWriteEditor';
import FieldHelp from '../FieldHelp';
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
    <div className="flex flex-col">
      <div className="flex flex-col gap-2 pb-3">
        <Input
          value={manifest.baseUrl}
          label="CMS URL"
          placeholder="https://cms.example.com"
          title={fieldDocs.baseUrl}
          size="xs"
          onChange={handleChangeBaseUrl}
        />
        <div className="flex flex-col gap-1">
          <Label size="xs">Credential</Label>
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 grow items-center truncate rounded-sm border border-gray-300 px-2 text-xs dark:border-zinc-600"
              title={fieldDocs.credential}
            >
              {manifest.credential || <span className="text-gray-400">None — public CMS</span>}
            </div>
            <SpaceCredentialSelectorModal
              providersSupported={CREDENTIAL_PROVIDERS}
              selected={manifest.credential}
              onSelect={handleSelectCredential}
            >
              <Button size="xs" intent="secondary" title="Choose or create a credential">
                <Button.Icon icon="fa-solid fa-key" />
              </Button>
            </SpaceCredentialSelectorModal>
            {manifest.credential && (
              <Button size="xs" intent="secondary" onClick={handleClearCredential} title="Use no credential">
                <Button.Icon icon="fa-solid fa-xmark" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <ConnectorSection
        id="auth"
        title="Auth"
        summary={summarize.auth(manifest)}
        description="How Plitzi identifies itself. Leave empty for a public CMS."
      >
        <div className="flex gap-2">
          <div className="w-24 shrink-0">
            <Select value={manifest.auth?.in ?? 'header'} label="Send as" size="xs" onChange={handleChangeAuthIn}>
              <option value="header">Header</option>
              <option value="query">Query</option>
            </Select>
          </div>
          <Input
            className="grow"
            value={manifest.auth?.name ?? ''}
            label="Name"
            placeholder="Authorization"
            title={fieldDocs.authName}
            size="xs"
            onChange={handleChangeAuthName}
          />
        </div>
        <TokenInput
          label="Value"
          title={fieldDocs.authValue}
          value={manifest.auth?.value ?? ''}
          placeholder="Bearer {{credential.token}}"
          onChange={handleChangeAuthValue}
        />
        <FieldHelp>{fieldDocs.authValue}</FieldHelp>
        <KVInput value={manifest.headers ?? {}} label="Extra headers" size="xs" onChange={handleChangeHeaders} />
        <FieldHelp>{fieldDocs.headers}</FieldHelp>
      </ConnectorSection>

      <ConnectorSection
        id="list"
        title="Read"
        summary={summarize.list(manifest)}
        description="The request Plitzi makes to list a content type."
        defaultOpen
      >
        <TokenInput
          label="Path"
          title={fieldDocs.listPath}
          value={list.path}
          placeholder="/api/{{resource}}"
          onChange={handleChangePath}
        />
        <FieldHelp>{fieldDocs.listPath}</FieldHelp>
        <KVInput value={list.query ?? {}} label="Query parameters" size="xs" onChange={handleChangeQuery} />
        <FieldHelp>{fieldDocs.listQuery}</FieldHelp>
        <ConnectorSection
          id="mapping"
          title="Response"
          summary={hasResponseMapping(manifest) ? 'Customized' : 'Defaults'}
          highlight={hasResponseMapping(manifest)}
          description="Where the records sit inside this provider's response. The preset already knows; change it only if the CMS was customized."
        >
          <Input
            value={list.itemsPath ?? ''}
            label="Records path"
            placeholder="data"
            title={fieldDocs.itemsPath}
            size="xs"
            onChange={handleChangeItemsPath}
          />
          <FieldHelp>{fieldDocs.itemsPath}</FieldHelp>
          <Input
            value={list.totalPath ?? ''}
            label="Total path"
            placeholder="meta.pagination.total"
            title={fieldDocs.totalPath}
            size="xs"
            onChange={handleChangeTotalPath}
          />
          <FieldHelp>{fieldDocs.totalPath}</FieldHelp>
          <div className="flex gap-2">
            <Input
              className="grow"
              value={list.idPath ?? ''}
              label="Id path"
              placeholder="id"
              title={fieldDocs.idPath}
              size="xs"
              onChange={handleChangeIdPath}
            />
            <Input
              className="grow"
              value={list.valuesPath ?? ''}
              label="Fields path"
              placeholder="."
              title={fieldDocs.valuesPath}
              size="xs"
              onChange={handleChangeValuesPath}
            />
          </div>
          <FieldHelp>{fieldDocs.valuesPath}</FieldHelp>
        </ConnectorSection>
      </ConnectorSection>

      <ConnectorSection
        id="pagination"
        title="Paging"
        summary={summarize.pagination(manifest)}
        description="How this provider asks for the next window of records."
      >
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

      <ConnectorSection
        id="filters"
        title="Filters"
        summary={summarize.filters(manifest)}
        description={fieldDocs.operators}
      >
        <KVInput value={manifest.operators ?? {}} label="Operators" size="xs" onChange={handleChangeOperators} />
      </ConnectorSection>

      <ConnectorSection
        id="media"
        title="Media"
        summary={summarize.media(manifest)}
        description={fieldDocs.mediaBaseUrl}
      >
        <Input
          value={manifest.media?.baseUrl ?? ''}
          label="Media base URL"
          placeholder="https://cms.example.com"
          title={fieldDocs.mediaBaseUrl}
          size="xs"
          onChange={handleChangeMedia}
        />
      </ConnectorSection>

      <ConnectorSection
        id="writes"
        title="Writes"
        summary={summarize.writes(manifest)}
        highlight={Boolean(manifest.endpoints.write)}
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
