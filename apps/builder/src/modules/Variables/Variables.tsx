import Flex from '@plitzi/plitzi-ui/Flex';
import Heading from '@plitzi/plitzi-ui/Heading';
import Input from '@plitzi/plitzi-ui/Input';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { use, useCallback, useMemo, useState } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';
import SchemaVariables from '@plitzi/sdk-variables/components/SchemaVariables';
import StyleVariables from '@plitzi/sdk-variables/components/StyleVariables';

import type { BuilderState, SchemaVariable, StyleVariableCategory, StyleVariableValue } from '@plitzi/sdk-shared';

const Variables = () => {
  const { showDialog } = useModal();
  const { addToast } = useToast();
  const { environment } = use(NetworkContext);
  const { routeParams, queryParams, hostname } = use(NavigationContext);
  const { builderHandler } = use(BuilderContext);
  const [filter, setFilter] = useState('');
  const whenData = useMemo(
    () => ({ routeParams, queryParams, hostname, environment }),
    [routeParams, queryParams, hostname, environment]
  );
  const { useStore } = createStoreHook<BuilderState>();
  const [[schemaVariables, styleVariables]] = useStore(['schema.variables', 'style.variables']);

  const variablesFiltered = useMemo(
    () =>
      ((schemaVariables as SchemaVariable[] | undefined) ?? []).filter(variable =>
        variable.name.toLowerCase().includes(filter.toLowerCase())
      ),
    [schemaVariables, filter]
  );

  // Schema Variables

  const handleAddSchemaVariable = useCallback(
    (variable: SchemaVariable) => {
      if (!schemaVariables.find(variableItem => variableItem.name === variable.name)) {
        builderHandler('schemaAddVariable', variable);
      } else {
        addToast(
          <span>
            Variable with the name <b>{variable.name}</b> already exists
          </span>,
          { appeareance: 'warning', autoDismiss: true, placement: 'top-right' }
        );
      }
    },
    [addToast, builderHandler, schemaVariables]
  );

  const handleUpdateSchemaVariable = useCallback(
    (variable: SchemaVariable) => builderHandler('schemaUpdateVariable', variable),
    [builderHandler]
  );

  const handleRemoveSchemaVariable = useCallback(
    async (name: string) => {
      const response = await showDialog(
        <Modal.Header>
          <h4>Remove Space Variable</h4>
        </Modal.Header>,
        <Modal.Body>
          <h4>Do you want to remove this item ?</h4>
        </Modal.Body>,
        undefined,
        { size: 'sm' },
        name
      );

      if (response) {
        builderHandler('schemaRemoveVariable', name);
      }
    },
    [builderHandler, showDialog]
  );

  // Style Variables

  const handleAddStyleVariable = useCallback(
    (variable: { name: string; category: StyleVariableCategory; value: StyleVariableValue }) => {
      const { name, category, value } = variable;
      if (!styleVariables[category]?.[name]) {
        builderHandler('styleAddVariable', category, name, value);
      } else {
        addToast(
          <span>
            Variable with the name <b>{name}</b> already exists
          </span>,
          { appeareance: 'warning', autoDismiss: true, placement: 'top-right' }
        );
      }
    },
    [addToast, builderHandler, styleVariables]
  );

  const handleUpdateStyleVariable = useCallback(
    (variable: { name: string; category: StyleVariableCategory; value: StyleVariableValue }) =>
      builderHandler('styleUpdateVariable', variable.category, variable.name, variable.value),
    [builderHandler]
  );

  const handleRemoveStyleVariable = useCallback(
    async (category: StyleVariableCategory, name: string) => {
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
        builderHandler('styleRemoveVariable', category, name);
      }
    },
    [builderHandler, showDialog]
  );

  return (
    <div className="flex h-full w-full flex-col gap-2 p-2">
      <Flex gap={2} direction="column">
        <Input placeholder="Search Variables" size="xs" value={filter} onChange={setFilter}>
          <Input.Icon icon="fa-solid fa-magnifying-glass" />
        </Input>
      </Flex>
      <div className="min-h-px w-full bg-gray-300 dark:bg-zinc-700" />
      <SchemaVariables
        className="min-h-0 grow basis-0"
        variables={variablesFiltered}
        whenData={whenData}
        onAdd={handleAddSchemaVariable}
        onUpdate={handleUpdateSchemaVariable}
        onRemove={handleRemoveSchemaVariable}
      />
      <div className="min-h-px w-full bg-gray-300 dark:bg-zinc-700" />
      <div className="flex grow basis-0 flex-col pb-2">
        <Heading as="h6">Style Variables</Heading>
        <StyleVariables
          className="min-h-0 grow basis-0"
          variables={styleVariables}
          onAdd={handleAddStyleVariable}
          onUpdate={handleUpdateStyleVariable}
          onRemove={handleRemoveStyleVariable}
        />
      </div>
    </div>
  );
};

export default Variables;
