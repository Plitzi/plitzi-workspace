/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback, use, useEffect, useMemo, useState } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import getSourceName from '@plitzi/sdk-shared/dataSource/helpers/getSourceName';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import declaration from './declaration';
import { metadataFromText } from './metadataFromText';
import pathFields from '../../../dataSource/pathFields';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallbackParamValues, InteractionCallback } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type ModalContainerProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
  title?: string;
  autoHideAfterClick?: boolean;
};

const ModalContainer = ({
  ref,
  className = '',
  children,
  title = 'Modal Header',
  autoHideAfterClick = true
}: ModalContainerProps) => {
  const {
    id,
    definition: { styleSelectors, label = 'Modal' },
    elementState,
    setElementState
  } = useElement();
  const sourceName = getSourceName(declaration.sourceType, id);
  const {
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
  const [internalMetadata, setInternalMetadata] = useState<Record<string, unknown>>({});

  const handleOpenModal = useCallback(
    (params: InteractionCallbackParamValues<{ metadata?: Record<string, unknown> }>) => {
      const { metadata } = params;
      if (metadata && typeof metadata === 'object') {
        setInternalMetadata(metadata);
      } else if (typeof metadata === 'string') {
        setInternalMetadata(metadataFromText(metadata));
      } else if (typeof metadata === 'boolean' || typeof metadata === 'number') {
        setInternalMetadata({ content: metadata });
      } else {
        setInternalMetadata({});
      }

      setElementState(state => ({ ...state, visibility: true }));
    },
    [setElementState, setInternalMetadata]
  );

  const handleClickClose = useCallback(() => {
    void interactionsManager.interactionTrigger(id, 'onModalClose', { metadata: internalMetadata });
    setInternalMetadata({});
    setElementState(state => ({ ...state, visibility: false }));
  }, [interactionsManager, setElementState, setInternalMetadata, internalMetadata, id]);

  const handleClickBackground = useCallback(() => {
    if (!autoHideAfterClick) {
      return;
    }

    void interactionsManager.interactionTrigger(id, 'onModalClose', { metadata: internalMetadata });
    setInternalMetadata({});
    setElementState(state => ({ ...state, visibility: false }));
  }, [interactionsManager, autoHideAfterClick, setElementState, setInternalMetadata, internalMetadata, id]);

  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(() => {
    return {
      openModal: { ...declaration.callbacks.openModal, title: `Open ${label}`, callback: handleOpenModal },
      closeModal: { ...declaration.callbacks.closeModal, title: `Close ${label}`, callback: handleClickClose }
    };
  }, [handleClickClose, handleOpenModal, label]);

  useEffect(() => {
    if (elementState.visibility !== false) {
      void interactionsManager.interactionTrigger(id, 'onModalOpen', { metadata: internalMetadata });
    }
  }, [id, interactionsManager, internalMetadata, elementState.visibility]);

  const sourceFields = useCallback(() => pathFields(internalMetadata), [internalMetadata]);

  useRegisterSource({ id, source: sourceName, name: label ? label : `Modal - ${id}`, fields: sourceFields });

  const storeContextValue = useMemo(
    () => (sourceName ? { runtime: { sources: { [sourceName]: internalMetadata } } } : emptyObject),
    [sourceName, internalMetadata]
  );

  return (
    <RootElement
      ref={ref}
      className={clsx('plitzi-component__modal-container', className)}
      interactionTriggers={declaration.triggers}
      interactionCallbacks={interactionCallbacks}
    >
      <div
        className={clsx('modal-container__background', styleSelectors.backgroundContainer)}
        onClick={handleClickBackground}
      />
      <div className={clsx('modal-container__root', styleSelectors.rootContainer)}>
        <div className={clsx('modal-container__header', styleSelectors.headerContainer)}>
          <div className={clsx('modal-container__header__title', styleSelectors.headerTitle)}>
            {title ? title : 'Modal Header'}
          </div>
          <button
            type="button"
            className={clsx('modal-container__close', styleSelectors.headerCloseButton)}
            aria-label="Close"
            title="Close"
            onClick={handleClickClose}
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div className={clsx('modal-container__body', styleSelectors.bodyContainer)}>
          <StoreProvider inherit="live" name={`Modal:${id}`} value={storeContextValue}>
            {children}
          </StoreProvider>
        </div>
      </div>
    </RootElement>
  );
};

export default withElement(ModalContainer);

export { ModalContainer };
