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
import HistoryButtons from './HistoryButtons';
import IssuesButton from './IssuesButton';
import PageHeader from './PageHeader';
import PlanBadge from './PlanBadge';
import PreviewModeButtons from './PreviewModeButtons';
import QuotaMeter from './QuotaMeter';
import DraftStatusChip from './ReleaseCluster/DraftStatusChip';
import useDraftStatus from './ReleaseCluster/useDraftStatus';
import RoleBadge from './RoleBadge';
import RuntimeIdleNotice from './RuntimeIdleNotice';
import ViewButtons from './ViewButtons';
import ZoomButtons from './ZoomButtons';
import { PUBLISHED_ENVIRONMENTS } from '../../helpers/environments';
import { FORM_MODAL, SHEET_MODAL, WIDE_MODAL } from '../../helpers/modalSizes';
import PublishSheet from '../../models/PublishSheet';
import SnapshotForm from '../../models/SnapshotForm';

import type { SnapshotFormValues } from '../../models/SnapshotForm';
import type { Environment } from '@plitzi/sdk-shared';

const AppHeader = () => {
  const { theme, setTheme } = useTheme();
  const { showModal } = useModal();
  const { addToast } = useToast();
  const { mutate } = useBuilderNetwork();
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
  const domainLocked = locked('customDomain');
  const openPlans = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  /** The publish sheet, on a snapshot just made when there is one. It publishes and says how it went itself. */
  const openPublish = useCallback(
    async (initial?: { environment: Environment; revision: number }) => {
      await showModal(
        <Modal.Header>
          <h4>Publish</h4>
        </Modal.Header>,
        ({ onClose }) => (
          <Modal.Body>
            <PublishSheet environment={initial?.environment} revision={initial?.revision} onClose={onClose} />
          </Modal.Body>
        ),
        undefined,
        SHEET_MODAL
      );
      await draft.refresh();
    },
    [draft, showModal]
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
        <h4>Make a snapshot</h4>
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
            Kept as <b>{`${environment} r${String(revision)}`}</b>. Publish it when it is ready.
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

  const handleClickPublish = useCallback(async () => {
    if (domainLocked?.upgradeUrl) {
      openPlans(domainLocked.upgradeUrl);

      return;
    }

    // What a publisher usually means by pressing it: the last snapshot made, on a domain — preselected, never forced.
    const { newest } = draft;
    await openPublish(newest ? { environment: newest.environment, revision: newest.revision } : undefined);
  }, [domainLocked, draft, openPlans, openPublish]);

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
        <div className="border-ui-line flex h-8 items-center gap-1 rounded-lg border px-1">
          <QuotaMeter />
          <PlanBadge />
          <RoleBadge />
        </div>
        {/*
          The release cluster: what the draft is against the last snapshot, Snapshot, and Publish — the header's one
          primary. What is used less steps back into the logo's menu.
        */}
        <div className="flex items-center gap-2">
          {publishes && (
            <DraftStatusChip
              newest={draft.newest}
              changes={draft.changes}
              loading={draft.loading}
              onClick={() => void handleClickPublish()}
            />
          )}
          {publishes && (
            <Button
              id="header-snapshot"
              size="sm"
              title={
                snapshotsLocked
                  ? `${snapshotsLocked.label} are included in the ${snapshotsLocked.requires ?? ''} plan — opens the plans.`
                  : 'Snapshot: keep the draft as a revision you can publish, compare or roll back to.'
              }
              onClick={() => void handleClickSnapshot()}
              intent="secondary"
            >
              {snapshotsLocked && <Button.Icon icon="fa-solid fa-lock" />}
              Snapshot
            </Button>
          )}
          {publishes && (
            <Button
              id="header-publish"
              size="sm"
              title={
                domainLocked
                  ? `${domainLocked.label} is included in the ${domainLocked.requires ?? ''} plan — opens the plans.`
                  : 'Publish: choose which revision a domain serves.'
              }
              onClick={() => void handleClickPublish()}
            >
              {domainLocked && <Button.Icon icon="fa-solid fa-lock" />}
              Publish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(AppHeader);
