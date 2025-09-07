import { produce } from 'immer';
import get from 'lodash/get';
import has from 'lodash/has';
import set from 'lodash/set';

import FlatMap from './helpers/FlatMap';

import type { Schema, Element, DropPosition, PageFolder } from '@plitzi/sdk-shared';

export const SchemaActions = {
  SCHEMA_UPDATE: 'SCHEMA_UPDATE',
  SCHEMA_ADD_PAGE: 'SCHEMA_ADD_PAGE',
  SCHEMA_HOME_PAGE: 'SCHEMA_HOME_PAGE',
  SCHEMA_UPDATE_PAGE: 'SCHEMA_UPDATE_PAGE',
  SCHEMA_REMOVE_PAGE: 'SCHEMA_REMOVE_PAGE',
  SCHEMA_ADD_PAGE_FOLDER: 'SCHEMA_ADD_PAGE_FOLDER',
  SCHEMA_UPDATE_PAGE_FOLDER: 'SCHEMA_UPDATE_PAGE_FOLDER',
  SCHEMA_REMOVE_PAGE_FOLDER: 'SCHEMA_REMOVE_PAGE_FOLDER',
  SCHEMA_ADD_ELEMENT: 'SCHEMA_ADD_ELEMENT',
  SCHEMA_REMOVE_ELEMENT: 'SCHEMA_REMOVE_ELEMENT',
  SCHEMA_MOVE_ELEMENT: 'SCHEMA_MOVE_ELEMENT',
  SCHEMA_CLONE_ELEMENT: 'SCHEMA_CLONE_ELEMENT',
  SCHEMA_UPDATE_ELEMENT: 'SCHEMA_UPDATE_ELEMENT',
  SCHEMA_ADD_TEMPLATE: 'SCHEMA_ADD_TEMPLATE',
  SCHEMA_UPDATE_SETTINGS: 'SCHEMA_UPDATE_SETTINGS'
};

type Action = {
  type:
    | 'SCHEMA_UPDATE'
    | 'SCHEMA_ADD_PAGE'
    | 'SCHEMA_HOME_PAGE'
    | 'SCHEMA_UPDATE_PAGE'
    | 'SCHEMA_REMOVE_PAGE'
    | 'SCHEMA_ADD_PAGE_FOLDER'
    | 'SCHEMA_UPDATE_PAGE_FOLDER'
    | 'SCHEMA_REMOVE_PAGE_FOLDER'
    | 'SCHEMA_ADD_ELEMENT'
    | 'SCHEMA_REMOVE_ELEMENT'
    | 'SCHEMA_MOVE_ELEMENT'
    | 'SCHEMA_CLONE_ELEMENT'
    | 'SCHEMA_UPDATE_ELEMENT'
    | 'SCHEMA_ADD_TEMPLATE'
    | 'SCHEMA_UPDATE_SETTINGS';
  schema?: Schema;
  page?: Element;
  pageId?: Element['id'];
  pageFolder?: PageFolder;
  path?: string;
  value?: string;
  element?: Element;
  from?: Element['id'];
  to?: Element['id'];
  elementId?: Element['id'];
  pageFolderId?: string;
  data?: Element;
  dropPosition?: DropPosition;
  initialItems?: Record<Element['id'], Element>;
};

const SchemaReducer = (state: Schema, action: Partial<Action> = {}) => {
  switch (action.type) {
    case SchemaActions.SCHEMA_UPDATE:
      return { ...state, ...action.schema };

    case SchemaActions.SCHEMA_ADD_PAGE: {
      const { page } = action;
      if (!page) {
        return state;
      }

      return produce(state, draft => {
        set(draft, 'flat', { ...draft.flat, [page.id]: page });
        draft.pages.push(page.id);
      });
    }

    case SchemaActions.SCHEMA_HOME_PAGE: {
      const { flat, pages } = state;
      const { pageId } = action;
      if (!pageId) {
        return state;
      }

      let oldPage: Element | undefined;
      pages.forEach(pageIdItem => {
        if (oldPage) {
          return;
        }

        const auxPage = flat[pageIdItem];
        const defaultPage = get(auxPage, 'attributes.default', false) as boolean;
        if (defaultPage) {
          oldPage = auxPage;
        }
      });

      if (!oldPage) {
        return produce(state, draft => {
          set(draft.flat, `${pageId}.attributes.default`, true);
        });
      }

      return produce(state, draft => {
        set(draft.flat, `${pageId}.attributes.default`, true);
        if (oldPage) {
          set(draft.flat, `${oldPage.id}.attributes.default`, false);
        }
      });
    }

    case SchemaActions.SCHEMA_UPDATE_PAGE: {
      const { page } = action;
      if (!page) {
        return state;
      }

      return produce(state, draft => {
        set(draft.flat, page.id, page);
      });
    }

    case SchemaActions.SCHEMA_REMOVE_PAGE: {
      const { pageId } = action;
      if (!pageId) {
        return state;
      }

      return produce(state, draft => {
        FlatMap.removeElement(draft.flat, pageId, true);
        draft.pages = draft.pages.filter(p => p !== pageId);
      });
    }

    case SchemaActions.SCHEMA_ADD_PAGE_FOLDER: {
      const { pageFolder } = action;
      if (!pageFolder) {
        return state;
      }

      return produce(state, draft => {
        draft.pageFolders.push(pageFolder);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_PAGE_FOLDER: {
      const { pageFolder } = action;
      if (!pageFolder) {
        return state;
      }

      return produce(state, draft => {
        const index = draft.pageFolders.findIndex(p => p.id === pageFolder.id);
        if (index === -1) {
          return;
        }

        draft.pageFolders[index] = pageFolder;
      });
    }

    case SchemaActions.SCHEMA_REMOVE_PAGE_FOLDER: {
      const { pageFolderId } = action;
      if (!pageFolderId) {
        return state;
      }

      return produce(state, draft => {
        draft.pageFolders = draft.pageFolders.filter(pageFolder => pageFolder.id !== pageFolderId);
      });
    }

    case SchemaActions.SCHEMA_ADD_TEMPLATE:
    case SchemaActions.SCHEMA_ADD_ELEMENT: {
      const { to, data, dropPosition, initialItems } = action;
      if (!to || !data) {
        return state;
      }

      return produce(state, draft => {
        FlatMap.addElement(draft.flat, data, to, dropPosition, initialItems);
      });
    }

    case SchemaActions.SCHEMA_REMOVE_ELEMENT: {
      const { elementId } = action;
      if (!elementId) {
        return state;
      }

      return produce(state, draft => {
        FlatMap.removeElement(draft.flat, elementId);
      });
    }

    case SchemaActions.SCHEMA_MOVE_ELEMENT: {
      const { from, to, elementId, dropPosition } = action;
      if (!from || !to || !elementId) {
        return state;
      }

      return produce(state, draft => {
        FlatMap.moveElement(draft.flat, from, to, elementId, dropPosition);
      });
    }

    case SchemaActions.SCHEMA_CLONE_ELEMENT: {
      const { to, data, dropPosition, initialItems } = action;
      if (!to || !data) {
        return state;
      }

      return produce(state, draft => {
        FlatMap.addElement(draft.flat, data, to, dropPosition, initialItems);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_ELEMENT: {
      const { element } = action;
      if (!element) {
        return state;
      }

      return produce(state, draft => {
        set(draft.flat, element.id, element);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_SETTINGS: {
      const { path, value } = action;

      return produce(state, draft => {
        if (path && has(state.settings, path)) {
          set(draft.settings, path, value);
        } else if (!path) {
          set(draft, 'settings', value);
        }
      });
    }

    default:
      return state;
  }
};

export default SchemaReducer;
