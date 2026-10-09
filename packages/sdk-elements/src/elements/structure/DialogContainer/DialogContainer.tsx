/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import declaration from './declaration';
import withElement from '../../../Element/hocs/withElement';
import OverlayShell from '../Overlay/OverlayShell';
import useOverlay from '../Overlay/useOverlay';

import type { ReactNode, RefObject } from 'react';

export type DialogContainerProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
  headerLabel?: string;
  acceptButtonLabel?: string;
  acceptButtonLabelLoading?: string;
  rejectButtonLabel?: string;
  autoHideAfterClick?: boolean;
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
  const overlay = useOverlay({
    name: 'Dialog',
    sourceType: declaration.sourceType,
    callbacks: { open: declaration.callbacks.openDialog, close: declaration.callbacks.closeDialog },
    events: { open: 'onDialogOpen', close: 'onDialogClose' },
    autoHideAfterClick
  });
  const { styleSelectors, trigger, hide } = overlay;
  const [processing, setProcessing] = useState(false);

  /** Runs the flow of the answer given, and closes once it is done: accepting may take a request. */
  const answer = useCallback(
    async (event: 'onDialogAccept' | 'onDialogReject') => {
      setProcessing(true);
      await trigger(event);
      setProcessing(false);
      hide();
    },
    [hide, trigger]
  );

  const handleClickAccept = useCallback(() => void answer('onDialogAccept'), [answer]);

  // The close button and Escape turn the dialog down; they never accept it.
  const handleClickCancel = useCallback(() => void answer('onDialogReject'), [answer]);

  return (
    <OverlayShell
      ref={ref}
      className={className}
      block="dialog-container"
      role="alertdialog"
      storeName="Dialog"
      title={headerLabel || 'Dialog Header'}
      overlay={overlay}
      triggers={declaration.triggers}
      onDismiss={handleClickCancel}
      footer={
        <div className={clsx('dialog-container__footer', styleSelectors.footerContainer)}>
          <button
            type="button"
            className={clsx('footer__button button--accept', styleSelectors.acceptButton)}
            onClick={handleClickAccept}
            disabled={processing}
          >
            {processing && (
              <div className="button--accept__container">
                <i className="fa-solid fa-rotate fa-spin" aria-hidden="true" />
                {acceptButtonLabelLoading}
              </div>
            )}
            {!processing && acceptButtonLabel}
          </button>
          <button
            type="button"
            className={clsx('footer__button button--cancel', styleSelectors.cancelButton)}
            onClick={handleClickCancel}
            disabled={processing}
          >
            {rejectButtonLabel}
          </button>
        </div>
      }
    >
      {children}
    </OverlayShell>
  );
};

export default withElement(DialogContainer);

export { DialogContainer };
