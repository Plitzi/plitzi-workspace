import { get, set, has } from '@plitzi/plitzi-ui/helpers';
import { produce } from 'immer';

import {
  addComponent,
  detachInstance,
  flatMapOf,
  removeComponent,
  renameElement,
  updateComponent
} from './helpers/components';
import FlatMap from './helpers/FlatMap';

import type {
  Element,
  PageFolder,
  ReducerActionOrigin,
  Schema,
  SnippetStyle,
  SchemaFlag,
  SchemaVariable,
  DropPosition,
  SpaceComponent,
  SpaceComponentDeclaration
} from '@plitzi/sdk-shared';

/** Variables a snippet brought with it, minus the ones this space already declares under the same name. */
const appendVariables = (draft: Schema, variables: SchemaVariable[]): void => {
  if (variables.length === 0) {
    return;
  }

  const variablesToAppend = variables.filter(
    variable =>
      (draft.variables as SchemaVariable[] | undefined) && !draft.variables.find(v => v.name === variable.name)
  );

  set(draft, 'variables', [...((draft.variables as SchemaVariable[] | undefined) ?? []), ...variablesToAppend]);
};

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
  SCHEMA_SET_FLAG: 'SCHEMA_SET_FLAG',
  SCHEMA_REMOVE_FLAG: 'SCHEMA_REMOVE_FLAG',
  SCHEMA_ADD_ELEMENT: 'SCHEMA_ADD_ELEMENT',
  SCHEMA_REMOVE_ELEMENT: 'SCHEMA_REMOVE_ELEMENT',
  SCHEMA_MOVE_ELEMENT: 'SCHEMA_MOVE_ELEMENT',
  SCHEMA_CLONE_ELEMENT: 'SCHEMA_CLONE_ELEMENT',
  SCHEMA_UPDATE_ELEMENT: 'SCHEMA_UPDATE_ELEMENT',
  SCHEMA_RENAME_ELEMENT: 'SCHEMA_RENAME_ELEMENT',
  SCHEMA_UPDATE_ELEMENTS: 'SCHEMA_UPDATE_ELEMENTS',
  SCHEMA_ADD_SNIPPET: 'SCHEMA_ADD_SNIPPET',
  SCHEMA_UPDATE_SETTINGS: 'SCHEMA_UPDATE_SETTINGS',
  SCHEMA_ADD_COMPONENT: 'SCHEMA_ADD_COMPONENT',
  SCHEMA_UPDATE_COMPONENT: 'SCHEMA_UPDATE_COMPONENT',
  SCHEMA_REMOVE_COMPONENT: 'SCHEMA_REMOVE_COMPONENT',
  SCHEMA_DETACH_INSTANCE: 'SCHEMA_DETACH_INSTANCE'
} as const;

// `queryFailed` marks the save queue putting back the state a rejected mutation left behind — see `isUserEdit`.
export type SchemaReducerActionsBase = ReducerActionOrigin;

export type SchemaReducerActions = SchemaReducerActionsBase &
  (
    | { type: 'SCHEMA_UPDATE'; schema: Schema }
    | { type: 'SCHEMA_ADD_PAGE'; page: Element }
    | { type: 'SCHEMA_HOME_PAGE'; pageId: string }
    | { type: 'SCHEMA_UPDATE_PAGE'; page: Element }
    | { type: 'SCHEMA_REMOVE_PAGE'; pageId: string }
    | { type: 'SCHEMA_ADD_PAGE_FOLDER'; pageFolder: PageFolder }
    | { type: 'SCHEMA_UPDATE_PAGE_FOLDER'; pageFolder: PageFolder }
    | { type: 'SCHEMA_REMOVE_PAGE_FOLDER'; pageFolderId: string }
    | { type: 'SCHEMA_ADD_VARIABLE'; variable: SchemaVariable }
    | { type: 'SCHEMA_UPDATE_VARIABLE'; variable: SchemaVariable }
    | { type: 'SCHEMA_REMOVE_VARIABLE'; name: string }
    | { type: 'SCHEMA_SET_FLAG'; name: string; flag: SchemaFlag }
    | { type: 'SCHEMA_REMOVE_FLAG'; name: string }
    | {
        type: 'SCHEMA_ADD_ELEMENT' | 'SCHEMA_ADD_SNIPPET';
        to: string;
        data: Element;
        dropPosition: DropPosition;
        initialItems: Record<string, Element>;
        variables?: SchemaVariable[];
        style?: SnippetStyle; // used when adding a snippet
      }
    | { type: 'SCHEMA_REMOVE_ELEMENT'; elementId: string }
    | {
        type: 'SCHEMA_MOVE_ELEMENT';
        elementId: string;
        from: string;
        to: string;
        dropPosition: DropPosition;
      }
    | {
        type: 'SCHEMA_CLONE_ELEMENT';
        to: string;
        data: Element;
        dropPosition: DropPosition;
        initialItems: Record<string, Element>;
      }
    | { type: 'SCHEMA_UPDATE_ELEMENT'; element: Element }
    | { type: 'SCHEMA_RENAME_ELEMENT'; elementId: string; id: string }
    | { type: 'SCHEMA_UPDATE_ELEMENTS'; elements: Element[] }
    | {
        type: 'SCHEMA_UPDATE_SETTINGS';
        path: string;
        value: string | number | boolean;
      }
    | {
        type: 'SCHEMA_ADD_COMPONENT';
        component: SpaceComponent;
        from?: { elementId: Element['id']; instanceId: Element['id'] };
      }
    | { type: 'SCHEMA_UPDATE_COMPONENT'; componentId: SpaceComponent['id']; declaration: SpaceComponentDeclaration }
    | { type: 'SCHEMA_REMOVE_COMPONENT'; componentId: SpaceComponent['id'] }
    | { type: 'SCHEMA_DETACH_INSTANCE'; instanceId: Element['id'] }
  );

const SchemaReducer = (state: Schema, action: SchemaReducerActions) => {
  switch (action.type) {
    case SchemaActions.SCHEMA_UPDATE:
      return { ...state, ...action.schema };

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

      let oldPage: Element | undefined;
      pages.forEach(pageId => {
        if (oldPage) {
          return;
        }

        const auxPage = flat[pageId];
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
        set(draft.flat, `${(oldPage as Element).id}.attributes.default`, false);
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
        FlatMap.removeElement(draft.flat, pageId, true);
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
        if (!(draft.variables as SchemaVariable[] | undefined)) {
          draft.variables = [];
        }

        draft.variables.push(variable);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_VARIABLE: {
      const { variable } = action;
      if (!(state.variables as SchemaVariable[] | undefined)) {
        return state;
      }

      return produce(state, draft => {
        const index = draft.variables.findIndex(v => v.name === variable.name);
        if (!draft.variables[index]) {
          return;
        }

        draft.variables[index] = variable;
      });
    }

    case SchemaActions.SCHEMA_REMOVE_VARIABLE: {
      const { name } = action;
      if (!(state.variables as SchemaVariable[] | undefined)) {
        return state;
      }

      return produce(state, draft => {
        draft.variables = draft.variables.filter(variable => variable.name !== name);
      });
    }

    // A flag is keyed by the name it is read by, so declaring one and changing it are the same write.
    case SchemaActions.SCHEMA_SET_FLAG: {
      const { name, flag } = action;

      return produce(state, draft => {
        draft.flags = { ...draft.flags, [name]: flag };
      });
    }

    case SchemaActions.SCHEMA_REMOVE_FLAG: {
      const { name } = action;
      if (!state.flags || !Object.hasOwn(state.flags, name)) {
        return state;
      }

      return produce(state, draft => {
        const { [name]: _removed, ...rest } = draft.flags ?? {};
        draft.flags = rest;
      });
    }

    case SchemaActions.SCHEMA_ADD_ELEMENT: {
      const { to, data, dropPosition, initialItems, variables = [] } = action;

      return produce(state, draft => {
        flatMapOf(draft, to)?.addElement(data, to, dropPosition, initialItems);
        appendVariables(draft, variables);
      });
    }

    case SchemaActions.SCHEMA_ADD_SNIPPET: {
      const { to, data, dropPosition, initialItems, variables = [] } = action;

      return produce(state, draft => {
        // Inserted under the names the action carries, as the server does: `fitSnippet` chose them where the snippet
        // was dropped, so a name taken since is refused here too. Copied: the payload is the dispatcher's.
        const { [data.id]: element, ...items } = structuredClone({ ...initialItems, [data.id]: data });

        if (flatMapOf(draft, to)?.addElement(element, to, dropPosition, items)) {
          appendVariables(draft, variables);
        }
      });
    }

    case SchemaActions.SCHEMA_REMOVE_ELEMENT: {
      const { elementId } = action;

      return produce(state, draft => {
        flatMapOf(draft, elementId)?.removeElement(elementId);
      });
    }

    case SchemaActions.SCHEMA_MOVE_ELEMENT: {
      const { from, to, elementId, dropPosition } = action;

      return produce(state, draft => {
        // A move stays inside one tree: taking a subtree into a component, or out of one, is its own operation.
        const map = flatMapOf(draft, elementId);
        if (map && Object.hasOwn(map.flat, to)) {
          map.moveElement(from, to, elementId, dropPosition);
        }
      });
    }

    case SchemaActions.SCHEMA_CLONE_ELEMENT: {
      const { to, data, dropPosition, initialItems } = action;

      return produce(state, draft => {
        flatMapOf(draft, to)?.addElement(data, to, dropPosition, initialItems);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_ELEMENT: {
      const { element } = action;

      return produce(state, draft => {
        flatMapOf(draft, element.id)?.updateElement(element);
      });
    }

    case SchemaActions.SCHEMA_RENAME_ELEMENT: {
      const { elementId, id } = action;

      return produce(state, draft => {
        // The whole document, not just the element's tree: a page renamed without its entry in `pages` is a page the
        // space no longer lists, and a component's tree can name it too.
        renameElement(draft, elementId, id);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_ELEMENTS: {
      const { elements } = action;

      return produce(state, draft => {
        elements.forEach(element => flatMapOf(draft, element.id)?.updateElement(element));
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

    case SchemaActions.SCHEMA_ADD_COMPONENT: {
      const { component, from } = action;

      return produce(state, draft => {
        addComponent(draft, structuredClone(component), from);
      });
    }

    case SchemaActions.SCHEMA_UPDATE_COMPONENT: {
      const { componentId, declaration } = action;

      return produce(state, draft => {
        updateComponent(draft, componentId, declaration);
      });
    }

    case SchemaActions.SCHEMA_REMOVE_COMPONENT: {
      const { componentId } = action;

      return produce(state, draft => {
        removeComponent(draft, componentId);
      });
    }

    case SchemaActions.SCHEMA_DETACH_INSTANCE: {
      const { instanceId } = action;

      return produce(state, draft => {
        detachInstance(draft, instanceId);
      });
    }

    default:
      return state;
  }
};

export default SchemaReducer;
