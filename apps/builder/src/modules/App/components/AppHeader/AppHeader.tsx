import Button from '@plitzi/plitzi-ui/Button';
import IconGroup from '@plitzi/plitzi-ui/IconGroup';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import get from 'lodash/get';
import { use, useState, useCallback, useMemo } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import BuilderCollaboratorHeaderUser from '@pmodules/Builder/components/BuilderCollaborator/BuilderCollaboratorHeaderUser';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import NetworkContext from '@pmodules/Network/NetworkContext';
import QueueStatusContext from '@pmodules/Queue/QueueStatusContext';

import BorderButton from './BorderButton';
import DisplayModeButtons from './DisplayModeButtons';
import HistoryButtons from './HistoryButtons';
import PageHeader from './PageHeader';
import ZoomButtons from './ZoomButtons';
import AppContext from '../../AppContext';
import DeployForm from '../../models/DeployForm';
import PublishForm from '../../models/PublishForm';

import type { Dispatch, SetStateAction } from 'react';

export type AppHeaderProps = {
  setTabSelected?: Dispatch<SetStateAction<string>>;
};

const AppHeader = ({ setTabSelected }: AppHeaderProps) => {
  const { showModal } = useModal();
  const { addToast } = useToast();
  const { eventBridge } = use(EventBridgeContext);
  const { mutate } = use(NetworkContext);
  const queueProcessing = use(QueueStatusContext);
  const { currentPageId } = use(NavigationContext);
  const { previewMode, setPreviewMode } = use(AppContext);
  const [loadingDeployment, setLoadingDeployment] = useState(false);
  const { subscriptionsCollaborators } = use(BuilderSubscriptionsContext);

  const handleClickPreviewMode = useCallback(() => {
    void eventBridge.emit('builder', EventBridgeTypes.BUILDER_SET_BASE_CONTEXT, currentPageId);
    void eventBridge.emit('builder', EventBridgeTypes.BUILDER_SET_SELECTED, null);
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

    const result = await mutate<{ revision: number; environment: string } | undefined>('SpacePublish', response);
    if (result && !(result instanceof Error)) {
      addToast(
        <div>
          Snapshot <b>{`${result.environment}:${result.revision}`}</b> Created Successfully
        </div>,
        { appeareance: 'success', autoDismiss: true, placement: 'top-right' }
      );
    } else if (result instanceof Error) {
      addToast(result.message, {
        appeareance: 'error',
        autoDismiss: true,
        placement: 'top-right'
      });
    }
  }, [addToast, mutate, showModal]);

  const handleClickDeploy = useCallback(async () => {
    const response = await showModal<{ environment: string; domain: string; revision?: number }>(
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
    const result = await mutate<{ domain: string } | undefined>('SpaceDeploy', response, true);
    setLoadingDeployment(false);
    if (result && !(result instanceof Error)) {
      addToast(
        <div>
          Your snapshot have being published to <b>{result.domain}</b> Successfully
        </div>,
        {
          appeareance: 'success',
          autoDismiss: true,
          placement: 'top-right'
        }
      );
    } else if (result instanceof Error) {
      addToast(result.message, {
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
    <div className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex h-full items-center gap-4">
        <div className="bg-grayviolet-200 flex h-8 w-20 items-center justify-between rounded-lg px-3" id="plitzi-logo">
          <a href={origin}>
            <img src="https://cdn.plitzi.com/resources/img/favicon.svg" className="h-6 w-6" alt="Plitzi" />
          </a>
          <i className="fa-solid fa-chevron-down" />
        </div>
        <PageHeader setTabSelected={setTabSelected} />
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
