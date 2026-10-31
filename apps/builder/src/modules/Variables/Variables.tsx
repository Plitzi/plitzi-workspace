import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { use, useCallback, useMemo, useState } from 'react';

import { isStyleVariableCategory } from '@plitzi/sdk-shared';
import { BuilderContext } from '@plitzi/sdk-shared/builder/contexts';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { SchemaVariables, StyleVariables } from '@plitzi/sdk-variables/builder';
import EmptyState from '@pmodules/App/components/EmptyState';
import PanelSearch from '@pmodules/App/components/PanelSearch';
import PanelToolbar from '@pmodules/App/components/PanelToolbar';
import ViewTabs from '@pmodules/App/components/ViewTabs';
import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

import UrlParams from './components/UrlParams';

import type { SchemaVariable, StyleVariableCategory, StyleVariableGroup, StyleVariableValue } from '@plitzi/sdk-shared';

/** The kinds of variables, each a tab: the space's own, the style's tokens, and the address the page reads. */
const VARIABLES_TABS = [
  { id: 'space', label: 'Space' },
  { id: 'style', label: 'Style' },
  { id: 'url', label: 'URL' }
] as const;

type VariablesTab = (typeof VARIABLES_TABS)[number]['id'];

const isVariablesTab = (value: string): value is VariablesTab => VARIABLES_TABS.some(each => each.id === value);

const Variables = () => {
  const { showDialog } = useModal();
  // The tab last open, open again — as every panel's sections are.
  const [storedTab, setTab] = useStorage<string>('builder-state.variables.tab', 'space');
  const [adding, setAdding] = useState(false);
  const { addToast } = useToast();
  const { environment } = useBuilderNetwork();
  const { builderHandler } = use(BuilderContext);
  const [filter, setFilter] = useState('');
  const [[schemaVariables, styleVariables, routeParams = {}, queryParams = {}, hostname = '']] = useBuilderStore([
    'schema.variables',
    'style.variables',
    'navigation.routeParams',
    'navigation.queryParams',
    'navigation.hostname'
  ]);
  const whenData = useMemo(
    () => ({ routeParams, queryParams, hostname, environment }),
    [routeParams, queryParams, hostname, environment]
  );

  const variablesFiltered = useMemo(
    () =>
      ((schemaVariables as SchemaVariable[] | undefined) ?? []).filter(variable =>
        variable.name.toLowerCase().includes(filter.toLowerCase())
      ),
    [schemaVariables, filter]
  );

  const styleVariablesFiltered = useMemo(() => {
    const result = Object.entries(styleVariables).reduce(
      (acc, [category, variables]) => {
        const filtered = Object.entries(variables).filter(([name]) =>
          name.toLowerCase().includes(filter.toLowerCase())
        );

        if (isStyleVariableCategory(category) && filtered.length > 0) {
          acc[category] = Object.fromEntries(filtered);
        }

        return acc;
      },
      {} as Record<StyleVariableCategory, StyleVariableGroup>
    );

    return result;
  }, [styleVariables, filter]);

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
          <h4>Remove space variable</h4>
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
          <h4>Remove style variable</h4>
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

  const tab: VariablesTab = isVariablesTab(storedTab) ? storedTab : 'space';
  const handleTab = useCallback(
    (next: VariablesTab) => {
      setTab(next);
      setAdding(false);
    },
    [setTab]
  );
  const handleAdd = useCallback(() => setAdding(true), []);
  const handleAddingEnd = useCallback(() => setAdding(false), []);

  return (
    <div className="flex h-full w-full flex-col gap-3 p-2">
      <PanelToolbar action={tab === 'url' || adding ? undefined : { label: 'New variable', onClick: handleAdd }}>
        <PanelSearch placeholder="Search variables" value={filter} onChange={setFilter} />
      </PanelToolbar>
      <ViewTabs tabs={VARIABLES_TABS} selected={tab} onSelect={handleTab} />
      <div className="flex min-h-0 grow basis-0 flex-col">
        {tab === 'space' && (
          <SchemaVariables
            className="min-h-0 grow basis-0"
            variables={variablesFiltered}
            whenData={whenData}
            adding={adding}
            empty={
              <EmptyState
                size="panel"
                icon="fa-solid fa-sliders"
                title={filter ? 'No space variable matches' : 'No space variables yet'}
                description="A value the whole space reads — a name, a price, a switch — changed in one place."
              />
            }
            onAddingEnd={handleAddingEnd}
            onAdd={handleAddSchemaVariable}
            onUpdate={handleUpdateSchemaVariable}
            onRemove={handleRemoveSchemaVariable}
          />
        )}
        {tab === 'style' && (
          <StyleVariables
            className="min-h-0 grow basis-0"
            variables={styleVariablesFiltered}
            adding={adding}
            empty={
              <EmptyState
                size="panel"
                icon="fa-solid fa-palette"
                title={filter ? 'No style variable matches' : 'No style variables yet'}
                description="A colour, a spacing or a shadow every style reads, for light and dark at once."
              />
            }
            onAddingEnd={handleAddingEnd}
            onAdd={handleAddStyleVariable}
            onUpdate={handleUpdateStyleVariable}
            onRemove={handleRemoveStyleVariable}
          />
        )}
        {/* Beside the variables on purpose: the URL is what most `when` rules switch on, so the inputs and what
            they decide are read in one place. */}
        {tab === 'url' && <UrlParams className="min-h-0 grow basis-0" />}
      </div>
    </div>
  );
};

export default Variables;
