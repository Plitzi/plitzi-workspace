// Packages
import React, { forwardRef, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import get from 'lodash/get';

// Monorepo
import { emptyObject, getPathsFromObeject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';

const ModalContainer = forwardRef((props, ref) => {
  const {
    className = '',
    internalProps = emptyObject,
    children,
    title = 'Modal Header',
    autoHideAfterClick = true
  } = props;
  const { id, setElementState, styleSelectors } = internalProps;
  const {
    contexts: { InteractionsContext, DataSourceContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = useContext(InteractionsContext);
  const { useDataSource } = useContext(DataSourceContext);
  const [internalMetadata, setInternalMetadata] = useState({});

  const handleOpenModal = useCallback(
    params => {
      const { metadata } = params;
      if (metadata && typeof metadata === 'object') {
        setInternalMetadata(metadata);
      } else if (typeof metadata === 'string') {
        try {
          setInternalMetadata(JSON.parse(metadata));
        } catch (error) {
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
    const label = get(internalProps, 'definition.label', 'Modal');

    return {
      openModal: {
        title: `Open ${label}`,
        callback: handleOpenModal,
        params: { metadata: '' },
        preview: { metadata: '' }
      },
      closeModal: { title: `Close ${label}`, callback: handleClickClose, params: {}, preview: {} }
    };
  }, [handleClickClose, internalProps?.definition?.label]);

  useEffect(() => {
    if (internalProps?.elementState?.visibility !== false) {
      interactionsManager.interactionTrigger(id, 'onModalOpen', { metadata: internalMetadata });
    }
  }, [internalProps?.elementState?.visibility]);

  const sourceFields = useCallback(async () => {
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

  useDataSource({
    id,
    source: `modalContainer-${id}`,
    name: `Modal Container ${id}`,
    value: internalMetadata,
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
            {title ?? 'Modal Header'}
          </div>
          <i className="fa-solid fa-xmark" title="Close" onClick={handleClickClose} />
        </div>
        <div className={classNames('modal-container__body', styleSelectors.bodyContainer)}>{children}</div>
      </div>
    </RootElement>
  );
});

ModalContainer.propTypes = {
  className: PropTypes.string,
  internalProps: PropTypes.object,
  children: PropTypes.node,
  title: PropTypes.string,
  autoHideAfterClick: PropTypes.bool
};

export default withElement(ModalContainer);

export { ModalContainer };
