import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import { MODE_WORDS } from './helpers';
import Notice from '../../components/Notice';

import type { DeployMode, DeployProviderInfo, SpaceTarget, SpaceTargets } from '@plitzi/sdk-shared';

export type TargetSettingsProps = {
  target: SpaceTarget;
  catalog: SpaceTargets;
  /** The target's settings as kept: its provider's and every target's. */
  config: Record<string, string>;
  onSaved: () => void;
  onBack: () => void;
};

const MODES: { mode: DeployMode; detail: string }[] = [
  { mode: 'ssr', detail: 'Plitzi serves every page, rendered on its servers' },
  { mode: 'spa', detail: 'A page that loads the space from Plitzi, on a host of yours' },
  { mode: 'static', detail: 'Every page as HTML on a host of yours, deployed with each revision' },
  { mode: 'selfHosted', detail: 'A server of yours running @plitzi/sdk-server' }
];

const INPUT =
  'border-ui-line bg-ui-panel text-ui-fg rounded-md border px-2 py-1.5 text-sm outline-none focus:border-primary-500';
const QUIET_BUTTON = 'border-transparent bg-transparent text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover';

const errorOf = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : 'It was not saved';

/**
 * Where a domain's site is (RFC 0034 §11.4): served by Plitzi, or a copy of it on a provider — the mode, the provider
 * and its own settings, and what signs in there — each provider's fields as the platform lists them, so a provider
 * added there is offered here without a change to this form.
 */
const TargetSettings = ({ target, catalog, config: kept, onSaved, onBack }: TargetSettingsProps) => {
  const { mutate } = useBuilderNetwork();
  const [mode, setMode] = useState<DeployMode>(target.mode);
  const offered = useMemo(() => catalog.providers.filter(provider => provider.modes.includes(mode)), [catalog, mode]);
  const [providerId, setProviderId] = useState<string>(target.provider === 'ssr' ? '' : target.provider);
  const provider: DeployProviderInfo | undefined = offered.find(each => each.id === providerId) ?? offered.at(0);
  const [values, setValues] = useState<Record<string, string>>(kept);
  const [credential, setCredential] = useState('');
  const [bucket, setBucket] = useState('');
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState<{ tone: 'success' | 'danger'; words: string }>();
  const signIn = mode === 'ssr' ? undefined : provider?.signIn;
  const credentialKind = signIn?.kind === 'credential' ? signIn.credential : null;
  const { data: credentials = [] } = useGraphQL(
    credentialKind ? 'SpaceCredentials' : null,
    data => data?.SpaceCredentials.edges,
    { filter: { provider: { eq: credentialKind } } }
  );
  const { data: cdns = [] } = useGraphQL(signIn?.kind === 'bucket' ? 'SpaceCdns' : null, data => data?.SpaceCdns.edges);
  const buckets = useMemo(
    () =>
      signIn?.kind === 'bucket'
        ? cdns
            .filter(cdn => cdn.provider === signIn.cdn)
            .flatMap(cdn =>
              cdn.buckets
                .filter(each => each.visibility === 'public')
                .map(each => ({ value: `${cdn.identifier}/${each.identifier}`, label: `${cdn.name} · ${each.name}` }))
            )
        : [],
    [cdns, signIn]
  );
  const fields = [
    ...(mode === 'ssr' ? [] : (provider?.fields ?? [])),
    ...catalog.targetFields.filter(field => field.modes.includes(mode))
  ];

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaid(undefined);
    const [cdn, bucketId] = (bucket || buckets.at(0)?.value || '').split('/');
    const response = await mutate(
      'SpaceSetTarget',
      {
        domain: target.domain,
        mode,
        ...(mode === 'ssr' || !provider
          ? {}
          : {
              provider: provider.id,
              config: Object.fromEntries(fields.map(field => [field.key, values[field.key] ?? ''])),
              ...(credentialKind ? { credential: credential || credentials.at(0)?.identifier } : {}),
              ...(signIn?.kind === 'bucket' && cdn && bucketId ? { bucket: { cdn, bucket: bucketId } } : {})
            })
      },
      true
    );
    setSaving(false);
    if (response.result) {
      setSaid({ tone: 'success', words: response.result.message });
      onSaved();
    } else {
      setSaid({ tone: 'danger', words: errorOf(response.error) });
    }
  }, [
    bucket,
    buckets,
    credential,
    credentialKind,
    credentials,
    fields,
    mode,
    mutate,
    onSaved,
    provider,
    signIn,
    target.domain,
    values
  ]);

  return (
    <div className="flex flex-col gap-4">
      <button type="button" className="text-ui-fg-subtle hover:text-ui-fg w-fit text-xs" onClick={onBack}>
        <i className="fa-solid fa-arrow-left mr-1" /> Back to publishing
      </button>
      <div className="flex flex-col gap-1">
        <h5 className="text-ui-fg text-sm font-semibold">Where {target.domain} is served</h5>
        <span className="text-ui-fg-subtle text-xs">
          Its DNS records, its access and what its pages are held to stay in the console’s Domains.
        </span>
      </div>

      <div role="radiogroup" aria-label="How it serves the space" className="grid grid-cols-2 gap-1.5">
        {MODES.map(({ mode: each, detail }) => (
          <button
            key={each}
            type="button"
            role="radio"
            aria-checked={mode === each}
            className={clsx(
              'flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors outline-none',
              'focus-visible:ring-primary-500 focus-visible:ring-2',
              mode === each ? 'border-primary-500 bg-primary-500/10' : 'border-ui-line hover:bg-ui-hover'
            )}
            onClick={() => setMode(each)}
          >
            <span className="text-ui-fg text-sm font-semibold">{MODE_WORDS[each]}</span>
            <span className="text-ui-fg-subtle text-[11px] leading-snug">{detail}</span>
          </button>
        ))}
      </div>

      {mode !== 'ssr' && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ui-fg-subtle">Provider</span>
          <select className={INPUT} value={provider?.id ?? ''} onChange={event => setProviderId(event.target.value)}>
            {offered.map(each => (
              <option key={each.id} value={each.id}>
                {each.label}
              </option>
            ))}
          </select>
          {provider && <span className="text-ui-fg-subtle">{provider.description}</span>}
        </label>
      )}

      {mode !== 'ssr' && provider && !provider.atomic && (
        <Notice tone="caution">
          {provider.label} replaces the files one by one: while a deploy uploads, a visitor may get some of each
          version.
        </Notice>
      )}

      {credentialKind && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ui-fg-subtle">Signs in with</span>
          {credentials.length > 0 ? (
            <select className={INPUT} value={credential} onChange={event => setCredential(event.target.value)}>
              {credentials.map(each => (
                <option key={each.identifier} value={each.identifier}>
                  {each.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-amber-700 dark:text-amber-300">
              The space has no {provider?.label} credential yet: add one in Resources → Credentials, then come back.
            </span>
          )}
        </label>
      )}

      {signIn?.kind === 'bucket' && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ui-fg-subtle">Bucket</span>
          {buckets.length > 0 ? (
            <select className={INPUT} value={bucket} onChange={event => setBucket(event.target.value)}>
              {buckets.map(each => (
                <option key={each.value} value={each.value}>
                  {each.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-amber-700 dark:text-amber-300">
              The space has no public {signIn.cdn.toUpperCase()} bucket: add one in Resources → CDNs.
            </span>
          )}
        </label>
      )}

      {fields.map(field => (
        <label key={field.key} className="flex flex-col gap-1 text-xs">
          <span className="text-ui-fg-subtle">
            {field.label}
            {!field.required && ' (optional)'}
          </span>
          <input
            className={INPUT}
            value={values[field.key] ?? ''}
            placeholder={field.example}
            onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))}
          />
          {field.hint && <span className="text-ui-fg-subtle">{field.hint}</span>}
        </label>
      ))}

      {said && <Notice tone={said.tone}>{said.words}</Notice>}

      <div className="border-ui-line flex items-center justify-end gap-2 border-t pt-3">
        <Button size="sm" intent="custom" className={QUIET_BUTTON} onClick={onBack}>
          Cancel
        </Button>
        <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
};

export default TargetSettings;
