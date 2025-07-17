import { produce } from 'immer';
import get from 'lodash/get';
import has from 'lodash/has';
import set from 'lodash/set';

import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';

import type { DropPosition } from '@plitzi/sdk-schema/helpers/FlatMap';
import type { Element, PageFolder, Schema, SchemaVariable } from '@plitzi/sdk-shared';

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

const SchemaReducer = (
  state: Schema,
  action: { type: keyof typeof SchemaActions } & Record<Exclude<string, 'type'>, unknown>
) => {
  switch (action.type) {
    case SchemaActions.SCHEMA_UPDATE:
      return { ...state, ...(action.schema as Schema) };

    case SchemaActions.SCHEMA_ADD_PAGE: {
      const { page } = action as { type: keyof typeof SchemaActions; page: Element };

      return produce(state, draft => {
        set(draft, 'flat', { ...draft.flat, [page.id]: page });
        draft.pages.push(page.id);
      });
    }

    case SchemaActions.SCHEMA_HOME_PAGE: {
      const { flat, pages } = state;
      const { pageId } = action as { type: keyof typeof SchemaActions; pageId: string };

      let oldPage: Element | undefined;
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
        set(draft.flat, `${(oldPage as Element).id}.attributes.default`, false);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_PAGE: {
      const { page } = action as { type: keyof typeof SchemaActions; page: Element };

      return produce(state, draft => {
        set(draft.flat, page.id, page);
      });
    }

    case SchemaActions.SCHEMA_REMOVE_PAGE: {
      const { pageId } = action as { type: keyof typeof SchemaActions; pageId: string };

      return produce(state, draft => {
        FlatMap.removeElement(draft.flat, pageId, true);
        draft.pages = draft.pages.filter(p => p !== pageId);
      });
    }

    case SchemaActions.SCHEMA_ADD_PAGE_FOLDER: {
      const { pageFolder } = action as { type: keyof typeof SchemaActions; pageFolder: PageFolder };

      return produce(state, draft => {
        draft.pageFolders.push(pageFolder);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_PAGE_FOLDER: {
      const { pageFolder } = action as { type: keyof typeof SchemaActions; pageFolder: PageFolder };

      return produce(state, draft => {
        const index = draft.pageFolders.findIndex(p => p.id === pageFolder.id);
        if (index === -1) {
          return;
        }

        draft.pageFolders[index] = pageFolder;
      });
    }

    case SchemaActions.SCHEMA_REMOVE_PAGE_FOLDER: {
      const { pageFolderId } = action as { type: keyof typeof SchemaActions; pageFolderId: string };

      return produce(state, draft => {
        draft.pageFolders = draft.pageFolders.filter(pageFolder => pageFolder.id !== pageFolderId);
      });
    }

    case SchemaActions.SCHEMA_ADD_VARIABLE: {
      const { variable } = action as { type: keyof typeof SchemaActions; variable: SchemaVariable };

      return produce(state, draft => {
        if (!draft.variables) {
          draft.variables = [];
        }

        draft.variables.push(variable);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_VARIABLE: {
      const { variable } = action as { type: keyof typeof SchemaActions; variable: SchemaVariable };

      return produce(state, draft => {
        const index = draft.variables?.findIndex(v => v.name === variable.name) ?? -1;
        if (index === -1 || !draft.variables?.[index]) {
          return;
        }

        draft.variables[index] = variable;
      });
    }

    case SchemaActions.SCHEMA_REMOVE_VARIABLE: {
      const { name } = action as { type: keyof typeof SchemaActions; name: string };

      return produce(state, draft => {
        draft.variables = draft.variables?.filter(variable => variable.name !== name) ?? [];
      });
    }

    case SchemaActions.SCHEMA_ADD_TEMPLATE:
    case SchemaActions.SCHEMA_ADD_ELEMENT: {
      const {
        to,
        data,
        dropPosition,
        initialItems,
        variables = []
      } = action as {
        type: keyof typeof SchemaActions;
        data: Element;
        variables?: SchemaVariable[];
        to: string;
        dropPosition: DropPosition;
        initialItems: { [key: string]: Element };
      };

      return produce(state, draft => {
        FlatMap.addElement(draft.flat, data, to, dropPosition, initialItems);
        if (variables.length > 0) {
          const variablesToAppend = variables.filter(variable => !draft.variables?.find(v => v.name === variable.name));
          set(draft, 'variables', [...(draft.variables ?? []), ...variablesToAppend]);
        }
      });
    }

    case SchemaActions.SCHEMA_REMOVE_ELEMENT: {
      const { elementId } = action as { type: keyof typeof SchemaActions; elementId: string };

      return produce(state, draft => {
        FlatMap.removeElement(draft.flat, elementId);
      });
    }

    case SchemaActions.SCHEMA_MOVE_ELEMENT: {
      const { from, to, elementId, dropPosition } = action as {
        type: keyof typeof SchemaActions;
        elementId: string;
        from: string;
        to: string;
        dropPosition: DropPosition;
      };

      return produce(state, draft => {
        FlatMap.moveElement(draft.flat, from, to, elementId, dropPosition);
      });
    }

    case SchemaActions.SCHEMA_CLONE_ELEMENT: {
      const { to, data, dropPosition, initialItems } = action as {
        type: keyof typeof SchemaActions;
        to: string;
        data: Element;
        dropPosition: DropPosition;
        initialItems: { [key: string]: Element };
      };

      return produce(state, draft => {
        FlatMap.addElement(draft.flat, data, to, dropPosition, initialItems);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_ELEMENT: {
      const { element } = action as { type: keyof typeof SchemaActions; element: Element };

      return produce(state, draft => {
        set(draft.flat, element.id, element);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_SETTINGS: {
      const { path, value } = action as {
        type: keyof typeof SchemaActions;
        path: string;
        value: string | number | boolean;
      };
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
