/* eslint-disable react-refresh/only-export-components */
import declaration from './declaration';
import withElement from '../../../Element/hocs/withElement';
import OverlayShell from '../Overlay/OverlayShell';
import useOverlay from '../Overlay/useOverlay';

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
  const overlay = useOverlay({
    name: 'Modal',
    sourceType: declaration.sourceType,
    callbacks: { open: declaration.callbacks.openModal, close: declaration.callbacks.closeModal },
    events: { open: 'onModalOpen', close: 'onModalClose' },
    autoHideAfterClick
  });

  return (
    <OverlayShell
      ref={ref}
      className={className}
      block="modal-container"
      role="dialog"
      storeName="Modal"
      title={title || 'Modal Header'}
      overlay={overlay}
      triggers={declaration.triggers}
      onDismiss={overlay.close}
    >
      {children}
    </OverlayShell>
  );
};

export default withElement(ModalContainer);

export { ModalContainer };
