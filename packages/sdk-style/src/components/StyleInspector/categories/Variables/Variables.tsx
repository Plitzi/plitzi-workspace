import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { use, useCallback } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import StyleVariables from '@plitzi/sdk-variables/components/StyleVariables';

import CategoryContainer from '../../components/CategoryContainer';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleVariableCategory, StyleVariableValue } from '@plitzi/sdk-shared';

export type VariablesProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Variables = ({ isCollapsed, onCollapse }: VariablesProps) => {
  const { displayMode, selector } = use(StyleInspectorContext);
  const { builderHandler } = use(BuilderContext);
  const { showDialog } = useModal();
  const { addToast } = useToast();

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('variables', isCollapsed), [onCollapse]);

  const handleAddStyleVariable = useCallback(
    (variable: { name: string; category: StyleVariableCategory; value: StyleVariableValue }) => {
      if (!selector) {
        return;
      }

      const { name, category, value } = variable;
      if (!selector.variables?.[category]?.[name]) {
        builderHandler('styleAddSelectorVariable', displayMode, selector.name, category, name, value);
      } else {
        addToast(
          <span>
            Variable with the name <b>{name}</b> already exists
          </span>,
          { appeareance: 'warning', autoDismiss: true, placement: 'top-right' }
        );
      }
    },
    [addToast, builderHandler, displayMode, selector]
  );

  const handleUpdateStyleVariable = useCallback(
    (variable: { name: string; category: StyleVariableCategory; value: StyleVariableValue }) => {
      if (!selector) {
        return;
      }

      builderHandler(
        'styleUpdateSelectorVariable',
        displayMode,
        selector.name,
        variable.category,
        variable.name,
        variable.value
      );
    },
    [builderHandler, displayMode, selector]
  );

  const handleRemoveStyleVariable = useCallback(
    async (category: StyleVariableCategory, name: string) => {
      if (!selector) {
        return;
      }

      const response = await showDialog(
        <Modal.Header>
          <h4>Remove Style Variable</h4>
        </Modal.Header>,
        <Modal.Body>
          <h4>Do you want to remove this item ?</h4>
        </Modal.Body>,
        undefined,
        { size: 'sm' },
        name
      );

      if (response) {
        builderHandler('styleRemoveSelectorVariable', displayMode, selector.name, category, name);
      }
    },
    [builderHandler, displayMode, selector, showDialog]
  );

  if (!selector) {
    return undefined;
  }

  return (
    <CategoryContainer title="Variables" isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <StyleVariables
        variables={selector.variables}
        onAdd={handleAddStyleVariable}
        onUpdate={handleUpdateStyleVariable}
        onRemove={handleRemoveStyleVariable}
      />
    </CategoryContainer>
  );
};

export default Variables;
