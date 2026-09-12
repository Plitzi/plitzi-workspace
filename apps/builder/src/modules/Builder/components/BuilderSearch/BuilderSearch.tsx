import Modal from '@plitzi/plitzi-ui/Modal';
import { useCallback, useEffect, useMemo, useState } from 'react';

import BuilderSearchContext from './BuilderSearchContext';
import BuilderSearchPanel from './components/BuilderSearchPanel';
import { isSearchShortcut } from './helpers';

import type { BuilderSearchContextValue } from './BuilderSearchContext';
import type { ReactNode } from 'react';

export type BuilderSearchProps = {
  children?: ReactNode;
};

/**
 * Finding an element from anywhere in the builder, whatever panel is open.
 *
 * The Layers panel has a search of its own, but it is only there while that panel is — and an author looking for
 * an element across forty pages and a handful of layouts is rarely looking at Layers when they need it. This one
 * opens with ⌘P / Ctrl+P or the header button, searches the whole space, and takes the author to the match.
 *
 * The canvas is an iframe, and keys pressed inside it never reach this document: the canvas forwards the shortcut
 * through `openSearch` instead.
 */
const BuilderSearch = ({ children }: BuilderSearchProps) => {
  const [open, setOpen] = useState(false);

  const openSearch = useCallback(() => setOpen(true), []);

  const handleClose = useCallback(() => setOpen(false), []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isSearchShortcut(e)) {
      return;
    }

    e.preventDefault();
    setOpen(state => !state);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const value = useMemo<BuilderSearchContextValue>(() => ({ openSearch }), [openSearch]);

  return (
    <BuilderSearchContext value={value}>
      {children}
      <Modal open={open} onClose={handleClose} size="sm" className={{ card: 'w-160' }}>
        <Modal.Header>
          <Modal.HeaderIcon>
            <i className="fa-solid fa-magnifying-glass" />
          </Modal.HeaderIcon>
          Find an element
        </Modal.Header>
        <Modal.Body className="p-0">
          <BuilderSearchPanel onClose={handleClose} />
        </Modal.Body>
      </Modal>
    </BuilderSearchContext>
  );
};

export default BuilderSearch;
