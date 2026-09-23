import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback } from 'react';

import SpaceIssues from '../components/SpaceIssues';

import type { TSpaceIssues } from '@plitzi/sdk-shared';

/**
 * Opens the list of what is wrong with the space. The same list whether someone asked for it or a publish was refused
 * over it — only the line above it changes — and following an element out of it closes it, so the element is what is
 * left on screen.
 */
const useShowSpaceIssues = () => {
  const { showModal } = useModal();

  return useCallback(
    (issues: TSpaceIssues, intro?: string) =>
      showModal(
        <Modal.Header>
          <h4>Problems</h4>
        </Modal.Header>,
        ({ onClose }) => (
          <Modal.Body>
            <SpaceIssues issues={issues} intro={intro} onNavigate={onClose} />
          </Modal.Body>
        ),
        undefined,
        { size: 'md' }
      ),
    [showModal]
  );
};

export default useShowSpaceIssues;
