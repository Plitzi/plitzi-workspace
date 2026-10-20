/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { findLayoutCycle } from '@plitzi/sdk-shared/schema';

import type { ValidationContext } from './context';

/** Its roots: pages, layout shells and folders, and no element left hanging off none of them. */

// 5. Validate pages
export const validatePages = ({ errors, warnings, pages, getElement }: ValidationContext) => {
  const pageSet = new Set<string>();
  let defaultPageCount = 0;

  pages.forEach((pageId, index) => {
    if (pageSet.has(pageId)) {
      errors.push({
        code: 'DUPLICATE_PAGE',
        message: `Duplicate page ID "${pageId}" in pages array at index ${index}`,
        elementId: pageId
      });
    }
    pageSet.add(pageId);

    const page = getElement(pageId);
    if (!page) {
      errors.push({
        code: 'INVALID_PAGE_REFERENCE',
        message: `Page ID "${pageId}" in pages array doesn't exist in flat`,
        elementId: pageId
      });
      return;
    }

    if (page.definition.type !== 'page') {
      errors.push({
        code: 'INVALID_PAGE_TYPE',
        message: `Element "${pageId}" in pages array has type "${page.definition.type}" instead of "page"`,
        elementId: pageId
      });
    }

    // Check rootId matches page's own ID
    if (page.definition.rootId !== pageId) {
      errors.push({
        code: 'PAGE_ROOT_ID_MISMATCH',
        message: `Page "${pageId}" has rootId "${page.definition.rootId}" instead of its own ID`,
        elementId: pageId
      });
    }

    // Count default page
    if (page.attributes?.default) {
      defaultPageCount++;
    }
  });

  if (defaultPageCount === 0 && pages.length > 0) {
    warnings.push({ code: 'NO_DEFAULT_PAGE', message: 'No default page found in schema' });
  } else if (defaultPageCount > 1) {
    warnings.push({ code: 'MULTIPLE_DEFAULT_PAGES', message: `Found ${defaultPageCount} default pages, expected 1` });
  }
};

// 6. Validate rootId consistency — for every root, pages and layout shells alike
export const validateRootConsistency = ({ errors, getElement, rootIds }: ValidationContext) => {
  rootIds().forEach(rootId => {
    const root = getElement(rootId);
    if (!root) {
      return;
    }

    // All descendants should have rootId = the root they hang off. Visited once each: a circle is reported on its
    // own (CIRCULAR_REFERENCE), and walking it here would never end.
    const visited = new Set<string>([rootId]);
    const checkDescendants = (elementId: string) => {
      const element = getElement(elementId);
      if (!element?.definition || visited.has(elementId)) {
        return;
      }

      visited.add(elementId);

      if (element.definition.rootId !== rootId) {
        errors.push({
          code: 'ROOT_ID_MISMATCH',
          message: `Element "${elementId}" has rootId "${element.definition.rootId}" but should be "${rootId}" (its root's ID)`,
          elementId,
          details: { expectedRootId: rootId, actualRootId: element.definition.rootId }
        });
      }

      if (element.definition.items) {
        element.definition.items.forEach(childId => checkDescendants(childId));
      }
    };

    if (root.definition.items) {
      root.definition.items.forEach(childId => checkDescendants(childId));
    }
  });
};

// 7. Validate page folders
export const validatePageFolders = ({ errors, pageFolders }: ValidationContext) => {
  const folderIds = new Set<string>();

  pageFolders.forEach((folder, index) => {
    if (!folder.id) {
      errors.push({ code: 'INVALID_FOLDER', message: `Page folder at index ${index} has no id` });
      return;
    }

    if (folderIds.has(folder.id)) {
      errors.push({ code: 'DUPLICATE_FOLDER', message: `Duplicate folder ID "${folder.id}"`, elementId: folder.id });
    }
    folderIds.add(folder.id);

    if (folder.parentId) {
      if (!folderIds.has(folder.parentId)) {
        errors.push({
          code: 'ORPHANED_FOLDER_PARENT',
          message: `Folder "${folder.id}" has non-existent parent "${folder.parentId}"`,
          elementId: folder.id,
          details: { parentId: folder.parentId }
        });
      }
    }
  });
};

// 7b. Shells that sit inside each other in a circle — a page using any of them could never finish rendering
export const validateLayoutCycles = ({ errors, getElement, layoutRootIds }: ValidationContext) => {
  const reported = new Set<string>();
  layoutRootIds().forEach(layoutId => {
    const cycle = findLayoutCycle(getElement, layoutId);
    if (cycle.length === 0 || reported.has(cycle[0])) {
      return;
    }

    cycle.forEach(id => reported.add(id));
    errors.push({
      code: 'LAYOUT_CYCLE',
      message: `Layouts sit inside each other in a circle: ${cycle.join(' → ')}`,
      elementId: layoutId,
      details: { cycle }
    });
  });
};

// 8. Detect orphaned elements (elements not reachable from any root)
export const validateOrphanedElements = ({ warnings, flat, baseElementId, getElement, rootIds }: ValidationContext) => {
  const reachable = new Set<string>();

  // Mark all elements reachable from the roots
  const markReachable = (elementId: string) => {
    if (reachable.has(elementId)) {
      return;
    }

    reachable.add(elementId);
    const element = getElement(elementId);
    if (element?.definition?.items) {
      element.definition.items.forEach(childId => markReachable(childId));
    }
  };

  /**
   * A root also reaches the layout it is rendered inside — which is another root, not a child of it.
   *
   * Two attributes name that shell and only one is the way in: `layout` is the layoutContainer element itself,
   * while `layoutContainer` is the container INSIDE it where this page's body is slotted. Walking from the slot
   * reaches the page's own subtree and nothing else, which is what made a space's whole chrome read as
   * unreachable. Both are marked, because a document that names a slot in a shell it does not name is still
   * describing something real.
   */
  const rootsMarked = new Set<string>();
  const markRoot = (elementId: string) => {
    if (rootsMarked.has(elementId)) {
      return;
    }

    rootsMarked.add(elementId);
    markReachable(elementId);
    const attributes = getElement(elementId)?.attributes;
    // A shell is a root of its own and may sit in another shell, so it is marked the way the page was.
    if (attributes?.layout) {
      markRoot(attributes.layout as string);
    }

    if (attributes?.layoutContainer) {
      markReachable(attributes.layoutContainer as string);
    }
  };

  if (baseElementId) {
    markRoot(baseElementId);
  } else {
    rootIds().forEach(markRoot);
  }

  /**
   * What is left is genuinely unreachable — and a ROOT is never that.
   *
   * A page nobody links to is still a page, and a layout shell no page uses yet is still a shell: both anchor
   * their own tree, and neither is meant to be found from somewhere else. Reporting either as an orphan reports
   * the space's own structure as a defect.
   */
  const roots = new Set(rootIds());
  Object.keys(flat).forEach(elementId => {
    const element = getElement(elementId);
    if (!element) {
      return;
    }

    if (!reachable.has(elementId) && element.definition.type !== 'page' && !roots.has(elementId)) {
      warnings.push({
        code: 'ORPHANED_ELEMENT',
        message: `Element "${elementId}" is not reachable from any page or layout`,
        elementId
      });
    }
  });
};
