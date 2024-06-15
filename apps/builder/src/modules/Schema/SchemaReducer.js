// Packages
import get from 'lodash/get';
import set from 'lodash/set';
import { produce } from 'immer';
import has from 'lodash/has';

// Relatives
import FlatMap from '@plitzi/sdk-schema/FlatMap';

export const SchemaActions = {
  SCHEMA_UPDATE: 'SCHEMA_UPDATE',
  SCHEMA_ADD_PAGE: 'SCHEMA_ADD_PAGE',
  SCHEMA_HOME_PAGE: 'SCHEMA_HOME_PAGE',
  SCHEMA_UPDATE_PAGE: 'SCHEMA_UPDATE_PAGE',
  SCHEMA_REMOVE_PAGE: 'SCHEMA_REMOVE_PAGE',
  SCHEMA_ADD_PAGE_FOLDER: 'SCHEMA_ADD_PAGE_FOLDER',
  SCHEMA_UPDATE_PAGE_FOLDER: 'SCHEMA_UPDATE_PAGE_FOLDER',
  SCHEMA_REMOVE_PAGE_FOLDER: 'SCHEMA_REMOVE_PAGE_FOLDER',
  SCHEMA_ADD_VARIABLE: 'SCHEMA_ADD_VARIABLE',
  SCHEMA_UPDATE_VARIABLE: 'SCHEMA_UPDATE_VARIABLE',
  SCHEMA_REMOVE_VARIABLE: 'SCHEMA_REMOVE_VARIABLE',
  SCHEMA_ADD_ELEMENT: 'SCHEMA_ADD_ELEMENT',
  SCHEMA_REMOVE_ELEMENT: 'SCHEMA_REMOVE_ELEMENT',
  SCHEMA_MOVE_ELEMENT: 'SCHEMA_MOVE_ELEMENT',
  SCHEMA_CLONE_ELEMENT: 'SCHEMA_CLONE_ELEMENT',
  SCHEMA_UPDATE_ELEMENT: 'SCHEMA_UPDATE_ELEMENT',
  SCHEMA_ADD_TEMPLATE: 'SCHEMA_ADD_TEMPLATE',
  SCHEMA_UPDATE_SETTINGS: 'SCHEMA_UPDATE_SETTINGS'
};

const SchemaReducer = (state, action = {}) => {
  switch (action.type) {
    case SchemaActions.SCHEMA_UPDATE:
      return {
        ...state,
        ...action.schema
      };

    case SchemaActions.SCHEMA_ADD_PAGE: {
      const { page } = action;

      return produce(state, draft => {
        set(draft, 'flat', { ...draft.flat, [page.id]: page });
        draft.pages.push(page.id);
      });
    }

    case SchemaActions.SCHEMA_HOME_PAGE: {
      const { flat, pages } = state;
      const { pageId } = action;

      let oldPage;
      pages.forEach(pageId => {
        if (oldPage) {
          return;
        }

        const auxPage = flat[pageId];
        const defaultPage = get(auxPage, 'attributes.default', false);
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
        set(draft.flat, `${oldPage.id}.attributes.default`, false);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_PAGE: {
      const { page } = action;

      return produce(state, draft => {
        set(draft.flat, page.id, page);
      });
    }

    case SchemaActions.SCHEMA_REMOVE_PAGE: {
      const { pageId } = action;

      return produce(state, draft => {
        FlatMap.remove(draft.flat, pageId, pageId, true);
        draft.pages = draft.pages.filter(p => p !== pageId);
      });
    }

    case SchemaActions.SCHEMA_ADD_PAGE_FOLDER: {
      const { pageFolder } = action;

      return produce(state, draft => {
        draft.pageFolders.push(pageFolder);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_PAGE_FOLDER: {
      const { pageFolder } = action;

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

      return produce(state, draft => {
        draft.pageFolders = draft.pageFolders.filter(pageFolder => pageFolder.id !== pageFolderId);
      });
    }

    case SchemaActions.SCHEMA_ADD_VARIABLE: {
      const { variable } = action;

      return produce(state, draft => {
        draft.variables.push(variable);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_VARIABLE: {
      const { variable } = action;

      return produce(state, draft => {
        const index = draft.variables.findIndex(v => v.name === variable.name);
        if (index === -1) {
          return;
        }

        draft.variables[index] = variable;
      });
    }

    case SchemaActions.SCHEMA_REMOVE_VARIABLE: {
      const { name } = action;

      return produce(state, draft => {
        draft.variables = draft.variables.filter(variable => variable.name !== name);
      });
    }

    case SchemaActions.SCHEMA_ADD_TEMPLATE:
    case SchemaActions.SCHEMA_ADD_ELEMENT: {
      const { to, data, dropPosition, initialItems } = action;

      return produce(state, draft => {
        FlatMap.add(draft.flat, to, data, dropPosition, initialItems);
      });
    }

    case SchemaActions.SCHEMA_REMOVE_ELEMENT: {
      const { elementId } = action;

      return produce(state, draft => {
        FlatMap.remove(draft.flat, elementId);
      });
    }

    case SchemaActions.SCHEMA_MOVE_ELEMENT: {
      const { from, to, elementId, dropPosition } = action;

      return produce(state, draft => {
        FlatMap.move(draft.flat, from, to, elementId, dropPosition);
      });
    }

    case SchemaActions.SCHEMA_CLONE_ELEMENT: {
      const { to, data, dropPosition, initialItems } = action;

      return produce(state, draft => {
        FlatMap.add(draft.flat, to, data, dropPosition, initialItems);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_ELEMENT: {
      const { element } = action;

      return produce(state, draft => {
        set(draft.flat, element.id, element);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_SETTINGS: {
      return produce(state, draft => {
        if (action.path && has(state.settings, action.path)) {
          set(draft.settings, action.path, action.value);
        } else if (!action.path) {
          set(draft, 'settings', action.value);
        }
      });
    }

    default:
      return state;
  }
};

export default SchemaReducer;
