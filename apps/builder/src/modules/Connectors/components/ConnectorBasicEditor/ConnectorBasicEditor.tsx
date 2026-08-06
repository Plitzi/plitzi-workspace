import Button from '@plitzi/plitzi-ui/Button';
import Icon from '@plitzi/plitzi-ui/Icon';
import Input from '@plitzi/plitzi-ui/Input';
import KVInput from '@plitzi/plitzi-ui/KVInput';
import Label from '@plitzi/plitzi-ui/Label';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, useMemo } from 'react';

import SpaceCredentialSelectorModal from '@pmodules/Space/components/SpaceCredentialSelectorModal';

import { fieldDocs, paginationDocs } from '../../helpers/manifestDoc';
import { summarize } from '../../helpers/summarizeManifest';
import { setAuth, setConnection, setMediaBaseUrl } from '../../helpers/updateManifest';
import ConnectorEndpointsEditor from '../ConnectorEndpointsEditor';
import ConnectorSection from '../ConnectorSection';
import FieldGrid from '../FieldGrid';
import FieldHelp from '../FieldHelp';
import TokenInput from '../TokenInput';

import type { ConnectorManifestDraft, ConnectorPagination, SpaceCredentialProvider } from '@plitzi/sdk-shared';

/** Connector secrets are generic key/value bags; the storage providers cannot authenticate an API. */
const CREDENTIAL_PROVIDERS: SpaceCredentialProvider[] = ['custom'];

export type ConnectorBasicEditorProps = {
  manifest: ConnectorManifestDraft;
  onChange: (manifest: ConnectorManifestDraft) => void;
};

const ConnectorBasicEditor = ({ manifest, onChange }: ConnectorBasicEditorProps) => {
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

  return (
    <div className="flex flex-col">
      <FieldGrid>
        <Input
          value={manifest.baseUrl}
          label="API URL"
          placeholder="https://api.example.com"
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
              {manifest.credential || <span className="text-gray-400">None — public API</span>}
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
      </FieldGrid>

      <ConnectorSection
        id="endpoints"
        title="Endpoints"
        summary={summarize.endpoints(manifest)}
        description="Every request this connector can make. Elements read through a read endpoint; interactions invoke a write one."
        defaultOpen
      >
        <ConnectorEndpointsEditor manifest={manifest} onChange={onChange} />
      </ConnectorSection>

      <ConnectorSection
        id="auth"
        title="Auth"
        summary={summarize.auth(manifest)}
        description="How Plitzi identifies itself on every request. Leave empty for a public API."
      >
        <FieldGrid>
          <Select value={manifest.auth?.in ?? 'header'} label="Send as" size="xs" onChange={handleChangeAuthIn}>
            <option value="header">Header</option>
            <option value="query">Query</option>
          </Select>
          <Input
            value={manifest.auth?.name ?? ''}
            label="Name"
            placeholder="Authorization"
            title={fieldDocs.authName}
            size="xs"
            onChange={handleChangeAuthName}
          />
        </FieldGrid>
        <TokenInput
          label="Value"
          title={fieldDocs.authValue}
          value={manifest.auth?.value ?? ''}
          placeholder="Bearer {{credential.token}}"
          onChange={handleChangeAuthValue}
        />
        <FieldHelp>{fieldDocs.authValue}</FieldHelp>
        <KVInput value={manifest.headers ?? {}} label="Shared headers" size="xs" onChange={handleChangeHeaders} />
        <FieldHelp>{fieldDocs.headers}</FieldHelp>
      </ConnectorSection>

      <ConnectorSection
        id="pagination"
        title="Paging"
        summary={summarize.pagination(manifest)}
        description="How this API asks for the next window of records. A read endpoint can override it."
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
          placeholder="https://api.example.com"
          title={fieldDocs.mediaBaseUrl}
          size="xs"
          onChange={handleChangeMedia}
        />
      </ConnectorSection>
    </div>
  );
};

export default ConnectorBasicEditor;
