/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback, use, useEffect, useMemo, useState } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { SourceField, InteractionCallbackParamValues, InteractionCallback } from '@plitzi/sdk-shared';
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
        try {
          setInternalMetadata(JSON.parse(metadata) as Record<string, unknown>);
        } catch {
          setInternalMetadata({ content: metadata });
        }
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

  const interactionTriggers = useMemo<Record<string, InteractionCallback>>(
    () => ({
      onModalOpen: {
        action: 'onModalOpen',
        title: 'On Modal Open',
        type: 'trigger',
        params: { metadata: { type: 'text', defaultValue: '' } },
        preview: { metadata: '' }
      },
      onModalClose: { action: 'onModalClose', title: 'On Modal Close', type: 'trigger', preview: {}, params: {} }
    }),
    []
  );

  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(() => {
    return {
      openModal: {
        action: 'openModal',
        title: `Open ${label}`,
        type: 'callback',
        callback: handleOpenModal,
        params: { metadata: { type: 'text', defaultValue: '' } },
        preview: { metadata: '' }
      },
      closeModal: {
        action: 'closeModal',
        title: `Close ${label}`,
        type: 'callback',
        callback: handleClickClose,
        params: {},
        preview: {}
      }
    };
  }, [handleClickClose, handleOpenModal, label]);

  useEffect(() => {
    if (elementState.visibility !== false) {
      void interactionsManager.interactionTrigger(id, 'onModalOpen', { metadata: internalMetadata });
    }
  }, [id, interactionsManager, internalMetadata, elementState.visibility]);

  const sourceFields = useCallback(
    () =>
      getPathsFromObeject(internalMetadata).reduce<SourceField[]>((acum, path) => {
        const name = path.split('.');
        if (name.length > 1) {
          return [...acum, { path, name: name.slice(name.length - 2).join(' ') }];
        }

        return [...acum, { path, name: name[name.length - 1] }];
      }, []),
    [internalMetadata]
  );

  useRegisterSource({
    id,
    source: `modalContainer_${id}`,
    name: label ? label : `Modal - ${id}`,
    fields: sourceFields
  });

  return (
    <RootElement
      ref={ref}
      className={clsx('plitzi-component__modal-container', className)}
      interactionTriggers={interactionTriggers}
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
          <i
            className={clsx('fa-solid fa-xmark', styleSelectors.headerCloseButton)}
            title="Close"
            onClick={handleClickClose}
          />
        </div>
        <div className={clsx('modal-container__body', styleSelectors.bodyContainer)}>
          <StoreProvider
            inherit="live"
            value={{ runtime: { sources: { [`modalContainer_${id}`]: internalMetadata } } }}
          >
            {children}
          </StoreProvider>
        </div>
      </div>
    </RootElement>
  );
};

export default withElement(ModalContainer, { stateful: true });

export { ModalContainer };
