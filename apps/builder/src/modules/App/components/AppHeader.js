// Packages
import React, { useContext, useState, useCallback } from 'react';
import classNames from 'classnames';
import get from 'lodash/get';
import Button from '@plitzi/plitzi-ui-components/Button';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeModuleTypes, EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import BuilderCollaboratorHeaderUser from '@pmodules/Builder/components/BuilderCollaborator/BuilderCollaboratorHeaderUser';
import NavigationContext from '@pmodules/Navigation/NavigationContext';
import QueueStatusContext from '@pmodules/Queue/QueueStatusContext';
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

// Relatives
import AppContext from '../AppContext';
import DeployForm from '../models/DeployForm';
import PublishForm from '../models/PublishForm';

const AppHeaher = () => {
  const { showModal } = useModal();
  const { addToast } = useToast();
  const { eventBridge } = useContext(EventBridgeContext);
  const { mutate } = useContext(NetworkContext);
  const queueProcessing = useContext(QueueStatusContext);
  const { currentPageId } = useContext(NavigationContext);
  const { previewMode, setPreviewMode } = useContext(AppContext);
  const [loadingDeployment, setLoadingDeployment] = useState(false);
  const { subscriptionsCollaborators } = useContext(BuilderSubscriptionsContext);
  const { pageDefinitions } = useContext(SchemaMainContext);
  const pageLabel = get(pageDefinitions, `${currentPageId}.attributes.name`);
  const { canRedo, canUndo, undoableRedo, undoableUndo } = useContext(UndoableContext);

  const handleClickPreviewMode = useCallback(() => {
    eventBridge.emit(EventBridgeModuleTypes.BUILDER, EventBridgeTypes.BUILDER_SET_BASE_CONTEXT, currentPageId);
    eventBridge.emit(EventBridgeModuleTypes.BUILDER, EventBridgeTypes.BUILDER_SET_SELECTED, null);
    setPreviewMode(state => !state);
  }, [currentPageId, eventBridge]);

  const handleClickUndo = useCallback(() => {
    eventBridge.emit(EventBridgeModuleTypes.BUILDER, EventBridgeTypes.BUILDER_SET_SELECTED, null);
    undoableUndo();
  }, [undoableUndo, eventBridge]);

  const handleClickRedo = useCallback(() => {
    eventBridge.emit(EventBridgeModuleTypes.BUILDER, EventBridgeTypes.BUILDER_SET_SELECTED, null);
    undoableRedo();
  }, [undoableRedo, eventBridge]);

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

  return (
    <div className="h-12 flex items-center bg-white justify-between border-b border-gray-300">
      <div className="flex h-full items-center">
        <div className="flex items-center justify-center w-14 h-12" id="plitzi-logo" />
        <div className="h-full px-3 flex items-center cursor-pointer select-none border-r border-gray-300">
          <div className="font-bold">Page:</div>
          <div className="ml-1 text-blue-400">{pageLabel}</div>
        </div>
        <div className="flex">
          <Button
            intent="custom"
            className={classNames('hover:bg-gray-200 h-8 w-8 ml-2 rounded', {
              'text-gray-400 cursor-not-allowed': !canUndo
            })}
            onClick={handleClickUndo}
            title="Undo"
          >
            <i className="fa-solid fa-rotate-left" />
          </Button>
          <Button
            intent="custom"
            className={classNames('hover:bg-gray-200 h-8 w-8 ml-1 rounded', {
              'text-gray-400 cursor-not-allowed': !canRedo
            })}
            onClick={handleClickRedo}
            title="Redo"
          >
            <i className="fa-solid fa-rotate-right" />
          </Button>
          <Button
            intent="custom"
            className={classNames('hover:bg-gray-200 h-8 w-8 ml-1 rounded', {
              'text-gray-400 cursor-not-allowed': true
            })}
            // onClick={handleClickRedo}
            disabled
            title="History"
          >
            <i className="fa-solid fa-clock-rotate-left" />
          </Button>
        </div>
      </div>
      <div className="flex h-full items-center" />
      <div className="flex h-full items-center">
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
        <div className="h-full px-3 flex items-center text-blue-400 select-none">
          {!queueProcessing && (
            <>
              <i className="fas fa-check-circle mr-1" />
              <div className="font-bold">Saved</div>
            </>
          )}
          {queueProcessing && <i className="fas fa-sync fa-spin mr-1 fa-2x" />}
        </div>
        <Button
          id="header-preview"
          intent="custom"
          size="custom"
          title="Preview: See what your site looks like on desktop and mobile before go live."
          className={classNames('h-full text-sm px-2 border-l border-gray-300', {
            'hover:text-blue-400 hover:bg-blue-100': !previewMode,
            'text-blue-400 bg-blue-100 hover:text-gray-700 hover:bg-white': previewMode
          })}
          onClick={handleClickPreviewMode}
        >
          {previewMode && <i className="fa-solid fa-eye mr-2" />}
          {!previewMode && <i className="fa-solid fa-eye-slash mr-2" />}
          Preview
        </Button>
        <Button
          id="header-publish"
          size="custom"
          title="Publish: Click Publish to go live with your latest changes."
          className="h-full text-sm px-2 min-w-[100px]"
          onClick={handleClickPublish}
        >
          Snapshot
        </Button>
        <Button
          id="header-deploy"
          size="custom"
          title="Deploy: Click Deploy to go with the environment selected."
          className="h-full text-sm px-2 border-l border-blue-500 min-w-[100px]"
          onClick={handleClickDeploy}
          disabled={loadingDeployment}
        >
          {!loadingDeployment && 'Publish'}
          {loadingDeployment && <i className="fa-solid fa-sync fa-spin fa-2x" />}
        </Button>
      </div>
    </div>
  );
};

AppHeaher.propTypes = {};

export default AppHeaher;
