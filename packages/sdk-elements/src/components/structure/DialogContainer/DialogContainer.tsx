/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import get from 'lodash/get';
import { useCallback, use, useEffect, useMemo, useState } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { getPathsFromObeject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { DataSourceContextValue } from '@plitzi/sdk-data-source';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type {
  SourceField,
  InternalPropsSTG2,
  InteractionBaseCallback,
  InteractionCallbackParamValues
} from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

type InternalPropsSubProps = {
  // setElementState: (params: { key: string; value: boolean }) => void;
  styleSelectors: Record<string, string>;
};

export type DialogContainerProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  internalProps: InternalPropsSTG2<InternalPropsSubProps>;
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
  internalProps,
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
  const { interactionsManager } = use(InteractionsContext) as InteractionsContextValue;
  const { useDataSource } = use(DataSourceContext) as DataSourceContextValue;
  const [internalMetadata, setInternalMetadata] = useState<Record<string, unknown>>({});
  const [processing, setProcessing] = useState(false);

  // Modal methods

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

      setElementState({ key: 'visibility', value: true });
    },
    [setElementState, setInternalMetadata]
  );

  const handleClickClose = useCallback(() => {
    void interactionsManager.interactionTrigger(id, 'onDialogClose', { metadata: internalMetadata });
    setInternalMetadata({});
    setElementState({ key: 'visibility', value: false });
  }, [interactionsManager, setElementState, setInternalMetadata, internalMetadata, id]);

  const handleClickBackground = useCallback(() => {
    if (!autoHideAfterClick) {
      return;
    }

    void interactionsManager.interactionTrigger(id, 'onDialogClose', { metadata: internalMetadata });
    setInternalMetadata({});
    setElementState({ key: 'visibility', value: false });
  }, [interactionsManager, autoHideAfterClick, setElementState, setInternalMetadata, internalMetadata, id]);

  // Dialog Methods

  const handleClickAccept = useCallback(async () => {
    setProcessing(true);
    await interactionsManager.interactionTrigger(id, 'onDialogAccept', { metadata: internalMetadata });
    setProcessing(false);
    setElementState({ key: 'visibility', value: false });
  }, [interactionsManager, id, internalMetadata, setElementState]);

  const handleClickCancel = useCallback(async () => {
    setProcessing(true);
    await interactionsManager.interactionTrigger(id, 'onDialogReject', { metadata: internalMetadata });
    setProcessing(false);
    setElementState({ key: 'visibility', value: false });
  }, [interactionsManager, id, internalMetadata, setElementState]);

  const interactionTriggers = useMemo<Record<string, InteractionBaseCallback>>(
    () => ({
      onDialogAccept: {
        title: 'On Dialog Accept',
        type: 'trigger',
        params: { metadata: { type: 'text', defaultValue: '' } },
        preview: { metadata: '' }
      },
      onDialogReject: {
        title: 'On Dialog Reject',
        type: 'trigger',
        params: { metadata: { type: 'text', defaultValue: '' } },
        preview: { metadata: '' }
      },
      onDialogOpen: {
        title: 'On Dialog Open',
        type: 'trigger',
        params: { metadata: { type: 'text', defaultValue: '' } },
        preview: { metadata: '' }
      },
      onDialogClose: {
        title: 'On Dialog Close',
        type: 'trigger',
        params: { metadata: { type: 'text', defaultValue: '' } },
        preview: { metadata: '' }
      }
    }),
    []
  );

  const interactionCallbacks = useMemo<Record<string, InteractionBaseCallback>>(() => {
    const label = get(internalProps, 'definition.label', 'Modal');

    return {
      openDialog: {
        title: `Open ${label}`,
        type: 'callback',
        callback: handleOpeDialog,
        params: { metadata: { type: 'text', defaultValue: '' } },
        preview: { metadata: '' }
      },
      closeDialog: { title: `Close ${label}`, type: 'callback', callback: handleClickClose, preview: {}, params: {} }
    };
  }, [handleClickClose, handleOpeDialog, internalProps]);

  useEffect(() => {
    if (internalProps.elementState.visibility !== false) {
      void interactionsManager.interactionTrigger(id, 'onDialogOpen', { metadata: internalMetadata });
    }
  }, [id, interactionsManager, internalMetadata, internalProps.elementState.visibility]);

  const sourceFields = useCallback(() => {
    if (typeof internalMetadata !== 'object') {
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

  const sourceName = useMemo(() => get(internalProps, 'definition.label', `Dialog - ${id}`), [id, internalProps]);

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
            {headerLabel ? headerLabel : 'Dialog Header'}
          </div>
          <i className="fa-solid fa-xmark" title="Close" onClick={void handleClickCancel} />
        </div>
        <div className={classNames('dialog-container__body', styleSelectors.body)}>
          <DialogContianerContext value={internalMetadata}>{children}</DialogContianerContext>
        </div>
        <div className={classNames('dialog-container__footer', styleSelectors.footerContainer)}>
          <button
            className={classNames('footer__button button--accept', styleSelectors.acceptButton)}
            onClick={void handleClickAccept}
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
            onClick={void handleClickCancel}
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
