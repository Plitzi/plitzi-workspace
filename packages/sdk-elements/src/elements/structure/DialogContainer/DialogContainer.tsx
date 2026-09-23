/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback, use, useEffect, useMemo, useState } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import getSourceName from '@plitzi/sdk-shared/dataSource/helpers/getSourceName';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import declaration from './declaration';
import pathFields from '../../../dataSource/pathFields';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback, InteractionCallbackParamValues } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type DialogContainerProps = {
  ref: RefObject<HTMLElement>;
  className: string;
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
  children,
  headerLabel = 'Dialog Header',
  acceptButtonLabel = 'Accept',
  acceptButtonLabelLoading = 'Loading...',
  rejectButtonLabel = 'Cancel',
  autoHideAfterClick = true
}: DialogContainerProps) => {
  const {
    id,
    setElementState,
    definition: { styleSelectors, label = 'Dialog' },
    elementState
  } = useElement();
  const sourceName = getSourceName(declaration.sourceType, id);
  const {
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
  const [internalMetadata, setInternalMetadata] = useState<Record<string, unknown>>({});
  const [processing, setProcessing] = useState(false);

  // Dialog methods

  const handleOpeDialog = useCallback(
    (params: InteractionCallbackParamValues) => {
      const { metadata } = params;
      if (metadata && typeof metadata === 'object') {
        setInternalMetadata(metadata as Record<string, unknown>);
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
    void interactionsManager.interactionTrigger(id, 'onDialogClose', { metadata: internalMetadata });
    setInternalMetadata({});
    setElementState(state => ({ ...state, visibility: false }));
  }, [interactionsManager, setElementState, setInternalMetadata, internalMetadata, id]);

  const handleClickBackground = useCallback(() => {
    if (!autoHideAfterClick) {
      return;
    }

    void interactionsManager.interactionTrigger(id, 'onDialogClose', { metadata: internalMetadata });
    setInternalMetadata({});
    setElementState(state => ({ ...state, visibility: false }));
  }, [interactionsManager, autoHideAfterClick, setElementState, setInternalMetadata, internalMetadata, id]);

  // Dialog Methods

  const handleClickAccept = useCallback(async () => {
    setProcessing(true);
    await interactionsManager.interactionTrigger(id, 'onDialogAccept', { metadata: internalMetadata });
    setProcessing(false);
    setElementState(state => ({ ...state, visibility: false }));
  }, [interactionsManager, id, internalMetadata, setElementState]);

  const handleClickCancel = useCallback(async () => {
    setProcessing(true);
    await interactionsManager.interactionTrigger(id, 'onDialogReject', { metadata: internalMetadata });
    setProcessing(false);
    setElementState(state => ({ ...state, visibility: false }));
  }, [interactionsManager, id, internalMetadata, setElementState]);

  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(() => {
    return {
      openDialog: { ...declaration.callbacks.openDialog, title: `Open ${label}`, callback: handleOpeDialog },
      closeDialog: { ...declaration.callbacks.closeDialog, title: `Close ${label}`, callback: handleClickClose }
    };
  }, [handleClickClose, handleOpeDialog, label]);

  useEffect(() => {
    if (elementState.visibility !== false) {
      void interactionsManager.interactionTrigger(id, 'onDialogOpen', { metadata: internalMetadata });
    }
  }, [id, interactionsManager, internalMetadata, elementState.visibility]);

  const sourceFields = useCallback(() => pathFields(internalMetadata), [internalMetadata]);

  useRegisterSource({ id, source: sourceName, name: label ? label : `Dialog - ${id}`, fields: sourceFields });

  const storeContext = useMemo(
    () => (sourceName ? { runtime: { sources: { [sourceName]: internalMetadata } } } : emptyObject),
    [sourceName, internalMetadata]
  );

  return (
    <RootElement
      ref={ref}
      className={clsx('plitzi-component__dialog-container', className)}
      interactionTriggers={declaration.triggers}
      interactionCallbacks={interactionCallbacks}
    >
      <div
        className={clsx('dialog-container__background', styleSelectors.backgroundContainer)}
        onClick={handleClickBackground}
      />
      <div className={clsx('dialog-container__root', styleSelectors.rootContainer)}>
        <div className={clsx('dialog-container__header', styleSelectors.headerContainer)}>
          <div className={clsx('dialog-container__header__title', styleSelectors.headerTitle)}>
            {headerLabel ? headerLabel : 'Dialog Header'}
          </div>
          <button
            type="button"
            className="dialog-container__close"
            aria-label="Close"
            title="Close"
            onClick={handleClickCancel}
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div className={clsx('dialog-container__body', styleSelectors.body)}>
          <StoreProvider inherit="live" name={`Dialog:${id}`} value={storeContext}>
            {children}
          </StoreProvider>
        </div>
        <div className={clsx('dialog-container__footer', styleSelectors.footerContainer)}>
          <button
            className={clsx('footer__button button--accept', styleSelectors.acceptButton)}
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
            className={clsx('footer__button button--cancel', styleSelectors.cancelButton)}
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
