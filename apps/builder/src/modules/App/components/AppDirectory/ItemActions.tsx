import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { useCallback, use } from 'react';

import { EventBridgeContext } from '@plitzi/sdk-event-bridge';
import { freeSlugFor, notFoundPageIn, pageFolderOf } from '@plitzi/sdk-shared/navigation';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import type { Element } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type PageActionsProps = {
  id?: string;
  active?: boolean;
  zoom?: boolean;
  type: string;
  defaultPage?: boolean;
  /** It is its place's 404 page (`slug: '*'`). */
  notFound?: boolean;
  onZoom?: (e: MouseEvent) => void;
};

/** A page's name as the tree shows it, or its id when it has none. */
const nameOf = (page: Element, fallback: string): string =>
  typeof page.attributes.name === 'string' && page.attributes.name !== '' ? page.attributes.name : fallback;

const ItemActions = ({
  id = '',
  type = '',
  active = false,
  zoom = false,
  defaultPage = false,
  notFound = false,
  onZoom
}: PageActionsProps) => {
  const [[element, currentPageId, navigate, flat, pages]] = useBuilderStore([
    `schema.flat.${id}`,
    'navigation.currentPageId',
    'navigation.navigate',
    'schema.flat',
    'schema.pages'
  ]);
  const { eventBridge } = use(EventBridgeContext);
  const { showDialog } = useModal();
  const { addToast } = useToast();

  const handleClickSetHome = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!(element as Element | undefined)) {
        return;
      }

      if (defaultPage) {
        addToast('This page is already home page', {
          appeareance: 'info',
          autoDismiss: true,
          placement: 'top-right'
        });

        return;
      }

      const response = await showDialog(
        <Modal.Header>
          <h4>Set Home Page</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="px-4 py-2">
            <h4>Do you want to mark this page as home page ?</h4>
          </div>
        </Modal.Body>,
        undefined,
        { size: 'sm' },
        id
      );

      if (response) {
        void eventBridge.emit('main', 'schemaHomePage', id);
      }
    },
    [element, id, defaultPage, showDialog, addToast, eventBridge]
  );

  /**
   * This page as its place's 404 — the space's, or its folder's: its slug becomes `*`, and the page that was the 404 there
   * gets a slug of its name back. One per place: two would leave the router to pick one (`not-found-twice`).
   */
  const handleClickSetNotFound = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const page = element as Element | undefined;
      if (!page || notFound) {
        return;
      }

      const folder = pageFolderOf(page.attributes);
      const place = folder ? 'in its folder' : 'in the space';
      const previous = notFoundPageIn({ flat, pages }, folder, id);
      const previousPage = previous === undefined ? undefined : flat[previous];
      const previousSlug = previous === undefined ? undefined : freeSlugFor({ flat, pages }, previous);
      const name = nameOf(page, id);
      const response = await showDialog(
        <Modal.Header>
          <h4>Use as 404 page</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="flex flex-col gap-2 px-4 py-2 text-sm">
            <p>
              &ldquo;{name}&rdquo; will answer every address no other page does {place}, sent with status 404. Its own
              address stops existing.
            </p>
            {previousPage && (
              <p>
                &ldquo;{nameOf(previousPage, previous ?? '')}&rdquo;, the 404 page until now, gets the address &ldquo;
                {previousSlug}&rdquo;.
              </p>
            )}
          </div>
        </Modal.Body>,
        undefined,
        { size: 'sm' },
        id
      );

      if (!response) {
        return;
      }

      // The old one first: for a moment there is none rather than two.
      if (previousPage && previousSlug !== undefined) {
        void eventBridge.emit('main', 'schemaUpdateElement', {
          ...previousPage,
          attributes: { ...previousPage.attributes, slug: previousSlug }
        });
      }

      void eventBridge.emit('main', 'schemaUpdateElement', { ...page, attributes: { ...page.attributes, slug: '*' } });
      addToast(
        previousPage
          ? `"${name}" is the 404 page ${place}; "${nameOf(previousPage, previous ?? '')}" is at "${String(previousSlug)}" now`
          : `"${name}" is the 404 page ${place}`,
        { appeareance: 'success', autoDismiss: true, placement: 'top-right' }
      );
    },
    [element, notFound, flat, pages, id, showDialog, eventBridge, addToast]
  );

  const handleClickRemove = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!(element as Element | undefined)) {
        return;
      }

      if (defaultPage) {
        addToast("You can't delete the home page", {
          appeareance: 'warning',
          autoDismiss: true,
          placement: 'top-right'
        });

        return;
      }

      const response = await showDialog(
        <Modal.Header>
          <h4>{`Remove ${type === 'page' ? 'Page' : 'Layout'}`}</h4>
        </Modal.Header>,
        <Modal.Body>
          <h4>Do you want to remove this item ?</h4>
        </Modal.Body>,
        undefined,
        { size: 'sm' },
        id
      );

      if (!response) {
        return;
      }

      if (type === 'page') {
        void eventBridge.emit('main', 'schemaRemovePage', id);
        navigate('/');
      } else if (type === 'layoutContainer') {
        void eventBridge.emit('builder', 'builderSetBaseContext', currentPageId);
        void eventBridge.emit('main', 'schemaRemoveElement', id);
      }
    },
    [element, id, defaultPage, showDialog, type, addToast, eventBridge, navigate, currentPageId]
  );

  return (
    <Flex
      gap={2}
      items="center"
      className={clsx({ 'hidden group-hover:flex': !active && !zoom && !defaultPage && !notFound })}
    >
      {/* The home cannot be the 404 page, nor the 404 the home (`page-catch-all-default`). */}
      {!defaultPage && !notFound && type === 'page' && (
        <Icon
          size="xs"
          cursor="pointer"
          intent="primary"
          icon="fas fa-home"
          title="Set Home Page"
          onClick={handleClickSetHome}
        />
      )}
      {!defaultPage && !notFound && type === 'page' && (
        <Icon
          size="xs"
          cursor="pointer"
          intent="primary"
          icon="fa-solid fa-signs-post"
          title="Use as 404 page"
          aria-label="Use as 404 page"
          role="button"
          onClick={handleClickSetNotFound}
        />
      )}
      <Flex gap={2} items="center" className={clsx({ 'hidden group-hover:flex': !active && !zoom })}>
        {zoom && (
          <Icon
            size="xs"
            icon="fa-solid fa-magnifying-glass-minus"
            cursor="pointer"
            title="Zoom Out"
            onClick={onZoom}
          />
        )}
        {!zoom && (
          <Icon size="xs" icon="fa-solid fa-magnifying-glass-plus" cursor="pointer" title="Zoom In" onClick={onZoom} />
        )}
        <Icon
          size="xs"
          icon="fas fa-trash-alt"
          intent="danger"
          cursor="pointer"
          title="Remove page"
          onClick={handleClickRemove}
        />
      </Flex>
    </Flex>
  );
};

export default ItemActions;
