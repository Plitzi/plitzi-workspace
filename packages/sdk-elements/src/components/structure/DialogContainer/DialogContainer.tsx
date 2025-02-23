/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import get from 'lodash/get';
import { useCallback, use, useEffect, useMemo, useState } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject, getPathsFromObeject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { DataSourceContextValue } from '@plitzi/sdk-data-source';
import type { SourceField, InternalProps } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type DialogContainerProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  internalProps: InternalProps;
  children: ReactNode;
  headerLabel: string;
  acceptButtonLabel: string;
  acceptButtonLabelLoading: string;
  rejectButtonLabel: string;
  autoHideAfterClick: boolean;
};

const DialogContainer = ({
  ref,
  className = '',
  internalProps = emptyObject as InternalProps,
  children,
  headerLabel = 'Dialog Header',
  acceptButtonLabel = 'Accept',
  acceptButtonLabelLoading = 'Loading...',
  rejectButtonLabel = 'Cancel',
  autoHideAfterClick = true
}: DialogContainerProps) => {
  const { id, setElementState, styleSelectors } = internalProps;
  const {
    contexts: { InteractionsContext, DataSourceContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use(InteractionsContext);
  const { useDataSource } = use(DataSourceContext) as DataSourceContextValue;
  const [internalMetadata, setInternalMetadata] = useState({});
  const [processing, setProcessing] = useState(false);

  // Modal methods

  const handleOpeDialog = useCallback(
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
    interactionsManager.interactionTrigger(id, 'onDialogClose', { metadata: internalMetadata });
    setInternalMetadata({});
    setElementState({ key: 'visibility', value: false });
  }, [interactionsManager, setElementState, setInternalMetadata, internalMetadata, id]);

  const handleClickBackground = useCallback(() => {
    if (!autoHideAfterClick) {
      return;
    }

    interactionsManager.interactionTrigger(id, 'onDialogClose', { metadata: internalMetadata });
    setInternalMetadata({});
    setElementState({ key: 'visibility', value: false });
  }, [interactionsManager, autoHideAfterClick, setElementState, setInternalMetadata, internalMetadata, id]);

  // Dialog Methods

  const handleClickAccept = useCallback(async () => {
    setProcessing(true);
    await interactionsManager.interactionTrigger(id, 'onDialogAccept', { metadata: internalMetadata });
    setProcessing(false);
    setElementState({ key: 'visibility', value: false });
  }, [interactionsManager, setElementState, internalMetadata]);

  const handleClickCancel = useCallback(async () => {
    setProcessing(true);
    await interactionsManager.interactionTrigger(id, 'onDialogReject', { metadata: internalMetadata });
    setProcessing(false);
    setElementState({ key: 'visibility', value: false });
  }, [interactionsManager, setElementState, internalMetadata]);

  const interactionTriggers = useMemo(
    () => ({
      onDialogAccept: { title: 'On Dialog Accept', params: { metadata: '' }, preview: { metadata: '' } },
      onDialogReject: { title: 'On Dialog Reject', params: { metadata: '' }, preview: { metadata: '' } },
      onDialogOpen: { title: 'On Dialog Open', params: { metadata: '' }, preview: { metadata: '' } },
      onDialogClose: { title: 'On Dialog Close', params: { metadata: '' }, preview: { metadata: '' } }
    }),
    []
  );

  const interactionCallbacks = useMemo(() => {
    const label = get(internalProps, 'definition.label', 'Modal');

    return {
      openDialog: {
        title: `Open ${label}`,
        callback: handleOpeDialog,
        preview: { metadata: '' },
        params: { metadata: '' }
      },
      closeDialog: { title: `Close ${label}`, callback: handleClickClose, preview: {}, params: {} }
    };
  }, [handleOpeDialog, internalProps?.definition?.label]);

  useEffect(() => {
    if (internalProps.elementState?.visibility !== false) {
      interactionsManager.interactionTrigger(id, 'onDialogOpen', { metadata: internalMetadata });
    }
  }, [internalProps?.elementState?.visibility]);

  const sourceFields = useCallback(() => {
    if (!internalMetadata || typeof internalMetadata !== 'object') {
      return [];
    }

    return getPathsFromObeject(internalMetadata).reduce<SourceField[]>((acum, path) => {
      const name = path.split('.');
      if (name.length > 1) {
        return [...acum, { path, name: name.slice(name.length - 2).join(' ') }];
      }

      return [...acum, { path, name: name[name.length - 1] }];
    }, []);
  }, [internalMetadata]);

  const sourceName = useMemo(
    () => get(internalProps, 'definition.label', `Dialog - ${id}`),
    [id, internalProps?.definition?.label]
  );

  const [DialogContianerContext] = useDataSource({
    id,
    source: `dialogContainer_${id}`,
    mode: 'write',
    name: sourceName,
    fields: sourceFields
  });

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__dialog-container', className)}
      interactionTriggers={interactionTriggers}
      interactionCallbacks={interactionCallbacks}
    >
      <div
        className={classNames('dialog-container__background', styleSelectors.backgroundContainer)}
        onClick={handleClickBackground}
      />
      <div className={classNames('dialog-container__root', styleSelectors.rootContainer)}>
        <div className={classNames('dialog-container__header', styleSelectors.headerContainer)}>
          <div className={classNames('modal-container__header__title', styleSelectors.headerTitle)}>
            {headerLabel ?? 'Dialog Header'}
          </div>
          <i className="fa-solid fa-xmark" title="Close" onClick={handleClickCancel} />
        </div>
        <div className={classNames('dialog-container__body', styleSelectors.body)}>
          <DialogContianerContext value={internalMetadata}>{children}</DialogContianerContext>
        </div>
        <div className={classNames('dialog-container__footer', styleSelectors.footerContainer)}>
          <button
            className={classNames('footer__button button--accept', styleSelectors.acceptButton)}
            onClick={handleClickAccept}
            disabled={processing}
          >
            {processing && (
              <div className="button--accept__container">
                <i className="fa-solid fa-rotate fa-spin" />
                {acceptButtonLabelLoading}
              </div>
            )}
            {!processing && acceptButtonLabel}
          </button>
          <button
            className={classNames('footer__button button--cancel', styleSelectors.cancelButton)}
            onClick={handleClickCancel}
            disabled={processing}
          >
            {rejectButtonLabel}
          </button>
        </div>
      </div>
    </RootElement>
  );
};

export default withElement(DialogContainer);

export { DialogContainer };
