import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, use } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';

import { REUSE } from '../helpers/reuse';
import SnippetForm from '../Models/SnippetForm';

import type { SnippetFormValues } from '../Models/SnippetForm';
import type { Element } from '@plitzi/sdk-shared';

/**
 * Saves an element on the canvas as a snippet: asks for its name and the bucket it goes in, uploads it, and says how
 * that went — saved only once the upload answered, so a failed one is never announced as done. Returns whether it was
 * saved.
 */
const useSaveAsSnippet = () => {
  const { showModal } = useModal();
  const { addToast } = useToast();
  const { elementAsSnippet } = use(BuilderContext);

  return useCallback(
    async (element: Element): Promise<boolean> => {
      const values = await showModal<SnippetFormValues>(
        <Modal.Header>
          <h4>Save as Snippet</h4>
        </Modal.Header>,
        ({ onSubmit, onClose }) => (
          <Modal.Body>
            <p className="mb-3 text-sm text-gray-600 first-letter:uppercase dark:text-zinc-400">
              {REUSE.snippet.hint}.
            </p>
            <SnippetForm onSubmit={onSubmit} onClose={onClose} />
          </Modal.Body>
        )
      );
      if (!values) {
        return false;
      }

      const { name, description, cdnIdentifier, bucketIdentifier } = values;
      const outcome = await elementAsSnippet(
        { cdnIdentifier, bucketIdentifier },
        { name, description: description ?? '' },
        element
      );
      if (!outcome.saved) {
        addToast(
          <div>
            Snippet <b>{name}</b> was not saved: {outcome.reason}
          </div>,
          { appeareance: 'error', autoDismiss: true, placement: 'top-right' }
        );

        return false;
      }

      addToast(
        <div>
          Snippet <b>{name}</b> saved
        </div>,
        { appeareance: 'success', autoDismiss: true, placement: 'top-right' }
      );

      return true;
    },
    [showModal, elementAsSnippet, addToast]
  );
};

export default useSaveAsSnippet;
