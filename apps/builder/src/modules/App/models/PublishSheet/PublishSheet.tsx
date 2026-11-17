import Button from '@plitzi/plitzi-ui/Button';
import { useCallback, useMemo, useState } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';
import { issuesFromError, PUBLISH_REFUSED } from '@pmodules/Space/helpers/spaceIssues';
import useShowSpaceIssues from '@pmodules/Space/hooks/useShowSpaceIssues';
import useSpaceEntitlements from '@pmodules/Space/hooks/useSpaceEntitlements';
import useSpaceIssues from '@pmodules/Space/hooks/useSpaceIssues';

import AccessPicker from './AccessPicker';
import DeployProgress from './DeployProgress';
import DomainList from './DomainList';
import { latestEnvironmentOf, versionName } from './helpers';
import OwnAddressCard from './OwnAddressCard';
import PublishDone from './PublishDone';
import PublishWhat from './PublishWhat';
import ReleaseHistory from './ReleaseHistory';
import RevisionList from './RevisionList';
import RollbackConfirm from './RollbackConfirm';
import ScheduledPublishes, { momentWords } from './ScheduledPublishes';
import ScheduleRow from './ScheduleRow';
import SheetTabs from './SheetTabs';
import TargetNotices from './TargetNotices';
import TargetSettings from './TargetSettings';
import WhatHappens from './WhatHappens';
import { useVersionChanges } from '../../components/ChangesSummary';
import Notice from '../../components/Notice';
import { PUBLISHED_ENVIRONMENTS, revisionName } from '../../helpers/environments';
import useLatestSnapshots from '../../hooks/useLatestSnapshots';
import useSpaceTargets from '../../hooks/useSpaceTargets';

import type { ContentKind } from './helpers';
import type { PublishedEnvironment } from '../../helpers/environments';
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

/** The domain to open on: one asked for, one the snapshot's environment shows, one showing a version, any. */
const firstDomain = (domains: readonly SpaceTarget[], environment: Environment | undefined, asked?: string) =>
  domains.find(t => t.domain === asked) ??
  domains.find(t => t.verified && t.environment === environment && t.environment !== 'main') ??
  domains.find(t => t.verified && t.environment !== 'main') ??
  domains.find(t => t.verified) ??
  domains.at(0);

const checkOf = (response: { SpacePublishCheck: SpacePublishCheck } | undefined) => response?.SpacePublishCheck;

const errorOf = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : typeof error === 'string' && error ? error : fallback;

/** A target's settings as the settings form reads them: its kept values, as text. */
const configOf = (target: SpaceTarget): Record<string, string> =>
  Object.fromEntries(
    Object.entries(target.config ?? {}).flatMap(([key, value]) => (typeof value === 'string' ? [[key, value]] : []))
  );

const isPublished = (environment: Environment | undefined): environment is PublishedEnvironment =>
  environment !== undefined && environment !== 'main';

/**
 * Publish (RFC 0034 §11.3), for somebody who has never done it: the space's own address first — live with every save,
 * nothing to publish there — then its domains, one chosen; and Publish means one thing: the latest changes go out,
 * kept as a version on the way. Who may see it and what will happen are said before anything does. Going back to a
 * version is the history's (one list of the versions kept, whatever environment kept each), and showing every save is
 * the domain's settings' — each sends its choice here, with the way back to the latest changes. Pressed, a deploy
 * becomes its progress here.
 */
const PublishSheet = ({
  environment: askedEnvironment,
  revision: askedRevision,
  domain: askedDomain,
  view: askedView,
  onClose
}: PublishSheetProps) => {
  const { mutate, webId } = useBuilderNetwork();
  const { locked } = useSpaceEntitlements();
  const { byEnvironment, refresh: refreshLatest } = useLatestSnapshots();
  const { refresh: refreshIssues } = useSpaceIssues();
  const showSpaceIssues = useShowSpaceIssues();
  const { targets: catalog, loading: loadingTargets, refresh: refreshTargets } = useSpaceTargets();
  const targets = useMemo(() => catalog?.targets ?? [], [catalog]);
  const own = targets.find(each => each.ownAddress);
  const domains = useMemo(() => targets.filter(each => !each.ownAddress), [targets]);
  // The access a domain is behind is the domain's own setting, read with the domains.
  const { data: deployments = [], mutate: refreshDeployments } = useGraphQL(
    'SpaceDeployments',
    data => data?.SpaceDeployments.edges,
    undefined,
    { revalidateOnMount: true }
  );
  const { data: passwords = [] } = useGraphQL('SpaceCredentials', data => data?.SpaceCredentials.edges, {
    filter: { provider: { eq: 'ssr' } }
  });
  const accessOf = useCallback(
    (domain: string | undefined) => deployments.find(d => d.domain === domain)?.credential?.identifier ?? '',
    [deployments]
  );

  const [view, setView] = useState<View>(askedView === 'history' ? { name: 'history' } : { name: 'publish' });
  const [pickedDomain, setPickedDomain] = useState<string>();
  const target = useMemo(
    () => domains.find(t => t.domain === pickedDomain) ?? firstDomain(domains, askedEnvironment, askedDomain),
    [askedDomain, askedEnvironment, domains, pickedDomain]
  );
  const holdsACopy = target !== undefined && target.mode !== 'ssr';
  const served = target?.serves ?? undefined;

  // What it should show. A version asked for opens on it; otherwise the latest changes — what pressing Publish means.
  const isLocked = useCallback((environment: PublishedEnvironment) => locked(environment) !== undefined, [locked]);
  const versionsLockedBy = PUBLISHED_ENVIRONMENTS.every(isLocked) ? locked('production')?.requires : undefined;
  const [pickedKind, setPickedKind] = useState<ContentKind>();
  const defaultKind: ContentKind =
    askedRevision !== undefined && isPublished(askedEnvironment) ? 'saved' : versionsLockedBy ? 'live' : 'latest';
  const kind: ContentKind = pickedKind === 'live' && holdsACopy ? 'latest' : (pickedKind ?? defaultKind);

  // The latest changes: kept in the environment the domain shows already, or the one nearest the public — never asked.
  const latestEnvironment = latestEnvironmentOf(served?.environment, isLocked);
  const latestKept = latestEnvironment ? byEnvironment[latestEnvironment] : undefined;
  const { changes: sinceKept } = useVersionChanges(
    kind === 'latest' && latestKept
      ? { environment: latestKept.environment, revision: latestKept.revision }
      : undefined,
    { environment: 'main' }
  );
  /** Nothing changed since the environment's latest version: that one is published, no new one is kept. */
  const keptAs = latestKept && sinceKept?.total === 0 ? latestKept.revision : undefined;
  const [description, setDescription] = useState('');

  // A version kept before: one picked in the history, or the one just kept with Snapshot.
  const [picked, setPicked] = useState<{ environment: PublishedEnvironment; revision: number }>();
  const savedEnvironment: PublishedEnvironment =
    picked?.environment ?? (isPublished(askedEnvironment) ? askedEnvironment : undefined) ?? 'production';
  const savedRevision = picked?.revision ?? (picked ? undefined : askedRevision);
  // Every version kept, in one list: whoever never chose an environment reads what they kept, not three lists.
  const {
    data: snapshots = [],
    isLoading: loadingSnapshots,
    mutate: refreshSnapshots
  } = useGraphQL(
    kind === 'saved' || view.name === 'history' ? 'SpaceSnapshots' : null,
    data => data?.SpaceSnapshots,
    // Named as none: the builder fills in its own environment — the draft's — where a query names none.
    { environment: null },
    { revalidateOnMount: true }
  );
  const savedSnapshot = snapshots.find(
    each => each.environment === savedEnvironment && each.revision === savedRevision
  );

  // The version it comes to: the draft for every save, none yet for latest changes still to be kept.
  const environment: Environment | undefined =
    kind === 'live' ? 'main' : kind === 'latest' ? latestEnvironment : savedEnvironment;
  const revision = kind === 'live' ? 0 : kind === 'latest' ? keptAs : savedRevision;
  const keepsANewVersion = kind === 'latest' && keptAs === undefined;

  const { changes, loading: comparing } = useVersionChanges(
    served && (served.environment === 'main' || served.revision) ? served : undefined,
    keepsANewVersion || kind === 'live'
      ? { environment: 'main' }
      : environment && revision
        ? { environment, revision }
        : undefined
  );
  // What publishing it there would do — a deploy and why — asked of the platform, on a domain holding a copy.
  const { data: check, isLoading: checking } = useGraphQL(
    holdsACopy && isPublished(environment) && revision ? 'SpacePublishCheck' : null,
    checkOf,
    { domain: target?.domain, environment, revision },
    { revalidateOnMount: true }
  );

  const [pickedAccess, setPickedAccess] = useState<string>();
  const access = pickedAccess ?? accessOf(target?.domain);
  const [working, setWorking] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  /** A publish set for later: the moment, as the person's own clock reads it (`datetime-local`). */
  const [later, setLater] = useState<string>();
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

  const needsDeploy = check?.deploy.needed ?? false;
  const accessChanged = access !== accessOf(target?.domain);
  const alreadyLive =
    target !== undefined &&
    !keepsANewVersion &&
    served !== undefined &&
    served.environment === environment &&
    served.revision === revision &&
    !needsDeploy &&
    !accessChanged;
  const staticRefused = check?.mode === 'static' && check.serverFeatures.length > 0;
  const refusal = !target
    ? undefined
    : !target.verified
      ? `${target.domain} is not connected yet: its DNS record is missing. Add it where the domain was bought — the console's Domains tab says what to add — and publish here once it is checked.`
      : target.locked
        ? `${target.locked.requires} deploys it again — it keeps showing what it shows.`
        : kind === 'latest' && !latestEnvironment
          ? `Versions are included in the ${versionsLockedBy ?? 'next'} plan.`
          : kind === 'saved' && savedRevision === undefined
            ? 'Choose the version to publish in History.'
            : staticRefused
              ? `It runs ${check.serverFeatures.join(', ')} on a server: a prerendered site has none.`
              : alreadyLive
                ? `${target.domain} already shows it.`
                : undefined;
  const scheduleLocked = locked('deployAutomation');
  const canSchedule = kind !== 'live' && !refusal;
  const addUrl = `${typeof window === 'undefined' ? 'https://plitzi.com' : window.location.origin}/spaces/${String(webId)}#domains`;

  const afterWrite = useCallback(async () => {
    await Promise.all([refreshHistory(), refreshTargets(), refreshDeployments()]);
  }, [refreshDeployments, refreshHistory, refreshTargets]);

  /**
   * The latest changes kept as a version, as Snapshot keeps them — refused, as Snapshot is, while the space has errors:
   * their list is shown instead. Its revision, or nothing when it was not kept.
   */
  const keepLatest = useCallback(async (): Promise<number | undefined> => {
    if (!latestEnvironment) {
      return undefined;
    }

    const issues = await refreshIssues();
    if (issues && issues.errors.length > 0) {
      await showSpaceIssues(issues, PUBLISH_REFUSED);

      return undefined;
    }

    const kept = await mutate(
      'SpacePublish',
      { environment: latestEnvironment, description: description.trim() || 'Published from the builder' },
      true
    );
    const refused = issuesFromError(kept.error);
    if (refused) {
      await showSpaceIssues({ errors: refused, warnings: [], suggestions: [] }, PUBLISH_REFUSED);

      return undefined;
    }

    if (!kept.result) {
      setFailure(errorOf(kept.error, 'Your changes were not kept as a version.'));

      return undefined;
    }

    await Promise.all([refreshLatest(), refreshSnapshots()]);

    return kept.result.revision;
  }, [description, latestEnvironment, mutate, refreshIssues, refreshLatest, refreshSnapshots, showSpaceIssues]);

  const handlePublish = useCallback(async () => {
    if (!target || refusal || !environment) {
      return;
    }

    setWorking(true);
    setFailure(undefined);
    const publishing = keepsANewVersion ? await keepLatest() : revision;
    if (publishing === undefined) {
      setWorking(false);

      return;
    }

    const shown = environment === 'main' ? 'every change as you save it' : revisionName(environment, publishing);
    if (later && environment !== 'main') {
      const at = Math.floor(new Date(later).getTime() / 1000);
      const response = await mutate(
        'SpaceSchedulePublish',
        { domain: target.domain, environment, revision: publishing, at },
        true
      );
      setWorking(false);
      if (response.result) {
        setView({ name: 'done', said: `${target.domain} will show ${shown} on ${momentWords(at)}.` });
      } else {
        setFailure(errorOf(response.error, 'It was not set for later.'));
      }

      return;
    }

    const response = await mutate(
      'SpaceDeploy',
      {
        environment,
        domain: target.domain,
        revision: publishing,
        credentialIdentifier: access,
        // On a domain holding a copy: deployed when the version needs it, and only then — the platform decides.
        deploy: holdsACopy
      },
      true
    );
    setWorking(false);
    await afterWrite();
    if (!response.result) {
      setFailure(errorOf(response.error, 'It was not published.'));

      return;
    }

    const said = `${target.domain} now shows ${shown}.`;
    setView(
      response.result.deployId
        ? { name: 'deploy', deployId: response.result.deployId, said: `${said} Its copy is being deployed:` }
        : { name: 'done', said }
    );
  }, [
    access,
    afterWrite,
    environment,
    holdsACopy,
    keepLatest,
    keepsANewVersion,
    later,
    mutate,
    refusal,
    revision,
    target
  ]);

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

    const said = `${target.domain} shows ${versionName(back)} again.`;
    setView(
      response.result.deployId
        ? { name: 'deploy', deployId: response.result.deployId, said: `${said} Its copy is being shipped again:` }
        : { name: 'done', said }
    );
  }, [afterWrite, mutate, rollingBackTo, target]);

  const handleDeployAgain = useCallback(async () => {
    if (!target) {
      return;
    }

    const kind = target.update ? 'redeploy' : 'deploy';
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
  }, [mutate, refreshTargets, target]);

  const rollback = target?.rollback ?? history?.rollback ?? undefined;
  // One string: the button takes its words as a single child.
  const rollbackLabel = rollback
    ? `Roll back to ${rollback.environment === 'main' ? 'every save' : revisionName(rollback.environment, rollback.revision)}`
    : '';

  const handleChooseDomain = useCallback((domain: string) => {
    setPickedDomain(domain);
    setPickedKind(undefined);
    setPicked(undefined);
    setPickedAccess(undefined);
    setRollingBackTo(undefined);
    setFailure(undefined);
  }, []);
  const handleSettings = useCallback((domain: string) => {
    setPickedDomain(domain);
    setView({ name: 'settings' });
  }, []);
  const handleShowPublish = useCallback(() => setView({ name: 'publish' }), []);
  const handleShowHistory = useCallback(() => setView({ name: 'history' }), []);
  const handleLatest = useCallback(() => {
    setPickedKind('latest');
    setPicked(undefined);
    setFailure(undefined);
  }, []);
  const handlePublishVersion = useCallback((environment: PublishedEnvironment, revision: number) => {
    setPickedKind('saved');
    setPicked({ environment, revision });
    setFailure(undefined);
    setView({ name: 'publish' });
  }, []);
  const handleEverySave = useCallback(() => {
    setPickedKind('live');
    setFailure(undefined);
    setView({ name: 'publish' });
  }, []);
  const handleAskRollBack = useCallback(() => {
    setView({ name: 'publish' });
    setRollingBackTo(rollback);
  }, [rollback]);
  const handleServeAgain = useCallback((version: SpaceServedVersion) => {
    setView({ name: 'publish' });
    setRollingBackTo(version);
  }, []);
  const handleKeepAsItIs = useCallback(() => setRollingBackTo(undefined), []);
  const handleConfirmRollBack = useCallback(() => void handleRollBack(), [handleRollBack]);
  const handleDeployAgainClick = useCallback(() => void handleDeployAgain(), [handleDeployAgain]);
  const handleFollowDeploy = useCallback(() => {
    if (target?.running) {
      setView({ name: 'deploy', deployId: target.running.id, said: `${target.domain} is being deployed:` });
    }
  }, [target]);
  const handleSchedule = useCallback(() => setScheduling(true), []);
  const handlePublishNow = useCallback(() => {
    setScheduling(false);
    setLater(undefined);
  }, []);
  const handlePublishClick = useCallback(() => void handlePublish(), [handlePublish]);
  const handleOpenSite = useCallback(() => {
    if (target) {
      window.open(`https://${target.domain}`, '_blank', 'noopener,noreferrer');
    }
  }, [target]);
  const handleRefreshTargets = useCallback(() => void refreshTargets(), [refreshTargets]);
  const handleOwnAccessChanged = useCallback(async () => {
    await Promise.all([refreshTargets(), refreshDeployments()]);
  }, [refreshDeployments, refreshTargets]);

  if (view.name === 'deploy' && target) {
    return (
      <DeployProgress
        deployId={view.deployId}
        domain={target.domain}
        said={view.said}
        {...(rollback ? { onRollBack: handleAskRollBack } : {})}
        onDone={onClose}
      />
    );
  }

  if (view.name === 'done' && target) {
    return (
      <PublishDone
        said={view.said}
        {...(rollback ? { rollbackLabel } : {})}
        onRollBack={handleAskRollBack}
        onOpenSite={handleOpenSite}
        onDone={onClose}
      />
    );
  }

  if (view.name === 'settings' && target && catalog) {
    return (
      <TargetSettings
        target={target}
        lockedBy={locked('deployAutomation')?.requires}
        catalog={catalog}
        config={configOf(target)}
        onSaved={handleRefreshTargets}
        onEverySave={handleEverySave}
        onBack={handleShowPublish}
      />
    );
  }

  const publishing = view.name === 'publish';

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <SheetTabs publishing={publishing} onPublish={handleShowPublish} onHistory={handleShowHistory} />

      {publishing && own && (
        <OwnAddressCard
          target={own}
          access={accessOf(own.domain)}
          passwords={passwords}
          onChanged={handleOwnAccessChanged}
        />
      )}

      <DomainList
        domains={domains}
        chosen={target?.domain}
        loading={loadingTargets}
        addUrl={addUrl}
        lockedBy={locked('customDomain')?.requires}
        onChoose={handleChooseDomain}
        onSettings={handleSettings}
      />

      {view.name === 'history' && target && <ScheduledPublishes domain={target.domain} />}

      {view.name === 'history' && (
        <RevisionList
          snapshots={snapshots}
          loading={loadingSnapshots}
          domain={target?.verified ? target.domain : undefined}
          onPublish={handlePublishVersion}
        />
      )}

      {view.name === 'history' && target && (
        <ReleaseHistory
          domain={target.domain}
          releases={history?.releases ?? []}
          loading={loadingHistory}
          onServeAgain={handleServeAgain}
        />
      )}

      {publishing && target && (
        <>
          <TargetNotices
            target={target}
            working={working}
            onDeployAgain={handleDeployAgainClick}
            onFollow={handleFollowDeploy}
          />

          {target.verified && (
            <PublishWhat
              domain={target.domain}
              kind={kind}
              latestEnvironment={latestEnvironment}
              keptAs={keptAs}
              description={description}
              onDescription={setDescription}
              savedEnvironment={savedEnvironment}
              savedRevision={savedRevision}
              savedSnapshot={savedSnapshot}
              versionsLockedBy={versionsLockedBy}
              onLatest={handleLatest}
            />
          )}

          {target.verified && !holdsACopy && (
            <AccessPicker
              domain={target.domain}
              value={access}
              passwords={passwords}
              hint="Applies when you publish."
              onChange={setPickedAccess}
            />
          )}

          {!refusal && (
            <WhatHappens
              target={target}
              kind={kind}
              environment={isPublished(environment) ? environment : undefined}
              revision={kind === 'live' ? undefined : revision}
              served={served}
              changes={changes}
              comparing={comparing}
              check={holdsACopy ? check : undefined}
              checking={holdsACopy && checking}
            />
          )}

          {refusal && <Notice tone="info">{refusal}</Notice>}
        </>
      )}

      {failure && <Notice tone="danger">{failure}</Notice>}

      {target && rollingBackTo && (
        <RollbackConfirm
          domain={target.domain}
          version={rollingBackTo}
          holdsACopy={holdsACopy}
          working={working}
          onKeep={handleKeepAsItIs}
          onConfirm={handleConfirmRollBack}
        />
      )}

      {publishing && scheduling && canSchedule && (
        <ScheduleRow value={later ?? ''} onChange={setLater} onCancel={handlePublishNow} />
      )}

      <div className="border-ui-line flex flex-wrap items-center justify-end gap-2 border-t pt-3">
        {rollback && !rollingBackTo && (
          <Button
            size="sm"
            intent="secondary"
            className="mr-auto shrink-0 whitespace-nowrap"
            iconPlacement="before"
            title={`What ${target?.domain ?? 'the domain'} showed right before its latest publish`}
            onClick={handleAskRollBack}
          >
            <Button.Icon icon="fa-solid fa-rotate-left" />
            {rollbackLabel}
          </Button>
        )}
        {publishing && target && canSchedule && !scheduling && (
          <Button
            size="sm"
            intent="custom"
            className={QUIET_BUTTON}
            iconPlacement="before"
            disabled={scheduleLocked !== undefined}
            title={
              scheduleLocked
                ? `Publishing at a set time is included in the ${scheduleLocked.requires} plan`
                : 'Publish at a moment of your choosing'
            }
            onClick={handleSchedule}
          >
            <Button.Icon icon={scheduleLocked ? 'fa-solid fa-lock' : 'fa-solid fa-clock'} />
            Schedule…
          </Button>
        )}
        <Button size="sm" intent="custom" className={QUIET_BUTTON} onClick={onClose}>
          {publishing && target ? 'Cancel' : 'Close'}
        </Button>
        {publishing && target && (
          <Button
            size="sm"
            disabled={
              refusal !== undefined || working || (holdsACopy && checking) || (scheduling && later === undefined)
            }
            onClick={handlePublishClick}
          >
            {working
              ? keepsANewVersion
                ? 'Keeping your changes…'
                : 'Publishing…'
              : scheduling
                ? 'Schedule'
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
