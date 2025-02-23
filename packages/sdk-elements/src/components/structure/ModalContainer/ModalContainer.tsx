/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import get from 'lodash/get';
import { useCallback, use, useEffect, useMemo, useState } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject, getPathsFromObeject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { DataSourceContextValue } from '@plitzi/sdk-data-source';
import type { InternalProps } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

type InternalPropsSubProps = {
  setElementState: unknown;
  styleSelectors: Record<string, string>;
};

export type ModalContainerProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  internalProps?: InternalProps<InternalPropsSubProps>;
  children?: ReactNode;
  title?: string;
  autoHideAfterClick?: boolean;
};

const ModalContainer = ({
  ref,
  className = '',
  internalProps = emptyObject as InternalProps<InternalPropsSubProps>,
  children,
  title = 'Modal Header',
  autoHideAfterClick = true
}: ModalContainerProps) => {
  const { id, setElementState, styleSelectors } = internalProps;
  const {
    contexts: { InteractionsContext, DataSourceContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use(InteractionsContext);
  const { useDataSource } = use(DataSourceContext) as DataSourceContextValue;
  const [internalMetadata, setInternalMetadata] = useState({});

  const handleOpenModal = useCallback(
    params => {
      const { metadata } = params;
      if (metadata && typeof metadata === 'object') {
        setInternalMetadata(metadata);
      } else if (typeof metadata === 'string') {
        try {
          setInternalMetadata(JSON.parse(metadata));
        } catch {
          setInternalMetadata({ content: metadata });
        }
      } else if (typeof metadata === 'boolean' || typeof metadata === 'number') {
        setInternalMetadata({ content: metadata });
      } else {
        setInternalMetadata({});
      }

      setElementState({ key: 'visibility', value: true });
    },
    [setElementState, setInternalMetadata]
  );

  const handleClickClose = useCallback(() => {
    interactionsManager.interactionTrigger(id, 'onModalClose', { metadata: internalMetadata });
    setInternalMetadata({});
    setElementState({ key: 'visibility', value: false });
  }, [interactionsManager, setElementState, setInternalMetadata, internalMetadata, id]);

  const handleClickBackground = useCallback(() => {
    if (!autoHideAfterClick) {
      return;
    }

    interactionsManager.interactionTrigger(id, 'onModalClose', { metadata: internalMetadata });
    setInternalMetadata({});
    setElementState({ key: 'visibility', value: false });
  }, [interactionsManager, autoHideAfterClick, setElementState, setInternalMetadata, internalMetadata, id]);

  const interactionTriggers = useMemo(
    () => ({
      onModalOpen: { title: 'On Modal Open', preview: { metadata: '' }, params: { metadata: '' } },
      onModalClose: { title: 'On Modal Close', preview: {}, params: {} }
    }),
    []
  );

  const interactionCallbacks = useMemo(() => {
    const label = get(internalProps, 'definition.label', 'Modal') as string;

    return {
      openModal: {
        title: `Open ${label}`,
        callback: handleOpenModal,
        params: { metadata: '' },
        preview: { metadata: '' }
      },
      closeModal: { title: `Close ${label}`, callback: handleClickClose, params: {}, preview: {} }
    };
  }, [handleClickClose, handleOpenModal, internalProps]);

  useEffect(() => {
    if (internalProps.elementState?.visibility !== false) {
      interactionsManager.interactionTrigger(id, 'onModalOpen', { metadata: internalMetadata });
    }
  }, [id, interactionsManager, internalMetadata, internalProps.elementState?.visibility]);

  const sourceFields = useCallback(() => {
    if (!internalMetadata || typeof internalMetadata !== 'object') {
      return [];
    }

    return getPathsFromObeject(internalMetadata).reduce((acum, path) => {
      const name = path.split('.');
      if (name.length > 1) {
        return [...acum, { path, name: name.slice(name.length - 2).join(' ') }];
      }

      return [...acum, { path, name: name[name.length - 1] }];
    }, []);
  }, [internalMetadata]);

  const sourceName = useMemo(() => get(internalProps, 'definition.label', `Modal - ${id}`), [id, internalProps]);

  const [ModalContext] = useDataSource({
    id,
    source: `modalContainer_${id}`,
    mode: 'write',
    name: sourceName,
    fields: sourceFields
  });

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__modal-container', className)}
      interactionTriggers={interactionTriggers}
      interactionCallbacks={interactionCallbacks}
    >
      <div
        className={classNames('modal-container__background', styleSelectors.backgroundContainer)}
        onClick={handleClickBackground}
      />
      <div className={classNames('modal-container__root', styleSelectors.rootContainer)}>
        <div className={classNames('modal-container__header', styleSelectors.headerContainer)}>
          <div className={classNames('modal-container__header__title', styleSelectors.headerTitle)}>
            {title ? title : 'Modal Header'}
          </div>
          <i className="fa-solid fa-xmark" title="Close" onClick={handleClickClose} />
        </div>
        <div className={classNames('modal-container__body', styleSelectors.bodyContainer)}>
          <ModalContext value={internalMetadata}>{children}</ModalContext>
        </div>
      </div>
    </RootElement>
  );
};

export default withElement(ModalContainer);

export { ModalContainer };
