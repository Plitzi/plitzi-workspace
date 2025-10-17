import { useCallback, use, useMemo, useReducer, useRef } from 'react';

import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';
import NetworkInternalContext from '@pmodules/Network/contexts/NetworkInternalContext';

import TemplatesContext from './TemplatesContext';
import TemplatesReducer, { TemplatesActions } from './TemplatesReducer';

import type { Template } from './TemplatesContext';
import type { BuilderNetworkContextValue, Element, Schema, Style } from '@plitzi/sdk-shared';
import type { MutationsMap } from '@pmodules/Network/Mutations';
import type { QueriesMap } from '@pmodules/Network/Queries';
import type { ReactNode } from 'react';

export type TemplatesContextProviderProps = {
  children?: ReactNode;
  templates?: Record<string, Template>;
};

const TemplatesContextProvider = ({ children, templates: templatesProp }: TemplatesContextProviderProps) => {
  const { mutate } = use(NetworkContext) as BuilderNetworkContextValue<QueriesMap, MutationsMap>;
  const internalData = use(NetworkInternalContext);
  const templatesPropMemo = useMemo(() => {
    if (templatesProp) {
      return templatesProp;
    }

    return internalData.templates;
  }, [internalData.templates, templatesProp]);
  const [templates, dispatchTemplates] = useReducer(TemplatesReducer, templatesPropMemo);
  const templatesRef = useRef(templates);
  templatesRef.current = templates;

  const templatesAdd = useCallback(
    (template: Template) => dispatchTemplates({ type: TemplatesActions.TEMPLATES_ADD, template }),
    [dispatchTemplates]
  );

  const templatesUpdate = useCallback(
    (template: Template) => dispatchTemplates({ type: TemplatesActions.TEMPLATES_UPDATE, template }),
    [dispatchTemplates]
  );

  const templatesRemove = useCallback(
    (templateId: string) => dispatchTemplates({ type: TemplatesActions.TEMPLATES_REMOVE, templateId }),
    [dispatchTemplates]
  );

  const templatesAddMutation = useCallback(
    async (name: string, description: string, schema?: Schema, style?: Style) => {
      const response = await mutate('TemplateAdd', { name, description, schema, style });
      if (response.result) {
        templatesAdd(response.result);
      }
    },
    [mutate, templatesAdd]
  );

  const templatesUpdateMutation = useCallback(
    async (template: Template) => {
      const response = await mutate('TemplateUpdate', { id: template.id, template });
      if (response.result) {
        templatesUpdate(response.result);
      }
    },
    [mutate, templatesUpdate]
  );

  const templatesRemoveMutation = useCallback(
    async (id: string) => {
      const result = await mutate('TemplateRemove', { id });
      if (result as typeof result | undefined) {
        templatesRemove(id);
      }
    },
    [mutate, templatesRemove]
  );

  const elementAsTemplate = useCallback(
    async (schema: Schema, style: Style, name: string, description: string, element: Element) => {
      const { elements, elementsStyle, variables } = FlatMap.flatAsTemplate(schema, style, element.id);
      if (!elements.item) {
        return;
      }

      const response = await mutate('TemplateAdd', {
        name,
        description,
        baseElementId: elements.item.id,
        elements: elements.acum,
        style: { ...elementsStyle, cache: generateCache(elementsStyle) },
        variables
      });
      if (response.result) {
        templatesAdd(response.result);
      }
    },
    [mutate, templatesAdd]
  );

  const templateContextValue = useMemo(
    () => ({
      templates,
      templatesAdd,
      templatesUpdate,
      templatesRemove,
      elementAsTemplate,
      templatesAddMutation,
      templatesUpdateMutation,
      templatesRemoveMutation
    }),
    [
      templates,
      templatesAdd,
      templatesUpdate,
      templatesRemove,
      elementAsTemplate,
      templatesAddMutation,
      templatesUpdateMutation,
      templatesRemoveMutation
    ]
  );

  return <TemplatesContext value={templateContextValue}>{children}</TemplatesContext>;
};

export default TemplatesContextProvider;
