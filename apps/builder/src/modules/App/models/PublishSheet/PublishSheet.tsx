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
import OwnAddressRow from './OwnAddressRow';
import PublishDone from './PublishDone';
import ReleaseHistory from './ReleaseHistory';
import RevisionList from './RevisionList';
import RollbackConfirm from './RollbackConfirm';
import ScheduledPublishes, { momentWords } from './ScheduledPublishes';
import ScheduleRow from './ScheduleRow';
import SheetFooter from './SheetFooter';
import SheetFrame from './SheetFrame';
import SheetTabs from './SheetTabs';
import ShowWhat from './ShowWhat';
import TargetNotices from './TargetNotices';
import TargetSettings from './TargetSettings';
import WhatHappens from './WhatHappens';
import { useVersionChanges } from '../../components/ChangesSummary';
import Notice from '../../components/Notice';
import { ENVIRONMENT_META, revisionName } from '../../helpers/environments';
import useLatestSnapshots from '../../hooks/useLatestSnapshots';
import useSpaceTargets from '../../hooks/useSpaceTargets';

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
 * Publish, for somebody who has never done it: where the site is, in one list — the space's own
 * address, always the latest saved edits, then the domains, one chosen — and what the chosen one shows, decided in the
 * order anybody would: an environment (each said for what it is for), the latest of it or one version, and whether the
 * editor's changes are kept as a new one first. Who may see it and what will happen are said before anything does.
 * The history lists every version kept, each to preview or publish; pressed, a deploy becomes its progress here.
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

  // What it shows: an environment, then its latest (each one kept there shows) or one version it stays on. A version
  // asked for — Snapshot's "publish it", the history's — opens on it; otherwise the environment the domain shows, or the
  // one nearest the public the plan includes, at its latest.
  const isLocked = useCallback((environment: PublishedEnvironment) => locked(environment) !== undefined, [locked]);
  const lockedRequires = useCallback((environment: PublishedEnvironment) => locked(environment)?.requires, [locked]);
  const [pickedEnvironment, setPickedEnvironment] = useState<Environment>();
  const [pickedFollows, setPickedFollows] = useState<boolean>();
  const [pickedRevision, setPickedRevision] = useState<number>();
  const askedHere = isPublished(askedEnvironment) && askedRevision !== undefined ? askedEnvironment : undefined;
  const chosenEnvironment: Environment =
    pickedEnvironment ?? askedHere ?? latestEnvironmentOf(served?.environment, isLocked) ?? 'main';
  // A domain holding a copy serves a version, never every save.
  const environment: Environment =
    chosenEnvironment === 'main' && holdsACopy
      ? (latestEnvironmentOf(undefined, isLocked) ?? 'main')
      : chosenEnvironment;
  const follows = pickedFollows ?? !(askedHere !== undefined && askedHere === environment);
  const latestKept = isPublished(environment) ? byEnvironment[environment] : undefined;

  // The environment's versions, to choose one.
  const { data: environmentSnapshots = [], isLoading: loadingEnvironment } = useGraphQL(
    isPublished(environment) && !follows ? 'SpaceSnapshots' : null,
    data => data?.SpaceSnapshots,
    { environment },
    { revalidateOnMount: true }
  );
  const chosenRevision =
    pickedRevision ?? (askedHere === environment ? askedRevision : undefined) ?? environmentSnapshots.at(0)?.revision;

  // Keeping the editor's changes as the environment's next version first: for the latest, when they differ from it.
  const { changes: sinceKept } = useVersionChanges(
    follows && latestKept ? { environment: latestKept.environment, revision: latestKept.revision } : undefined,
    { environment: 'main' }
  );
  const editorIsKept = latestKept !== undefined && sinceKept?.total === 0;
  const [pickedKeep, setPickedKeep] = useState<boolean>();
  const keepsFirst = isPublished(environment) && follows && !editorIsKept && (!latestKept || (pickedKeep ?? true));
  const [description, setDescription] = useState('');

  // The version it comes to: the draft, the version chosen, or the environment's latest — none yet when kept first.
  const revision: number | undefined =
    environment === 'main' ? undefined : !follows ? chosenRevision : keepsFirst ? undefined : latestKept?.revision;

  // Every version kept, in one list, for the history: whatever environment kept each.
  const {
    data: snapshots = [],
    isLoading: loadingSnapshots,
    mutate: refreshSnapshots
  } = useGraphQL(
    view.name === 'history' ? 'SpaceSnapshots' : null,
    data => data?.SpaceSnapshots,
    // Named as none: the builder fills in its own environment — the draft's — where a query names none.
    { environment: null },
    { revalidateOnMount: true }
  );

  const { changes, loading: comparing } = useVersionChanges(
    served && (served.environment === 'main' || served.revision) ? served : undefined,
    environment === 'main' || keepsFirst ? { environment: 'main' } : revision ? { environment, revision } : undefined
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
    !keepsFirst &&
    !needsDeploy &&
    !accessChanged &&
    target.environment === environment &&
    (environment === 'main' || (follows ? target.revision === null : target.revision === revision));
  const staticRefused = check?.mode === 'static' && check.serverFeatures.length > 0;
  const refusal = !target
    ? undefined
    : !target.verified
      ? `${target.domain} is not connected yet: its DNS record is missing. Add it where the domain was bought — the console's Domains tab says what to add — and publish here once it is checked.`
      : target.locked
        ? `${target.locked.requires} deploys it again — it keeps showing what it shows.`
        : environment === 'main' && holdsACopy
          ? `${target.domain} holds a copy of the site: it shows a version. Versions are included in the ${locked('production')?.requires ?? 'next'} plan.`
          : isPublished(environment) && !follows && chosenRevision === undefined && !loadingEnvironment
            ? 'Choose a version — or Latest, to keep your current changes as the first.'
            : staticRefused
              ? `It runs ${check.serverFeatures.join(', ')} on a server: a prerendered site has none.`
              : alreadyLive
                ? `${target.domain} already shows it.`
                : undefined;
  const scheduleLocked = locked('deployAutomation');
  const canSchedule = environment !== 'main' && !refusal;
  const addUrl = `${typeof window === 'undefined' ? 'https://plitzi.com' : window.location.origin}/spaces/${String(webId)}#domains`;

  const afterWrite = useCallback(async () => {
    await Promise.all([refreshHistory(), refreshTargets(), refreshDeployments()]);
  }, [refreshDeployments, refreshHistory, refreshTargets]);

  /**
   * The latest changes kept as a version, as Snapshot keeps them — refused, as Snapshot is, while the space has errors:
   * their list is shown instead. Its revision, or nothing when it was not kept.
   */
  const keepLatest = useCallback(async (): Promise<number | undefined> => {
    if (!isPublished(environment)) {
      return undefined;
    }

    const issues = await refreshIssues();
    if (issues && issues.errors.length > 0) {
      await showSpaceIssues(issues, PUBLISH_REFUSED);

      return undefined;
    }

    const kept = await mutate(
      'SpacePublish',
      { environment, description: description.trim() || 'Published from the builder' },
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
  }, [description, environment, mutate, refreshIssues, refreshLatest, refreshSnapshots, showSpaceIssues]);

  const handlePublish = useCallback(async () => {
    if (!target || refusal) {
      return;
    }

    setWorking(true);
    setFailure(undefined);
    const version = keepsFirst ? await keepLatest() : revision;
    if (isPublished(environment) && version === undefined) {
      setWorking(false);

      return;
    }

    const shown =
      environment === 'main' || version === undefined
        ? 'every change as you save it'
        : follows
          ? `the latest ${ENVIRONMENT_META[environment].label} version (v${String(version)} now)`
          : `${ENVIRONMENT_META[environment].label} v${String(version)}`;
    if (later && isPublished(environment) && version !== undefined) {
      const at = Math.floor(new Date(later).getTime() / 1000);
      const response = await mutate(
        'SpaceSchedulePublish',
        { domain: target.domain, environment, revision: version, at },
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
        // Named, the domain stays on it; left out, it follows the environment's latest.
        ...(follows || version === undefined ? {} : { revision: version }),
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
    follows,
    holdsACopy,
    keepLatest,
    keepsFirst,
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
    setPickedEnvironment(undefined);
    setPickedFollows(undefined);
    setPickedRevision(undefined);
    setPickedKeep(undefined);
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
  const handleEnvironment = useCallback((value: Environment) => {
    setPickedEnvironment(value);
    setPickedRevision(undefined);
    setFailure(undefined);
  }, []);
  const handleFollows = useCallback((value: boolean) => {
    setPickedFollows(value);
    setFailure(undefined);
  }, []);
  const handlePublishVersion = useCallback((value: PublishedEnvironment, version: number) => {
    setPickedEnvironment(value);
    setPickedFollows(false);
    setPickedRevision(version);
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
        onBack={handleShowPublish}
      />
    );
  }

  const publishing = view.name === 'publish';

  return (
    <SheetFrame
      footer={
        <SheetFooter
          {...(rollback && !rollingBackTo ? { rollbackLabel } : {})}
          rollbackTitle={`What ${target?.domain ?? 'the domain'} showed right before its latest publish`}
          publishing={publishing && target !== undefined}
          schedule={{ lockedBy: scheduleLocked?.requires, shown: canSchedule && !scheduling }}
          action={{
            words: working
              ? keepsFirst
                ? 'Keeping your changes…'
                : 'Publishing…'
              : scheduling
                ? 'Schedule'
                : needsDeploy
                  ? 'Publish and deploy'
                  : 'Publish',
            disabled:
              refusal !== undefined || working || (holdsACopy && checking) || (scheduling && later === undefined)
          }}
          onRollBack={handleAskRollBack}
          onSchedule={handleSchedule}
          onClose={onClose}
          onPublish={handlePublishClick}
        />
      }
    >
      <SheetTabs publishing={publishing} onPublish={handleShowPublish} onHistory={handleShowHistory} />

      <DomainList
        own={
          own && (
            <OwnAddressRow
              target={own}
              access={accessOf(own.domain)}
              passwords={passwords}
              onChanged={handleOwnAccessChanged}
            />
          )
        }
        publishing={publishing}
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
            <ShowWhat
              domain={target.domain}
              environment={environment}
              offersDraft={!holdsACopy}
              byEnvironment={byEnvironment}
              lockedBy={lockedRequires}
              onEnvironment={handleEnvironment}
              version={{
                follows,
                revision: chosenRevision,
                snapshots: environmentSnapshots,
                loading: loadingEnvironment,
                onFollow: handleFollows,
                onPick: setPickedRevision
              }}
              keep={{
                shown: follows,
                changes: sinceKept,
                checked: keepsFirst,
                description,
                onChecked: setPickedKeep,
                onDescription: setDescription
              }}
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
              environment={environment}
              follows={follows}
              revision={revision}
              keepsFirst={keepsFirst}
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
    </SheetFrame>
  );
};

export default PublishSheet;
