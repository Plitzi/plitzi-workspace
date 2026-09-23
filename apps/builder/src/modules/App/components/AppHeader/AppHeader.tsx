import Button from '@plitzi/plitzi-ui/Button';
import { get } from '@plitzi/plitzi-ui/helpers';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { use, useState, useCallback, useMemo, memo } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import useTheme from '@plitzi/sdk-shared/theme/useTheme';
import BuilderSearchButton from '@pmodules/Builder/components/BuilderSearch/components/BuilderSearchButton';
import CollaboratorAvatar from '@pmodules/Collaboration/components/CollaboratorAvatar';
import ExportSpace from '@pmodules/Export';
import { issuesFromError, PUBLISH_REFUSED } from '@pmodules/Space/helpers/spaceIssues';
import useShowSpaceIssues from '@pmodules/Space/hooks/useShowSpaceIssues';
import useSpaceIssues from '@pmodules/Space/hooks/useSpaceIssues';

import BorderButton from './BorderButton';
import DisplayModeButtons from './DisplayModeButtons';
import HistoryButtons from './HistoryButtons';
import IssuesButton from './IssuesButton';
import PageHeader from './PageHeader';
import PreviewModeButtons from './PreviewModeButtons';
import QuotaMeter from './QuotaMeter';
import ZoomButtons from './ZoomButtons';
import { FORM_MODAL, WIDE_MODAL } from '../../helpers/modalSizes';
import DeployForm from '../../models/DeployForm';
import PublishForm from '../../models/PublishForm';

import type { BuilderMutationsMap, BuilderQueriesMap } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';

const AppHeader = () => {
  const { theme, toggleTheme } = useTheme();
  const { showModal } = useModal();
  const { addToast } = useToast();
  const { mutate } = use(NetworkContext) as BuilderNetworkContextValue<BuilderQueriesMap, BuilderMutationsMap>;
  const [loadingDeployment, setLoadingDeployment] = useState(false);
  const [collaborators] = useBuilderStore('collaboration.collaborators');
  const { refresh: refreshIssues } = useSpaceIssues();
  const showSpaceIssues = useShowSpaceIssues();

  const handleClickPublish = useCallback(async () => {
    // Read fresh before asking for a description: the server refuses a space with errors anyway, and finding that out
    // after filling in the form is finding it out one step too late.
    const issues = await refreshIssues();
    if (issues && issues.errors.length > 0) {
      await showSpaceIssues(issues, PUBLISH_REFUSED);

      return;
    }

    const response = await showModal<{ environment: string; description: string }>(
      <Modal.Header>
        <h4>Make Snapshot</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <PublishForm onClose={onClose} onSubmit={onSubmit} />
        </Modal.Body>
      )
    );

    if (!response) {
      return;
    }

    const responseMutation = await mutate('SpacePublish', response, true);
    const refused = issuesFromError(responseMutation.error);
    if (refused) {
      // Saved between the check above and the publish: the server's reading is the one that counts.
      await showSpaceIssues({ errors: refused, warnings: [] }, PUBLISH_REFUSED);
    } else if (responseMutation.result) {
      addToast(
        <div>
          Snapshot <b>{`${responseMutation.result.environment}:${responseMutation.result.revision}`}</b> Created
          Successfully
        </div>,
        { appeareance: 'success', autoDismiss: true, placement: 'top-right' }
      );
    } else if (responseMutation.error) {
      addToast(responseMutation.error instanceof Error ? responseMutation.error.message : responseMutation.error, {
        appeareance: 'error',
        autoDismiss: true,
        placement: 'top-right'
      });
    }
  }, [addToast, mutate, refreshIssues, showModal, showSpaceIssues]);

  const handleClickDeploy = useCallback(async () => {
    const response = await showModal<{
      environment: string;
      domain: string;
      revision?: number;
      cdnIdentifier?: string;
    }>(
      <Modal.Header>
        <h4>Publish Snapshot</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <DeployForm onClose={onClose} onSubmit={onSubmit} />
        </Modal.Body>
      ),
      undefined,
      FORM_MODAL
    );

    if (!response) {
      return;
    }

    setLoadingDeployment(true);
    const responseMutation = await mutate('SpaceDeploy', response, true);
    setLoadingDeployment(false);
    if (responseMutation.result) {
      addToast(
        <div>
          Your snapshot have being published to <b>{responseMutation.result.domain}</b> Successfully
        </div>,
        { appeareance: 'success', autoDismiss: true, placement: 'top-right' }
      );
    } else if (responseMutation.error) {
      addToast(responseMutation.error instanceof Error ? responseMutation.error.message : responseMutation.error, {
        appeareance: 'error',
        autoDismiss: true,
        placement: 'top-right'
      });
    }
  }, [addToast, mutate, showModal]);

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
      className={clsx(
        'py-3border-gray-200 flex h-12 items-center justify-between border-b border-gray-200 bg-white px-4 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200'
      )}
    >
      <div className="flex h-full items-center gap-4">
        <div
          className={clsx(
            'bg-grayviolet-200 flex h-8 w-20 items-center justify-between rounded-lg pr-2 pl-3 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
          )}
          id="plitzi-logo"
        >
          <a href={origin}>
            <img src="https://cdn.plitzi.com/resources/img/favicon.svg" className="h-6 w-6" alt="Plitzi" />
          </a>
          <i className="fa-solid fa-chevron-down" />
        </div>
        <PageHeader />
        <BuilderSearchButton />
        <HistoryButtons />
        <BorderButton />
      </div>
      <div className="flex h-full items-center gap-4">
        <DisplayModeButtons />
        <ZoomButtons />
      </div>
      <div className="flex h-full items-center gap-6">
        <div className="flex items-center gap-1">
          {collaborators.map((collaborator, i) => {
            const {
              color,
              user: { firstName, surName }
            } = collaborator;

            return <CollaboratorAvatar key={i} color={color} firstName={firstName} surName={surName} />;
          })}
        </div>
        <PreviewModeButtons />
        <IssuesButton />
        <QuotaMeter />
        <button
          className={clsx(
            'flex h-7 w-7 cursor-pointer items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
          )}
          title={
            theme === 'dark' ? 'Switch to light mode' : theme === 'light' ? 'Use system theme' : 'Switch to dark mode'
          }
          onClick={toggleTheme}
        >
          <i
            className={clsx(
              'fa-solid text-sm',
              theme === 'dark' ? 'fa-sun' : theme === 'light' ? 'fa-moon' : 'fa-desktop'
            )}
          />
        </button>
        <div className="flex gap-4">
          <Button
            id="header-export"
            size="sm"
            title="Export: a copy of this space as JSON, or as the code that authors it."
            onClick={handleClickExport}
            intent="secondary"
          >
            Export
          </Button>
          <Button
            id="header-publish"
            size="sm"
            title="Publish: Click Publish to go live with your latest changes."
            onClick={handleClickPublish}
            intent="secondary"
          >
            Snapshot
          </Button>
          <Button
            id="header-deploy"
            size="sm"
            title="Deploy: Click Deploy to go with the environment selected."
            onClick={handleClickDeploy}
            disabled={loadingDeployment}
          >
            {!loadingDeployment ? 'Publish' : <Button.Icon icon="fa-solid fa-sync" className="fa-spin fa-2x" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default memo(AppHeader);
