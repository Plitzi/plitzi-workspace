import clsx from 'clsx';
import { useRef } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';

import useModalDialog from './useModalDialog';
import RootElement from '../../../Element/RootElement';

import type { Overlay } from './useOverlay';
import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type OverlayShellProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  /** Its class names' stem: `modal-container` gives `plitzi-component__modal-container`, `modal-container__root`… */
  block: string;
  /** `alertdialog` for one that asks for an answer: a screen reader reads it out as it opens. */
  role: 'dialog' | 'alertdialog';
  /** What its store is called in the dev tools: `Modal:<id>`. */
  storeName: string;
  title: string;
  overlay: Overlay;
  triggers: Record<string, InteractionCallback>;
  /** What the close button and Escape do. */
  onDismiss: () => void;
  children?: ReactNode;
  /** Below the body: a dialog's answers. */
  footer?: ReactNode;
};

/** A modal's and a dialog's markup: the backdrop, the panel the keyboard is kept in, its header and its body. */
const OverlayShell = ({
  ref,
  className = '',
  block,
  role,
  storeName,
  title,
  overlay,
  triggers,
  onDismiss,
  children,
  footer
}: OverlayShellProps) => {
  const { id, titleId, styleSelectors, open, interactionCallbacks, storeValue, closeFromBackdrop } = overlay;
  const panelRef = useRef<HTMLDivElement>(null);

  useModalDialog({ panelRef, open, onClose: onDismiss });

  return (
    <RootElement
      ref={ref}
      className={clsx(`plitzi-component__${block}`, className)}
      interactionTriggers={triggers}
      interactionCallbacks={interactionCallbacks}
    >
      <div
        className={clsx(`${block}__background`, styleSelectors.backgroundContainer)}
        aria-hidden="true"
        onClick={closeFromBackdrop}
      />
      <div
        ref={panelRef}
        className={clsx(`${block}__root`, styleSelectors.rootContainer)}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={clsx(`${block}__header`, styleSelectors.headerContainer)}>
          <div id={titleId} className={clsx(`${block}__header__title`, styleSelectors.headerTitle)}>
            {title}
          </div>
          <button
            type="button"
            className={clsx(`${block}__close`, styleSelectors.headerCloseButton)}
            aria-label="Close"
            title="Close"
            onClick={onDismiss}
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div className={clsx(`${block}__body`, styleSelectors.bodyContainer)}>
          <StoreProvider inherit="live" name={`${storeName}:${id}`} value={storeValue}>
            {children}
          </StoreProvider>
        </div>
        {footer}
      </div>
    </RootElement>
  );
};

export default OverlayShell;
