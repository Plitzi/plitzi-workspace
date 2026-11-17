import Button from '@plitzi/plitzi-ui/Button';
import { get } from '@plitzi/plitzi-ui/helpers';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { useCallback, useMemo, memo } from 'react';

import { PLITZI_MARK_DATA_URL } from '@plitzi/sdk-shared/schema';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { useTheme } from '@plitzi/sdk-shared/theme/react';
import BuilderSearchButton from '@pmodules/Builder/components/BuilderSearch/components/BuilderSearchButton';
import { collaboratorTitle } from '@pmodules/Collaboration/CollaborationHelper';
import CollaboratorAvatar from '@pmodules/Collaboration/components/CollaboratorAvatar';
import ExportSpace from '@pmodules/Export';
import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import { issuesFromError, PUBLISH_REFUSED } from '@pmodules/Space/helpers/spaceIssues';
import useShowSpaceIssues from '@pmodules/Space/hooks/useShowSpaceIssues';
import useSpaceEntitlements, { useSpaceAccess } from '@pmodules/Space/hooks/useSpaceEntitlements';
import useSpaceIssues from '@pmodules/Space/hooks/useSpaceIssues';

import DisplayModeButtons from './DisplayModeButtons';
import HeaderMenu from './HeaderMenu';
import HeaderPopover from './HeaderPopover';
import HistoryButtons from './HistoryButtons';
import IssuesButton from './IssuesButton';
import PageHeader from './PageHeader';
import PlanBadge from './PlanBadge';
import PreviewModeButtons from './PreviewModeButtons';
import QuotaMeter from './QuotaMeter';
import DraftPanel from './ReleaseCluster/DraftPanel';
import { draftStatus } from './ReleaseCluster/draftStatus';
import { attentionTone, targetAttention } from './ReleaseCluster/targetAttention';
import useDraftStatus from './ReleaseCluster/useDraftStatus';
import RoleBadge from './RoleBadge';
import RuntimeIdleNotice from './RuntimeIdleNotice';
import ViewButtons from './ViewButtons';
import ZoomButtons from './ZoomButtons';
import { PUBLISHED_ENVIRONMENTS, revisionName } from '../../helpers/environments';
import { FORM_MODAL, SHEET_MODAL, WIDE_MODAL } from '../../helpers/modalSizes';
import useSpaceTargets from '../../hooks/useSpaceTargets';
import PublishSheet from '../../models/PublishSheet';
import SnapshotForm from '../../models/SnapshotForm';

import type { SnapshotFormValues } from '../../models/SnapshotForm';
import type { Environment } from '@plitzi/sdk-shared';

const AppHeader = () => {
  const { theme, setTheme } = useTheme();
  const { showModal } = useModal();
  const { addToast } = useToast();
  const { mutate, webId } = useBuilderNetwork();
  const draft = useDraftStatus();
  const [collaborators] = useBuilderStore('collaboration.collaborators');
  const { refresh: refreshIssues } = useSpaceIssues();
  const showSpaceIssues = useShowSpaceIssues();
  // What the space's plan does not include is shown locked, and leads to the plan that does.
  const { locked } = useSpaceEntitlements();
  // Snapshot and Publish are a publisher's: a role without them is not offered either.
  const { may } = useSpaceAccess();
  const publishes = may('spacePublish');
  const snapshotsLocked = locked('snapshots');
  const openPlans = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);
  // The space's targets: what the header says needs a look, and where the draft is live as it is saved.
  const { targets, refresh: refreshTargets } = useSpaceTargets(publishes);
  const attention = useMemo(() => targetAttention(targets?.targets ?? []), [targets]);
  const tone = attentionTone(attention);
  const draftAddress = targets?.targets.find(target => target.plitziOwned && target.environment === 'main')?.domain;

  /**
   * The publish sheet — on a snapshot just made, on a domain asked for, or on its history. It publishes, deploys and
   * says how it went itself.
   */
  const openPublish = useCallback(
    async (initial?: { environment?: Environment; revision?: number; domain?: string; view?: 'history' }) => {
      await showModal(
        <Modal.Header>
          <h4>Publish</h4>
        </Modal.Header>,
        ({ onClose }) => (
          <Modal.Body size="custom" className="flex min-h-0 flex-col">
            <PublishSheet
              environment={initial?.environment}
              revision={initial?.revision}
              domain={initial?.domain}
              view={initial?.view}
              onClose={onClose}
            />
          </Modal.Body>
        ),
        undefined,
        SHEET_MODAL
      );
      await Promise.all([draft.refresh(), refreshTargets()]);
    },
    [draft, refreshTargets, showModal]
  );

  const handleClickSnapshot = useCallback(async () => {
    if (snapshotsLocked?.upgradeUrl) {
      openPlans(snapshotsLocked.upgradeUrl);

      return;
    }

    // Read fresh before asking for a description: the server refuses a space with errors anyway, and finding that out
    // after filling in the form is finding it out one step too late.
    const issues = await refreshIssues();
    if (issues && issues.errors.length > 0) {
      await showSpaceIssues(issues, PUBLISH_REFUSED);

      return;
    }

    const response = await showModal<SnapshotFormValues>(
      <Modal.Header>
        <h4>Save a version</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <SnapshotForm onClose={onClose} onSubmit={onSubmit} />
        </Modal.Body>
      ),
      undefined,
      FORM_MODAL
    );

    if (!response) {
      return;
    }

    const { thenPublish, ...values } = response;
    const responseMutation = await mutate('SpacePublish', values, true);
    const refused = issuesFromError(responseMutation.error);
    if (refused) {
      // Saved between the check above and the publish: the server's reading is the one that counts.
      await showSpaceIssues({ errors: refused, warnings: [], suggestions: [] }, PUBLISH_REFUSED);
    } else if (responseMutation.result) {
      const { environment, revision } = responseMutation.result;
      await draft.refresh();
      // The environment the snapshot was asked into, as the answer names it.
      const kept = PUBLISHED_ENVIRONMENTS.find(published => published === environment);
      if (thenPublish && kept) {
        await openPublish({ environment: kept, revision });
      } else {
        addToast(
          <div>
            Saved as <b>{kept ? revisionName(kept, revision) : `${environment} version ${String(revision)}`}</b>.
            Publish it when it is ready.
          </div>,
          { appeareance: 'success', autoDismiss: true, placement: 'top-right' }
        );
      }
    } else if (responseMutation.error) {
      addToast(responseMutation.error instanceof Error ? responseMutation.error.message : responseMutation.error, {
        appeareance: 'error',
        autoDismiss: true,
        placement: 'top-right'
      });
    }
  }, [addToast, draft, mutate, openPlans, openPublish, refreshIssues, showModal, showSpaceIssues, snapshotsLocked]);

  // Always the sheet, whatever the plan: it shows the space live at its own address and says which plan includes a
  // domain of its own — sent to the plans instead, somebody whose site was already live was told it was not theirs to
  // publish. It opens on the latest changes; a version kept before is one choice away.
  const handleClickPublish = useCallback(
    async (domain?: string) => {
      await openPublish({ domain });
    },
    [openPublish]
  );
  const status = draftStatus(draft.newest, draft.changes);

  const handleClickExport = useCallback(async () => {
    await showModal(
      <Modal.Header>
        <h4>Export space</h4>
      </Modal.Header>,
      <Modal.Body>
        <ExportSpace />
      </Modal.Body>,
      undefined,
      WIDE_MODAL
    );
  }, [showModal]);

  const origin = useMemo(() => {
    if (typeof window !== 'undefined') {
      return get(window, 'location.origin', 'https://plitzi.com');
    }

    return 'https://plitzi.com';
  }, []);

  return (
    <div
      id="builder-header"
      className={clsx(
        'border-ui-line-strong bg-ui-panel text-ui-fg flex h-12 items-center justify-between gap-3 border-b px-4'
      )}
    >
      {/*
        The bar needed 1,564 px, and Snapshot and Publish went past the window from 1440 down. They never leave now: the
        actions do not shrink, and where the window is still too narrow it is the left side — the page, the search, the
        history, the views — that gives way, scrolling inside itself. Nothing is taken out of the bar.
      */}
      <div className="flex h-full min-w-0 shrink [scrollbar-width:none] items-center gap-3 overflow-x-auto overflow-y-hidden">
        {/* The logo is the builder's menu: the way back to the spaces, the export, the theme. */}
        <HeaderMenu
          id="plitzi-logo"
          label="Plitzi menu"
          triggerClassName="bg-ui-raised text-ui-fg hover:bg-ui-hover flex h-8 w-20 shrink-0 cursor-pointer items-center justify-between rounded-lg pr-2 pl-3 transition-colors"
          trigger={
            <>
              <img src={PLITZI_MARK_DATA_URL} className="h-6 w-6" alt="" />
              <i className="fa-solid fa-chevron-down text-xs" />
            </>
          }
          sections={[
            {
              items: [
                {
                  id: 'header-back',
                  label: 'Back to your spaces',
                  icon: 'fa-solid fa-arrow-left',
                  onSelect: () => window.location.assign(`${origin}/spaces`)
                },
                {
                  id: 'header-export',
                  label: 'Export',
                  icon: 'fa-solid fa-download',
                  onSelect: () => void handleClickExport()
                }
              ]
            },
            {
              label: 'Theme',
              items: (
                [
                  ['light', 'Light', 'fa-solid fa-sun'],
                  ['dark', 'Dark', 'fa-solid fa-moon'],
                  ['system', 'System', 'fa-solid fa-desktop']
                ] as const
              ).map(([mode, label, icon]) => ({
                id: `header-theme-${mode}`,
                label,
                icon,
                checked: theme === mode,
                onSelect: () => setTheme(mode)
              }))
            }
          ]}
        />
        <PageHeader />
        <BuilderSearchButton />
        <HistoryButtons />
        <ViewButtons />
      </div>
      <div className="flex h-full shrink-0 items-center gap-2 2xl:gap-4">
        <DisplayModeButtons />
        <ZoomButtons />
      </div>
      <div className="flex h-full shrink-0 items-center gap-2 2xl:gap-3">
        <div className="flex items-center gap-1">
          {collaborators.map(collaborator => {
            const {
              color,
              instanceId,
              agent,
              user: { firstName, surName }
            } = collaborator;

            return (
              <CollaboratorAvatar
                key={instanceId}
                color={color}
                firstName={firstName}
                surName={surName}
                agent={agent !== undefined}
                title={collaboratorTitle(collaborator)}
              />
            );
          })}
        </div>
        <PreviewModeButtons />
        {may('spaceCode') && <RuntimeIdleNotice />}
        <IssuesButton />
        {/* The account, as one group: the space's quota, its plan and the person's role on it. */}
        {/* 3 px all round, and each part's corners the group's less that: a part hovered sits evenly inside it. */}
        <div className="border-ui-line flex h-8 items-stretch gap-1 rounded-lg border p-[3px] pr-1">
          <QuotaMeter />
          <PlanBadge />
          <RoleBadge />
        </div>
        {/*
          The release cluster (RFC 0034 §11.1): the draft — what it is against the last snapshot, opened as a panel of its
          own with Snapshot as its next step — then Publish, the header's one primary, whose menu holds the rollbacks and
          the history; its dot says when a target asks for a look.
        */}
        {publishes && (
          <div className="border-ui-line flex items-center gap-2 border-l pl-3">
            {/*
              The draft and its next step, one control: its status opens what changed, Snapshot keeps it — as Publish
              is one control with its menu.
            */}
            <div className="border-ui-line-strong flex h-8 items-stretch rounded-lg border">
              <HeaderPopover
                id="header-draft-status"
                label="Draft"
                title={`${status.words} — what changed, and where it is live`}
                align="end"
                triggerClassName={clsx(
                  'text-ui-fg-subtle hover:bg-ui-hover hover:text-ui-fg flex h-full shrink-0 cursor-pointer items-center gap-1.5 rounded-l-[7px] px-2.5 text-xs whitespace-nowrap transition-colors outline-none',
                  'focus-visible:ring-primary-500 focus-visible:ring-2 aria-expanded:bg-ui-hover aria-expanded:text-ui-fg'
                )}
                trigger={
                  <>
                    <span
                      className={clsx(
                        'h-1.5 w-1.5 rounded-full',
                        draft.loading ? 'bg-ui-line-strong' : status.pending ? 'bg-amber-500' : 'bg-emerald-500'
                      )}
                    />
                    <span className="hidden 2xl:inline">{status.words}</span>
                    <span className="2xl:hidden">{status.short}</span>
                    <i className="fa-solid fa-chevron-down text-[9px] opacity-60" />
                  </>
                }
              >
                {close => (
                  <DraftPanel
                    newest={draft.newest}
                    changes={draft.changes}
                    loading={draft.loading}
                    draftAddress={draftAddress}
                    attention={attention}
                    snapshotLocked={snapshotsLocked !== undefined}
                    onSnapshot={() => {
                      close();
                      void handleClickSnapshot();
                    }}
                    onPublish={domain => {
                      close();
                      void handleClickPublish(domain);
                    }}
                  />
                )}
              </HeaderPopover>
              <button
                id="header-snapshot"
                type="button"
                title={
                  snapshotsLocked
                    ? `${snapshotsLocked.label} are included in the ${snapshotsLocked.requires ?? ''} plan — opens the plans.`
                    : 'Save version: keep what is in the editor as a version you can publish, compare or go back to.'
                }
                className="border-ui-line-strong text-ui-fg hover:bg-ui-hover focus-visible:ring-primary-500 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-r-[7px] border-l px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2"
                onClick={() => void handleClickSnapshot()}
              >
                {snapshotsLocked && <i className="fa-solid fa-lock text-xs" />}
                Save version
              </button>
            </div>
            <div className="flex items-stretch">
              <Button
                id="header-publish"
                size="sm"
                className="rounded-r-none"
                title="Publish: where your site is live, and what each of your domains shows."
                onClick={() => void handleClickPublish()}
              >
                Publish
              </Button>
              <HeaderMenu
                id="header-publish-more"
                label={tone ? `More publishing — ${attention.at(0)?.domain ?? ''} asks for a look` : 'More publishing'}
                align="end"
                triggerClassName="bg-primary-500 hover:bg-primary-600 dark:bg-primary-400 dark:hover:bg-primary-500 focus-visible:ring-primary-500 relative flex h-full cursor-pointer items-center rounded-r-md border-l border-white/25 px-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                trigger={
                  <>
                    <i className="fa-solid fa-chevron-down text-[10px]" />
                    {tone && (
                      <span
                        className={clsx(
                          'ring-ui-panel absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ring-2',
                          tone === 'danger'
                            ? 'bg-red-500'
                            : tone === 'progress'
                              ? 'animate-pulse bg-sky-400'
                              : 'bg-amber-500'
                        )}
                      />
                    )}
                  </>
                }
                sections={[
                  ...(targets && targets.targets.some(target => target.rollback)
                    ? [
                        {
                          label: 'Roll back',
                          items: targets.targets.flatMap(target =>
                            target.rollback
                              ? [
                                  {
                                    id: `header-rollback-${String(target.id)}`,
                                    label: target.domain,
                                    detail: `To ${target.rollback.environment === 'main' ? 'the draft' : `${target.rollback.environment} r${String(target.rollback.revision)}`}, what it served before`,
                                    icon: 'fa-solid fa-rotate-left',
                                    onSelect: () => void openPublish({ domain: target.domain, view: 'history' })
                                  }
                                ]
                              : []
                          )
                        }
                      ]
                    : []),
                  {
                    items: [
                      {
                        id: 'header-release-history',
                        label: 'Release history',
                        detail: 'Every publish and rollback, per domain',
                        icon: 'fa-solid fa-clock-rotate-left',
                        onSelect: () => void openPublish({ view: 'history' })
                      },
                      {
                        id: 'header-targets',
                        label: 'Domains and targets',
                        detail: 'Add a domain, verify it, say where it is deployed',
                        icon: 'fa-solid fa-globe',
                        onSelect: () =>
                          window.open(`${origin}/spaces/${String(webId)}#domains`, '_blank', 'noopener,noreferrer')
                      }
                    ]
                  }
                ]}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(AppHeader);
