import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModalContainer } from './ModalContainer';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../testUtils/elementTestUtils';
import { DialogContainer } from '../DialogContainer/DialogContainer';

vi.mock('../../../Element/hocs/withElement', () => ({ default: (element: unknown) => element }));

vi.mock('@plitzi/sdk-shared/dataSource/hooks/useRegisterSource', () => ({ default: () => undefined }));

const { interactionTrigger } = vi.hoisted(() => ({ interactionTrigger: vi.fn() }));

vi.mock('@plitzi/sdk-shared/hooks/usePlitzi', () => ({
  default: () => ({ settings: { previewMode: true }, root: { baseElementId: 'root' } })
}));

vi.mock('@plitzi/sdk-interactions/InteractionsContext', async () => {
  const { createContext } = await import('react');

  return { default: createContext({ interactionsManager: { interactionTrigger }, useInteractions: () => undefined }) };
});

/** A page with a button that opens the overlay, the way a flow would: the overlay's own visibility, in its state. */
const Page = ({ kind }: { kind: 'modal' | 'dialog' }) => {
  const [open, setOpen] = useState(false);
  const entry = elementEntry('overlay', {
    visible: open,
    elementState: { visibility: open },
    setElementState: <S extends Record<string, unknown>>(value?: S | ((prev: S) => S)) => {
      // The context's setter is generic over whatever an element keeps; this overlay keeps only its visibility.
      const next = typeof value === 'function' ? value({ visibility: open } as unknown as S) : value;
      setOpen(Boolean(next?.visibility));

      return true;
    }
  });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <ElementContext value={entry}>
        {kind === 'modal' ? (
          <ModalContainer title="Invite people">
            <input aria-label="Email" />
            <button type="button">Send</button>
          </ModalContainer>
        ) : (
          <DialogContainer
            ref={{ current: document.createElement('div') }}
            className=""
            headerLabel="Delete this board?"
            acceptButtonLabel="Delete"
            acceptButtonLabelLoading="Deleting"
            rejectButtonLabel="Keep it"
            autoHideAfterClick
          >
            <p>It cannot be undone.</p>
          </DialogContainer>
        )}
      </ElementContext>
    </>
  );
};

describe('ModalContainer / DialogContainer — what assistive technology is told', () => {
  beforeEach(() => {
    interactionTrigger.mockClear();
  });

  it('is a modal dialog named by its title', () => {
    render(<Page kind="modal" />);

    const dialog = screen.getByRole('dialog', { name: 'Invite people', hidden: true });

    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('takes the focus as it opens, keeps Tab inside, and gives the focus back when Escape closes it', () => {
    render(<Page kind="modal" />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Invite people' });

    expect(document.activeElement).toBe(dialog);

    screen.getByRole('button', { name: 'Send' }).focus();
    fireEvent.keyDown(window, { key: 'Tab' });

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(interactionTrigger).toHaveBeenCalledWith('overlay', 'onModalClose', { metadata: {} });
    expect(document.activeElement).toBe(opener);
  });

  it('is an alert dialog whose Escape turns it down rather than accepting it', () => {
    render(<Page kind="dialog" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('alertdialog', { name: 'Delete this board?' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(interactionTrigger).toHaveBeenCalledWith('overlay', 'onDialogReject', { metadata: {} });
    expect(interactionTrigger).not.toHaveBeenCalledWith('overlay', 'onDialogAccept', expect.anything());
  });

  it('runs the accept flow when the dialog is accepted, and closes it once that flow is done', async () => {
    render(<Page kind="dialog" />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(interactionTrigger).toHaveBeenCalledWith('overlay', 'onDialogAccept', { metadata: {} });
    // Closed, the keyboard is handed back to what opened it.
    await waitFor(() => expect(document.activeElement).toBe(opener));
    expect(interactionTrigger).not.toHaveBeenCalledWith('overlay', 'onDialogReject', expect.anything());
  });

  it('closes from its backdrop, as its close callback does', () => {
    const { container } = render(<Page kind="modal" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const backdrop = container.querySelector('.modal-container__background');
    if (!backdrop) {
      throw new Error('no backdrop');
    }

    fireEvent.click(backdrop);

    expect(interactionTrigger).toHaveBeenCalledWith('overlay', 'onModalClose', { metadata: {} });
  });
});
