// Packages
import React, { use, useState, useCallback, useMemo } from 'react';
import noop from 'lodash/noop';
import get from 'lodash/get';
import Button from '@plitzi/plitzi-ui/Button';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';
import IconGroup from '@plitzi/plitzi-ui/IconGroup';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeModuleTypes, EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import BuilderCollaboratorHeaderUser from '@pmodules/Builder/components/BuilderCollaborator/BuilderCollaboratorHeaderUser';
import QueueStatusContext from '@pmodules/Queue/QueueStatusContext';

// Relatives
import AppContext from '../../AppContext';
import DeployForm from '../../models/DeployForm';
import PublishForm from '../../models/PublishForm';
import HistoryButtons from './HistoryButtons';
import BorderButton from './BorderButton';
import PageHeader from './PageHeader';
import ZoomButtons from './ZoomButtons';
import DisplayModeButtons from './DisplayModeButtons';

/**
 * @param {{
 *   setTabSelected?: (tab: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const AppHeaher = props => {
  const { setTabSelected = noop } = props;
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
    eventBridge.emit(EventBridgeModuleTypes.BUILDER, EventBridgeTypes.BUILDER_SET_BASE_CONTEXT, currentPageId);
    eventBridge.emit(EventBridgeModuleTypes.BUILDER, EventBridgeTypes.BUILDER_SET_SELECTED, null);
    setPreviewMode(state => !state);
  }, [currentPageId, eventBridge]);

  const handleClickPublish = useCallback(async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Make Snapshot</h4>
      </Modal.Header>,
      <Modal.Body>
        <PublishForm />
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: false }
    );
    if (response.result) {
      const result = await mutate('SpacePublish', response.data);
      addToast(
        <div>
          Snapshot <b>{`${result.environment}:${result.revision}`}</b> Created Successfully
        </div>,
        {
          appeareance: 'success',
          autoDismiss: true,
          placement: 'top-right'
        }
      );
    }
  }, [addToast, mutate, showModal]);

  const handleClickDeploy = useCallback(async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Publish Snapshot</h4>
      </Modal.Header>,
      <Modal.Body>
        <DeployForm />
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: false }
    );
    if (response.result) {
      setLoadingDeployment(true);
      const result = await mutate('SpaceDeploy', response.data, true);
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
          appeareance: 'danger',
          autoDismiss: true,
          placement: 'top-right'
        });
      }
    }
  }, [addToast, mutate, showModal]);

  const origin = useMemo(() => {
    if (typeof window !== 'undefined') {
      return get(window, 'location.origin', 'https://plitzi.com');
    }

    return 'https://plitzi.com';
  }, []);

  return (
    <div className="h-14 px-4 py-3 flex items-center bg-white justify-between border-b border-gray-200">
      <div className="flex h-full items-center">
        <div
          className="flex items-center justify-between w-20 px-3 h-8 bg-grayviolet-200 rounded-lg mr-6"
          id="plitzi-logo"
        >
          <a href={origin}>
            <img src="https://cdn.plitzi.com/resources/img/favicon.svg" className="w-6 h-6" alt="Plitzi" />
          </a>
          <i className="fa-solid fa-chevron-down" />
        </div>
        <PageHeader className="mr-9" setTabSelected={setTabSelected} />
        <HistoryButtons className="mr-4" />
        <BorderButton />
      </div>
      <div className="flex h-full items-center gap-4">
        <DisplayModeButtons />
        <ZoomButtons />
      </div>
      <div className="flex h-full items-center gap-6">
        <div className="flex items-center gap-1">
          {subscriptionsCollaborators &&
            subscriptionsCollaborators.map((collaborator, i) => {
              const {
                color,
                user: { firstName, surName }
              } = collaborator;

              return <BuilderCollaboratorHeaderUser key={i} color={color} firstName={firstName} surName={surName} />;
            })}
        </div>
        <IconGroup size="xl" gap={4}>
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
        <div className='flex gap-4'>
          <Button
            id="header-publish"
            size="sm"
            title="Publish: Click Publish to go live with your latest changes."
            onClick={handleClickPublish}
            intent="secondary"
            content="Snapshot"
          />
          <Button
            id="header-deploy"
            size="sm"
            title="Deploy: Click Deploy to go with the environment selected."
            onClick={handleClickDeploy}
            disabled={loadingDeployment}
            content={!loadingDeployment ? 'Publish' : <i className="fa-solid fa-sync fa-spin fa-2x" />}
          />
        </div>
      </div>
    </div>
  );
};

export default AppHeaher;
