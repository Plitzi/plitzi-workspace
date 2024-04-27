// Packages
import React, { useCallback, useContext, useMemo, useReducer, useRef } from 'react';

// Monorepo
import FlatMap from '@plitzi/sdk-schema/FlatMap';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';
import NetworkInternalContext from '@pmodules/Network/contexts/NetworkInternalContext';

// Relatives
import TemplatesContext from './TemplatesContext';
import TemplatesReducer, { TemplatesActions } from './TemplatesReducer';

/**
 * @param {{
 *   children: React.ReactNode;
 *   templates?: any;
 * }} props
 * @returns {React.ReactElement}
 */
const TemplatesContextProvider = props => {
  const { children, templates: templatesProp } = props;
  const { mutate } = useContext(NetworkContext);
  const internalData = useContext(NetworkInternalContext);
  const templatesPropMemo = useMemo(() => {
    if (templatesProp) {
      return templatesProp;
    }

    return internalData.templates ?? {};
  }, [templatesProp]);
  const [templates, dispatchTemplates] = useReducer(TemplatesReducer, templatesPropMemo);
  const templatesRef = useRef(templates);
  templatesRef.current = templates;

  const templatesAdd = useCallback(
    template => dispatchTemplates({ type: TemplatesActions.TEMPLATES_ADD, template }),
    [dispatchTemplates]
  );

  const templatesUpdate = useCallback(
    template => dispatchTemplates({ type: TemplatesActions.TEMPLATES_UPDATE, template }),
    [dispatchTemplates]
  );

  const templatesRemove = useCallback(
    templateId => dispatchTemplates({ type: TemplatesActions.TEMPLATES_REMOVE, templateId }),
    [dispatchTemplates]
  );

  const templatesAddMutation = useCallback(async (name, description, schema, style) => {
    const result = await mutate('TemplateAdd', { name, description, schema, style });
    if (result) {
      templatesAdd(result);
    }
  }, []);

  const templatesUpdateMutation = useCallback(async template => {
    const result = await mutate('TemplateUpdate', { id: template.id, template });
    if (result) {
      templatesUpdate(result);
    }
  }, []);

  const templatesRemoveMutation = useCallback(id => {
    if (mutate('TemplateRemove', { id })) {
      templatesRemove(id);
    }
  }, []);

  const elementAsTemplate = useCallback(
    async (flat, style, name, description, element) => {
      const { elements, elementsStyle } = FlatMap.flatAsTemplate(flat, style, element?.id);
      const result = await mutate('TemplateAdd', {
        name,
        description,
        baseElementId: elements.item.id,
        elements: elements.acum,
        style: { ...elementsStyle, cache: generateCache(elementsStyle) }
      });
      if (result) {
        templatesAdd(result);
      }
    },
    [templatesAdd]
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

  return <TemplatesContext.Provider value={templateContextValue}>{children}</TemplatesContext.Provider>;
};

export default TemplatesContextProvider;
