import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';
import useSpaceEntitlements from '@pmodules/Space/hooks/useSpaceEntitlements';

import DeployProgress from './DeployProgress';
import { targetWhere, versionName } from './helpers';
import ReleaseHistory from './ReleaseHistory';
import RevisionList from './RevisionList';
import TargetSettings from './TargetSettings';
import WhatHappens from './WhatHappens';
import { targetAttention } from '../../components/AppHeader/ReleaseCluster/targetAttention';
import ChangesSummary, { useVersionChanges } from '../../components/ChangesSummary';
import EnvironmentSegments from '../../components/EnvironmentSegments';
import Notice from '../../components/Notice';
import { shortAge } from '../../helpers/age';
import { ENVIRONMENT_META, PUBLISHED_ENVIRONMENTS, revisionName } from '../../helpers/environments';
import useLatestSnapshots, { latestDetail } from '../../hooks/useLatestSnapshots';
import useSpaceTargets from '../../hooks/useSpaceTargets';

import type { Environment, SpacePublishCheck, SpaceServedVersion, SpaceTarget } from '@plitzi/sdk-shared';

export type PublishSheetProps = {
  /** The snapshot to publish, when the sheet opens from "Snapshot and publish…". */
  environment?: Environment;
  revision?: number;
  /** The domain to open on — one whose target asked for a look. */
  domain?: string;
  /** Opened on the domain's history, from the header's Publish menu. */
  view?: 'history';
  onClose: () => void;
};

type View =
  | { name: 'publish' }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'deploy'; deployId: number; said: string }
  | { name: 'done'; said: string };

const QUIET_BUTTON = 'border-transparent bg-transparent text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover';

const TONE_TEXT = {
  danger: 'text-red-700 dark:text-red-300',
  warning: 'text-amber-700 dark:text-amber-300',
  progress: 'text-sky-700 dark:text-sky-300'
} as const;

/** The domain to open on: one asked for, one the snapshot's environment serves, a domain of the space's own, any. */
const firstTarget = (targets: readonly SpaceTarget[], environment: Environment | undefined, asked?: string) =>
  targets.find(t => t.domain === asked) ??
  targets.find(t => t.verified && t.environment === environment && t.environment !== 'main') ??
  targets.find(t => t.verified && t.environment !== 'main') ??
  targets.find(t => t.verified) ??
  targets.at(0);

const checkOf = (response: { SpacePublishCheck: SpacePublishCheck } | undefined) => response?.SpacePublishCheck;

const errorOf = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : typeof error === 'string' && error ? error : fallback;

/** A target's settings as the settings form reads them: its kept values, as text. */
const configOf = (target: SpaceTarget): Record<string, string> =>
  Object.fromEntries(
    Object.entries(target.config ?? {}).flatMap(([key, value]) => (typeof value === 'string' ? [[key, value]] : []))
  );

/**
 * Publish (RFC 0034 §11.3): which revision a domain serves. Its targets first — how each serves the space, what it
 * serves now and what it asks for; then the environment and the revision; then what will happen, in words, before
 * anything does — a deploy and why, what runs on Plitzi — and one action. Pressed, a deploy becomes its progress here;
 * the history and the target's own settings are views of the same sheet.
 */
const PublishSheet = ({
  environment: askedEnvironment,
  revision: askedRevision,
  domain: askedDomain,
  view: askedView,
  onClose
}: PublishSheetProps) => {
  const { mutate } = useBuilderNetwork();
  const { locked } = useSpaceEntitlements();
  const { byEnvironment } = useLatestSnapshots();
  const { targets: catalog, loading: loadingTargets, refresh: refreshTargets } = useSpaceTargets();
  const targets = useMemo(() => catalog?.targets ?? [], [catalog]);
  // The access a domain is behind is the domain's own setting, read with the domains.
  const { data: deployments = [] } = useGraphQL('SpaceDeployments', data => data?.SpaceDeployments.edges, undefined, {
    revalidateOnMount: true
  });
  const { data: credentials = [] } = useGraphQL('SpaceCredentials', data => data?.SpaceCredentials.edges, {
    filter: { provider: { eq: 'ssr' } }
  });

  const [view, setView] = useState<View>(askedView === 'history' ? { name: 'history' } : { name: 'publish' });
  const [pickedDomain, setPickedDomain] = useState<string>();
  const target = useMemo(
    () => targets.find(t => t.domain === pickedDomain) ?? firstTarget(targets, askedEnvironment, askedDomain),
    [askedDomain, askedEnvironment, pickedDomain, targets]
  );
  const holdsACopy = target !== undefined && target.mode !== 'ssr';
  const [pickedEnvironment, setPickedEnvironment] = useState<Environment>();
  const environment: Environment =
    pickedEnvironment ??
    askedEnvironment ??
    (target && target.environment !== 'main' ? target.environment : undefined) ??
    'production';
  const { data: snapshots = [], isLoading: loadingSnapshots } = useGraphQL(
    environment === 'main' ? null : 'SpaceSnapshots',
    data => data?.SpaceSnapshots,
    { environment },
    { revalidateOnMount: true }
  );
  const [pickedRevision, setPickedRevision] = useState<number>();
  const revision =
    environment === 'main'
      ? 0
      : (pickedRevision ?? (askedEnvironment === environment ? askedRevision : undefined) ?? snapshots.at(0)?.revision);
  const access = deployments.find(d => d.domain === target?.domain)?.credential?.identifier ?? '';
  const [pickedCredential, setPickedCredential] = useState<string>();
  const credential = pickedCredential ?? access;
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string>();
  const {
    data: history,
    isLoading: loadingHistory,
    mutate: refreshHistory
  } = useGraphQL(
    target ? 'SpaceReleases' : null,
    data => data?.SpaceReleases,
    { domain: target?.domain },
    { revalidateOnMount: true }
  );
  /** A rollback asked for and not yet confirmed: what it would put back. */
  const [rollingBackTo, setRollingBackTo] = useState<SpaceServedVersion>();

  const served = target?.serves ?? undefined;
  const { changes, loading: comparing } = useVersionChanges(
    served && (served.environment === 'main' || served.revision) ? served : undefined,
    revision !== undefined ? { environment, ...(revision ? { revision } : {}) } : undefined
  );
  // What publishing it there would do — a deploy and why — asked of the platform, on a target holding a copy.
  const { data: check, isLoading: checking } = useGraphQL(
    holdsACopy && environment !== 'main' && revision ? 'SpacePublishCheck' : null,
    checkOf,
    { domain: target?.domain, environment, revision },
    { revalidateOnMount: true }
  );

  const needsDeploy = check?.deploy.needed ?? false;
  const alreadyLive =
    target !== undefined && served?.environment === environment && served.revision === revision && !needsDeploy;
  const staticRefused = check?.mode === 'static' && check.serverFeatures.length > 0;
  const refusal = !target
    ? 'This space has no domain yet: add one in the console.'
    : !target.verified
      ? `${target.domain} is not verified yet: its DNS record is not there.`
      : target.locked
        ? `${target.locked.requires} deploys it again — it keeps serving what it serves.`
        : holdsACopy && environment === 'main'
          ? `${target.domain} holds a copy of the site: it serves a snapshot, never the draft.`
          : environment !== 'main' && revision === undefined
            ? `${ENVIRONMENT_META[environment].label} has no snapshot yet: make one first.`
            : staticRefused
              ? `It runs ${check.serverFeatures.join(', ')} on a server: a prerendered site has none.`
              : alreadyLive
                ? `${target.domain} already serves it.`
                : undefined;

  const afterWrite = useCallback(async () => {
    await Promise.all([refreshHistory(), refreshTargets()]);
  }, [refreshHistory, refreshTargets]);

  const handlePublish = useCallback(async () => {
    if (!target || refusal) {
      return;
    }

    setWorking(true);
    setFailure(undefined);
    const response = await mutate(
      'SpaceDeploy',
      {
        environment,
        domain: target.domain,
        revision: revision ?? 0,
        credentialIdentifier: credential,
        deploy: needsDeploy
      },
      true
    );
    setWorking(false);
    await afterWrite();
    if (!response.result) {
      setFailure(errorOf(response.error, 'It was not published.'));

      return;
    }

    const said = `${target.domain} now serves ${environment === 'main' ? 'the draft' : revisionName(environment, revision ?? 0)}.`;
    setView(
      response.result.deployId
        ? { name: 'deploy', deployId: response.result.deployId, said: `${said} Its copy is being deployed:` }
        : { name: 'done', said }
    );
  }, [afterWrite, credential, environment, mutate, needsDeploy, refusal, revision, target]);

  const handleRollBack = useCallback(async () => {
    if (!target || !rollingBackTo) {
      return;
    }

    setWorking(true);
    setFailure(undefined);
    const response = await mutate(
      'SpaceRollback',
      { domain: target.domain, environment: rollingBackTo.environment, revision: rollingBackTo.revision },
      true
    );
    const back = rollingBackTo;
    setRollingBackTo(undefined);
    setWorking(false);
    await afterWrite();
    if (!response.result) {
      setFailure(errorOf(response.error, 'It was not rolled back.'));

      return;
    }

    const said = `${target.domain} serves ${versionName(back)} again.`;
    setView(
      response.result.deployId
        ? { name: 'deploy', deployId: response.result.deployId, said: `${said} Its copy is being shipped again:` }
        : { name: 'done', said }
    );
  }, [afterWrite, mutate, rollingBackTo, target]);

  const handleDeployAgain = useCallback(
    async (kind: 'deploy' | 'redeploy') => {
      if (!target) {
        return;
      }

      setWorking(true);
      setFailure(undefined);
      const response = await mutate('SpaceRedeploy', { domain: target.domain, kind }, true);
      setWorking(false);
      await refreshTargets();
      if (response.result) {
        setView({
          name: 'deploy',
          deployId: response.result.id,
          said: `${target.domain} is deployed again${kind === 'redeploy' ? ' with the newest versions' : ''}:`
        });
      } else {
        setFailure(errorOf(response.error, 'It was not deployed.'));
      }
    },
    [mutate, refreshTargets, target]
  );

  const rollback = target?.rollback ?? history?.rollback ?? undefined;
  // One string: the button takes its words as a single child.
  const rollbackLabel = rollback
    ? `Roll back to ${rollback.environment === 'main' ? 'the draft' : `r${String(rollback.revision)}`}`
    : '';
  const pickTarget = (domain: string) => {
    setPickedDomain(domain);
    setPickedEnvironment(undefined);
    setPickedRevision(undefined);
    setPickedCredential(undefined);
    setRollingBackTo(undefined);
    setFailure(undefined);
  };
  const askRollBack = () => {
    setView({ name: 'publish' });
    setRollingBackTo(rollback);
  };

  if (view.name === 'deploy' && target) {
    return (
      <DeployProgress
        deployId={view.deployId}
        domain={target.domain}
        said={view.said}
        {...(rollback ? { onRollBack: askRollBack } : {})}
        onDone={onClose}
      />
    );
  }

  if (view.name === 'done' && target) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="success">{view.said}</Notice>
        <div className="flex justify-end gap-2">
          {rollback && (
            <Button
              size="sm"
              intent="secondary"
              className="mr-auto whitespace-nowrap"
              iconPlacement="before"
              onClick={askRollBack}
            >
              <Button.Icon icon="fa-solid fa-rotate-left" />
              {rollbackLabel}
            </Button>
          )}
          <Button
            size="sm"
            intent="secondary"
            onClick={() => window.open(`https://${target.domain}`, '_blank', 'noopener,noreferrer')}
          >
            Open the site
          </Button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (view.name === 'settings' && target && catalog) {
    return (
      <TargetSettings
        target={target}
        catalog={catalog}
        config={configOf(target)}
        onSaved={() => void refreshTargets()}
        onBack={() => setView({ name: 'publish' })}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <section className="flex flex-col gap-2" aria-label="Targets">
        <span className="flex items-center justify-between">
          <h5 className="text-ui-fg-subtle text-[11px] font-bold tracking-wider uppercase">Where</h5>
          <span role="tablist" aria-label="View" className="bg-ui-raised flex rounded-md p-0.5 text-xs">
            {(['publish', 'history'] as const).map(name => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={view.name === name}
                className={clsx(
                  'rounded px-2 py-0.5 transition-colors',
                  view.name === name ? 'bg-ui-panel text-ui-fg shadow-sm' : 'text-ui-fg-subtle hover:text-ui-fg'
                )}
                onClick={() => setView(name === 'history' ? { name: 'history' } : { name: 'publish' })}
              >
                {name === 'publish' ? 'Publish' : 'History'}
              </button>
            ))}
          </span>
        </span>
        {loadingTargets && <span className="text-ui-fg-subtle text-xs">Reading the domains…</span>}
        <div role="radiogroup" aria-label="Domain" className="flex flex-col gap-1.5">
          {targets.map(each => {
            const chosen = each.domain === target?.domain;
            const meta = ENVIRONMENT_META[each.environment];
            const asks = targetAttention([each]).at(0);

            return (
              <div
                key={each.domain}
                className={clsx(
                  'flex items-stretch rounded-lg border transition-colors',
                  chosen ? 'border-primary-500 bg-primary-500/10' : 'border-ui-line hover:bg-ui-hover'
                )}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  className="focus-visible:ring-primary-500 flex min-w-0 grow flex-col gap-0.5 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-2"
                  onClick={() => pickTarget(each.domain)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-ui-fg truncate text-sm font-semibold">{each.domain}</span>
                    <span className="text-ui-fg-subtle flex shrink-0 items-center gap-1.5 text-[11px]">
                      <span className={clsx('h-1.5 w-1.5 rounded-full', meta.dot)} />
                      {meta.label} · {targetWhere(each)}
                    </span>
                  </span>
                  <span className="text-ui-fg-subtle truncate text-xs">
                    {each.serves ? `Serves ${versionName(each.serves)}` : 'Nothing published yet'}
                    {each.lastDeploy?.finishedAt
                      ? ` · deployed ${shortAge(each.lastDeploy.finishedAt * 1000)} ago`
                      : ''}
                  </span>
                  {asks && <span className={clsx('truncate text-xs', TONE_TEXT[asks.tone])}>{asks.words}</span>}
                </button>
                {chosen && !each.plitziOwned && (
                  <button
                    type="button"
                    title={`Where ${each.domain} is served: Plitzi, or a copy of the site on a provider`}
                    aria-label={`Settings of ${each.domain}`}
                    className="text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover m-1 flex w-8 shrink-0 items-center justify-center rounded-md"
                    onClick={() => setView({ name: 'settings' })}
                  >
                    <i className="fa-solid fa-sliders" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {view.name === 'history' && target && (
        <ReleaseHistory
          open
          domain={target.domain}
          releases={history?.releases ?? []}
          loading={loadingHistory}
          onServeAgain={version => {
            setView({ name: 'publish' });
            setRollingBackTo(version);
          }}
        />
      )}

      {view.name === 'publish' && (
        <>
          {target && (target.update || target.lastDeploy?.status === 'failed') && !target.running && (
            <Notice tone={target.lastDeploy?.status === 'failed' ? 'danger' : 'caution'}>
              <span className="flex items-center justify-between gap-3">
                <span>
                  {target.lastDeploy?.status === 'failed'
                    ? `Its last deploy failed: ${target.lastDeploy.error ?? 'its log says why'}`
                    : target.update?.words}
                </span>
                <Button
                  size="xs"
                  intent="secondary"
                  className="shrink-0"
                  disabled={working}
                  onClick={() => void handleDeployAgain(target.update ? 'redeploy' : 'deploy')}
                >
                  {target.update ? 'Redeploy' : 'Deploy again'}
                </Button>
              </span>
            </Notice>
          )}
          {target?.running && (
            <Notice tone="info">
              <span className="flex items-center justify-between gap-3">
                <span>Deploying {revisionName(target.running.environment, target.running.revision)}…</span>
                <Button
                  size="xs"
                  intent="secondary"
                  onClick={() => {
                    if (target.running) {
                      setView({
                        name: 'deploy',
                        deployId: target.running.id,
                        said: `${target.domain} is being deployed:`
                      });
                    }
                  }}
                >
                  Follow it
                </Button>
              </span>
            </Notice>
          )}

          <EnvironmentSegments
            label="Environment"
            value={environment}
            onChange={value => {
              setPickedEnvironment(value);
              setPickedRevision(undefined);
            }}
            segments={[
              ...(holdsACopy ? [] : [{ value: 'main' as const, detail: 'Live as it is saved' }]),
              ...PUBLISHED_ENVIRONMENTS.map(env => ({
                value: env,
                detail: latestDetail(byEnvironment[env]),
                lockedBy: locked(env)?.requires
              }))
            ]}
          />

          {environment !== 'main' && (
            <RevisionList
              environment={environment}
              snapshots={snapshots}
              loading={loadingSnapshots}
              revision={revision}
              domain={target?.domain}
              onPick={setPickedRevision}
            />
          )}

          {target && revision !== undefined && !alreadyLive && (
            <ChangesSummary
              title={`What changes on ${target.domain}`}
              changes={changes}
              loading={comparing}
              empty="Nothing is published there yet to compare with"
            />
          )}

          {target && !holdsACopy && (
            <details className="text-ui-fg-subtle text-xs">
              <summary className="hover:text-ui-fg w-fit cursor-pointer">Access to {target.domain}</summary>
              <label className="mt-2 flex flex-col gap-1">
                <span>Who may open it</span>
                <select
                  className="border-ui-line bg-ui-panel text-ui-fg rounded-md border px-2 py-1.5 text-sm"
                  value={credential}
                  onChange={event => setPickedCredential(event.target.value)}
                >
                  <option value="">Everybody</option>
                  {credentials.map(item => (
                    <option key={item.identifier} value={item.identifier}>
                      Behind {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </details>
          )}

          {target && revision !== undefined && !refusal && (
            <WhatHappens
              target={target}
              environment={environment}
              revision={revision}
              served={served}
              check={holdsACopy ? check : undefined}
              checking={holdsACopy && checking}
            />
          )}
        </>
      )}

      {failure && <Notice tone="danger">{failure}</Notice>}

      {target && rollingBackTo && (
        <div
          role="alertdialog"
          aria-label="Roll back"
          className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        >
          <p className="text-ui-fg">
            Put {versionName(rollingBackTo)} back on <b>{target.domain}</b>?{' '}
            {holdsACopy
              ? 'Its copy is shipped again — from the deploy kept for it when there is one.'
              : 'It is live at once.'}
          </p>
          <p className="text-ui-fg-subtle text-xs">
            Feature flags and the space’s data stay as they are now: they are the environment’s, not the snapshot’s.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" intent="custom" className={QUIET_BUTTON} onClick={() => setRollingBackTo(undefined)}>
              Keep it as it is
            </Button>
            <Button size="sm" intent="secondary" disabled={working} onClick={() => void handleRollBack()}>
              {working ? 'Rolling back…' : 'Roll back'}
            </Button>
          </div>
        </div>
      )}

      <div className="border-ui-line flex items-center justify-end gap-2 border-t pt-3">
        {rollback && !rollingBackTo && (
          <Button
            size="sm"
            intent="secondary"
            className="mr-auto shrink-0 whitespace-nowrap"
            iconPlacement="before"
            title={`What ${target?.domain ?? 'the domain'} served right before its latest release`}
            onClick={() => setRollingBackTo(rollback)}
          >
            <Button.Icon icon="fa-solid fa-rotate-left" />
            {rollbackLabel}
          </Button>
        )}
        {refusal && view.name === 'publish' && (
          <span className={clsx('text-ui-fg-subtle text-xs', !rollback && 'mr-auto')}>{refusal}</span>
        )}
        <Button size="sm" intent="custom" className={QUIET_BUTTON} onClick={onClose}>
          {view.name === 'history' ? 'Close' : 'Cancel'}
        </Button>
        {view.name === 'publish' && (
          <Button
            size="sm"
            disabled={refusal !== undefined || working || (holdsACopy && checking)}
            onClick={() => void handlePublish()}
          >
            {working
              ? needsDeploy
                ? 'Starting the deploy…'
                : 'Publishing…'
              : needsDeploy
                ? 'Publish and deploy'
                : 'Publish'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default PublishSheet;
