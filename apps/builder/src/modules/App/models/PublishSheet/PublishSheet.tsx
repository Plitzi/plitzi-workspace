import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';
import useSpaceEntitlements from '@pmodules/Space/hooks/useSpaceEntitlements';

import ChangesSummary, { useVersionChanges } from '../../components/ChangesSummary';
import EnvironmentSegments from '../../components/EnvironmentSegments';
import Notice from '../../components/Notice';
import { ageAgo, shortAge } from '../../helpers/age';
import { ENVIRONMENT_META, PUBLISHED_ENVIRONMENTS, revisionName } from '../../helpers/environments';
import useLatestSnapshots, { latestDetail } from '../../hooks/useLatestSnapshots';

import type { Environment, SpaceDeployment, SpaceSnapshot } from '@plitzi/sdk-shared';

export type PublishSheetProps = {
  /** The snapshot to publish, when the sheet opens from "Snapshot and publish…". */
  environment?: Environment;
  revision?: number;
  onClose: () => void;
};

type Outcome =
  { state: 'idle' } | { state: 'publishing' } | { state: 'done'; said: string } | { state: 'failed'; said: string };

const QUIET_BUTTON = 'border-transparent bg-transparent text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover';

/** What serves a domain, in its card: Plitzi's page servers, or a bucket the site is uploaded to. */
const servedBy = (deployment: SpaceDeployment): string =>
  deployment.provider === 'ssr' ? 'Plitzi' : `${deployment.provider.toUpperCase()} bucket`;

/** What a domain serves now, said as a revision: the draft, a pinned one, or its environment's latest. */
const liveOf = (deployment: SpaceDeployment, latest: SpaceSnapshot | undefined): string => {
  if (deployment.environment === 'main') {
    return 'the draft, live as it is saved';
  }

  const revision = deployment.revision ?? latest?.revision;

  return revision ? revisionName(deployment.environment, revision) : `${deployment.environment}, nothing published yet`;
};

/** The domain to open on: one the snapshot's environment already serves, else a domain of the space's own, else any. */
const firstTarget = (deployments: readonly SpaceDeployment[], environment: Environment | undefined) =>
  deployments.find(d => d.isVerified && !d.default && d.environment === environment) ??
  deployments.find(d => d.isVerified && !d.default) ??
  deployments.find(d => d.isVerified) ??
  deployments.at(0);

/**
 * Publish: tell a domain which revision it serves. Its domains first, each with what it serves now; then the
 * environment and the revision, each snapshot with its words, who made it, how old and where it is live; then what will
 * happen, in words, before anything does — and one action. The sheet publishes and says how it went itself.
 */
const PublishSheet = ({ environment: askedEnvironment, revision: askedRevision, onClose }: PublishSheetProps) => {
  const { mutate } = useBuilderNetwork();
  const { locked } = useSpaceEntitlements();
  const { byEnvironment } = useLatestSnapshots();
  const { data: deployments = [], isLoading: loadingDeployments } = useGraphQL(
    'SpaceDeployments',
    data => data?.SpaceDeployments.edges,
    undefined,
    { revalidateOnMount: true }
  );
  const { data: credentials = [] } = useGraphQL('SpaceCredentials', data => data?.SpaceCredentials.edges, {
    filter: { provider: { eq: 'ssr' } }
  });

  const [pickedDomain, setPickedDomain] = useState<string>();
  const target = useMemo(
    () => deployments.find(d => d.domain === pickedDomain) ?? firstTarget(deployments, askedEnvironment),
    [askedEnvironment, deployments, pickedDomain]
  );
  const [pickedEnvironment, setPickedEnvironment] = useState<Environment>();
  const environment: Environment = pickedEnvironment ?? askedEnvironment ?? target?.environment ?? 'production';
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
  const [pickedCredential, setPickedCredential] = useState<string>();
  const credential = pickedCredential ?? target?.credential?.identifier ?? '';
  const [outcome, setOutcome] = useState<Outcome>({ state: 'idle' });

  const liveLatest = target && target.environment !== 'main' ? byEnvironment[target.environment] : undefined;
  const liveRevision = target?.environment === 'main' ? 0 : (target?.revision ?? liveLatest?.revision);
  const { changes, loading: comparing } = useVersionChanges(
    target && (target.environment === 'main' || liveRevision)
      ? { environment: target.environment, ...(liveRevision ? { revision: liveRevision } : {}) }
      : undefined,
    revision !== undefined ? { environment, ...(revision ? { revision } : {}) } : undefined
  );

  const alreadyLive = target !== undefined && target.environment === environment && liveRevision === revision;
  const refusal = !target
    ? 'This space has no domain yet.'
    : !target.isVerified
      ? `${target.domain} is not verified yet: its DNS records are not there.`
      : environment !== 'main' && revision === undefined
        ? `${ENVIRONMENT_META[environment].label} has no snapshot yet: make one first.`
        : alreadyLive
          ? `${target.domain} already serves it.`
          : undefined;

  const handlePublish = useCallback(async () => {
    if (!target || refusal) {
      return;
    }

    setOutcome({ state: 'publishing' });
    const response = await mutate(
      'SpaceDeploy',
      { environment, domain: target.domain, revision: revision ?? 0, credentialIdentifier: credential },
      true
    );
    if (response.result) {
      setOutcome({
        state: 'done',
        said: `${target.domain} now serves ${environment === 'main' ? 'the draft' : revisionName(environment, revision ?? 0)}.`
      });
    } else {
      const error = response.error;
      setOutcome({
        state: 'failed',
        said: error instanceof Error ? error.message : error || 'It was not published.'
      });
    }
  }, [credential, environment, mutate, refusal, revision, target]);

  if (outcome.state === 'done' && target) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="success">{outcome.said}</Notice>
        <div className="flex justify-end gap-2">
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

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <section className="flex flex-col gap-2" aria-label="Domains">
        <h5 className="text-ui-fg-subtle text-[11px] font-bold tracking-wider uppercase">Domain</h5>
        {loadingDeployments && <span className="text-ui-fg-subtle text-xs">Reading the domains…</span>}
        <div role="radiogroup" aria-label="Domain" className="flex flex-col gap-1.5">
          {deployments.map(deployment => {
            const chosen = deployment.domain === target?.domain;
            const meta = ENVIRONMENT_META[deployment.environment];
            const latest = deployment.environment === 'main' ? undefined : byEnvironment[deployment.environment];

            return (
              <button
                key={deployment.domain}
                type="button"
                role="radio"
                aria-checked={chosen}
                className={clsx(
                  'flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors outline-none',
                  'focus-visible:ring-primary-500 focus-visible:ring-2',
                  chosen ? 'border-primary-500 bg-primary-500/10' : 'border-ui-line hover:bg-ui-hover'
                )}
                onClick={() => {
                  setPickedDomain(deployment.domain);
                  setPickedEnvironment(undefined);
                  setPickedRevision(undefined);
                  setPickedCredential(undefined);
                  setOutcome({ state: 'idle' });
                }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-ui-fg truncate text-sm font-semibold">{deployment.domain}</span>
                  <span className="text-ui-fg-subtle flex shrink-0 items-center gap-1.5 text-[11px]">
                    <span className={clsx('h-1.5 w-1.5 rounded-full', meta.dot)} />
                    {meta.label} · {servedBy(deployment)}
                  </span>
                </span>
                <span className="text-ui-fg-subtle text-xs">
                  {deployment.isVerified ? (
                    <>
                      Serves {liveOf(deployment, latest)} · since {shortAge(deployment.updatedAt * 1000)}
                    </>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">
                      Not verified: its DNS records are not there yet
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <EnvironmentSegments
        label="Environment"
        value={environment}
        onChange={value => {
          setPickedEnvironment(value);
          setPickedRevision(undefined);
        }}
        segments={[
          { value: 'main', detail: 'Live as it is saved' },
          ...PUBLISHED_ENVIRONMENTS.map(env => ({
            value: env,
            detail: latestDetail(byEnvironment[env]),
            lockedBy: locked(env)?.requires
          }))
        ]}
      />

      {environment !== 'main' && (
        <section className="flex flex-col gap-2" aria-label="Revision">
          <h5 className="text-ui-fg-subtle text-[11px] font-bold tracking-wider uppercase">Revision</h5>
          {loadingSnapshots && <span className="text-ui-fg-subtle text-xs">Reading the snapshots…</span>}
          {!loadingSnapshots && snapshots.length === 0 && (
            <span className="text-ui-fg-subtle text-xs">
              {ENVIRONMENT_META[environment].label} has no snapshot yet: make one with Snapshot.
            </span>
          )}
          <div role="radiogroup" aria-label="Revision" className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {snapshots.map(snapshot => {
              const chosen = snapshot.revision === revision;
              const liveHere = snapshot.domains.includes(target?.domain ?? '');

              return (
                <button
                  key={snapshot.revision}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  className={clsx(
                    'flex flex-col gap-0.5 rounded-md border px-3 py-1.5 text-left transition-colors outline-none',
                    'focus-visible:ring-primary-500 focus-visible:ring-2',
                    chosen ? 'border-primary-500 bg-primary-500/10' : 'hover:bg-ui-hover border-transparent'
                  )}
                  onClick={() => setPickedRevision(snapshot.revision)}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-ui-fg text-sm font-semibold">r{snapshot.revision}</span>
                    <span className="text-ui-fg min-w-0 truncate text-sm">
                      {snapshot.description || 'No description'}
                    </span>
                    {liveHere && (
                      <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                        live here
                      </span>
                    )}
                  </span>
                  <span className="text-ui-fg-subtle truncate text-[11px]">
                    {[
                      snapshot.by?.username,
                      ageAgo(snapshot.publishedAt),
                      snapshot.domains.length > 0 && !liveHere ? `live on ${snapshot.domains.join(', ')}` : ''
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {target && revision !== undefined && !alreadyLive && (
        <ChangesSummary
          title={`What changes on ${target.domain}`}
          changes={changes}
          loading={comparing}
          empty="Nothing is published there yet to compare with"
        />
      )}

      {target && (
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
        <p className="text-ui-fg text-sm">
          <b>{target.domain}</b> will serve{' '}
          {environment === 'main'
            ? 'the draft: every saved edit goes live at once'
            : revisionName(environment, revision)}
          {liveRevision !== undefined &&
            ` — now ${target.environment === 'main' ? 'the draft' : revisionName(target.environment, liveRevision)}`}
          .{target.provider !== 'ssr' && ' Its site is uploaded to the bucket again.'}
        </p>
      )}

      {outcome.state === 'failed' && <Notice tone="danger">{outcome.said}</Notice>}

      <div className="border-ui-line flex items-center justify-end gap-2 border-t pt-3">
        {refusal && <span className="text-ui-fg-subtle mr-auto text-xs">{refusal}</span>}
        <Button size="sm" intent="custom" className={QUIET_BUTTON} onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={refusal !== undefined || outcome.state === 'publishing'}
          onClick={() => void handlePublish()}
        >
          {outcome.state === 'publishing' ? 'Publishing…' : 'Publish'}
        </Button>
      </div>
    </div>
  );
};

export default PublishSheet;
