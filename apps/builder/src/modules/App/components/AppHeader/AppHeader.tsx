import Button from '@plitzi/plitzi-ui/Button';
import IconGroup from '@plitzi/plitzi-ui/IconGroup';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import get from 'lodash-es/get';
import { use, useState, useCallback, useMemo } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import BuilderCollaboratorHeaderUser from '@pmodules/Builder/components/BuilderCollaborator/BuilderCollaboratorHeaderUser';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import QueueStatusContext from '@pmodules/Queue/QueueStatusContext';

import BorderButton from './BorderButton';
import DisplayModeButtons from './DisplayModeButtons';
import HistoryButtons from './HistoryButtons';
import PageHeader from './PageHeader';
import ZoomButtons from './ZoomButtons';
import AppContext from '../../AppContext';
import DeployForm from '../../models/DeployForm';
import PublishForm from '../../models/PublishForm';

import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { MutationsMap } from '@pmodules/Network/Mutations';
import type { QueriesMap } from '@pmodules/Network/Queries';

const AppHeader = () => {
  const { showModal } = useModal();
  const { addToast } = useToast();
  const { eventBridge } = use(EventBridgeContext);
  const { mutate } = use(NetworkContext) as BuilderNetworkContextValue<QueriesMap, MutationsMap>;
  const queueProcessing = use(QueueStatusContext);
  const { currentPageId } = use(NavigationContext);
  const { previewMode, setPreviewMode } = use(AppContext);
  const [loadingDeployment, setLoadingDeployment] = useState(false);
  const { subscriptionsCollaborators } = use(BuilderSubscriptionsContext);

  const handleClickPreviewMode = useCallback(() => {
    void eventBridge.emit('builder', 'builderSetBaseContext', currentPageId);
    void eventBridge.emit('builder', 'builderSetSelected', null);
    setPreviewMode(state => !state);
  }, [currentPageId, eventBridge, setPreviewMode]);

  const handleClickPublish = useCallback(async () => {
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

    const responseMutation = await mutate('SpacePublish', response);
    if (responseMutation.result) {
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
  }, [addToast, mutate, showModal]);

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
      )
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

  const origin = useMemo(() => {
    if (typeof window !== 'undefined') {
      return get(window, 'location.origin', 'https://plitzi.com');
    }

    return 'https://plitzi.com';
  }, []);

  return (
    <div className="flex h-12 items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex h-full items-center gap-4">
        <div className="bg-grayviolet-200 flex h-8 w-20 items-center justify-between rounded-lg px-3" id="plitzi-logo">
          <a href={origin}>
            <img src="https://cdn.plitzi.com/resources/img/favicon.svg" className="h-6 w-6" alt="Plitzi" />
          </a>
          <i className="fa-solid fa-chevron-down" />
        </div>
        <PageHeader />
        <HistoryButtons />
        <BorderButton />
      </div>
      <div className="flex h-full items-center gap-4">
        <DisplayModeButtons />
        <ZoomButtons />
      </div>
      <div className="flex h-full items-center gap-6">
        <div className="flex items-center gap-1">
          {subscriptionsCollaborators.map((collaborator, i) => {
            const {
              color,
              user: { firstName, surName }
            } = collaborator;

            return <BuilderCollaboratorHeaderUser key={i} color={color} firstName={firstName} surName={surName} />;
          })}
        </div>
        <IconGroup gap={4}>
          <IconGroup.Icon
            icon={queueProcessing ? 'fas fa-sync fa-spin' : 'fas fa-check'}
            title="Mode: Desktop"
            intent="custom"
            className="text-green-500"
          />
          <IconGroup.Icon
            icon={previewMode ? 'fa-solid fa-pause' : 'fa-solid fa-play'}
            cursor="pointer"
            onClick={handleClickPreviewMode}
          />
        </IconGroup>
        <div className="flex gap-4">
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

export default AppHeader;
