import Button from '@plitzi/plitzi-ui/Button';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useState } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

import useCanvasVisitor from '../../hooks/useCanvasVisitor';

import type { CanvasVisitor } from '../../hooks/useCanvasVisitor';
import type { QueryParams, RouteParams } from '@plitzi/sdk-shared';
import type { ChangeEvent, KeyboardEvent } from 'react';

/** A case of the page kept to come back to: its state, its visitor and the address it is tried on. */
type Scenario = {
  name: string;
  state: Record<string, unknown>;
  visitor: CanvasVisitor;
  urlTest?: { routeParams: RouteParams; queryParams: QueryParams; hostname: string };
};

const NONE: Scenario[] = [];

/**
 * Cases of the page saved by name — "cart full", "onboarding, step 3" — each the whole context: the state, who visits
 * and the address. Kept in this browser, per space, and never in the space: they are how one person looks at it.
 */
const Scenarios = () => {
  const [[permanentUrl, state, urlTest]] = useBuilderStore([
    'schema.definition.permanentUrl',
    'runtime.state',
    'urlTest'
  ]);
  const [, setState] = useBuilderStore('runtime.state');
  const [, setUrlTest] = useBuilderStore('urlTest');
  const { visitor, choose } = useCanvasVisitor();
  const [scenarios = NONE, setScenarios] = useStorage<Scenario[]>(
    `builder-state.stateManager.scenarios.${permanentUrl}`,
    []
  );
  const [picked, setPicked] = useState('');
  const [naming, setNaming] = useState<string | undefined>(undefined);

  const handlePick = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const scenario = scenarios.find(each => each.name === e.target.value);
      setPicked(e.target.value);
      if (scenario) {
        setState(scenario.state);
        setUrlTest(scenario.urlTest);
        choose(scenario.visitor);
      }
    },
    [scenarios, setState, setUrlTest, choose]
  );

  const handleSave = useCallback(() => {
    const name = naming?.trim();
    if (!name) {
      setNaming(undefined);

      return;
    }

    const scenario: Scenario = { name, state: state ?? {}, visitor, ...(urlTest ? { urlTest } : {}) };
    setScenarios([...scenarios.filter(each => each.name !== name), scenario]);
    setPicked(name);
    setNaming(undefined);
  }, [naming, state, visitor, urlTest, scenarios, setScenarios]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSave();
      }

      if (e.key === 'Escape') {
        setNaming(undefined);
      }
    },
    [handleSave]
  );

  const handleRemove = useCallback(() => {
    setScenarios(scenarios.filter(each => each.name !== picked));
    setPicked('');
  }, [scenarios, picked, setScenarios]);

  if (naming !== undefined) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="grow">
          <Input
            size="xs"
            value={naming}
            placeholder="Name this case — cart full, step 3…"
            aria-label="Scenario name"
            autoFocus
            onChange={setNaming}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button size="xs" onClick={handleSave}>
          Save
        </Button>
        <Button size="xs" intent="secondary" onClick={() => setNaming(undefined)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <i className="fa-solid fa-bookmark text-ui-fg-subtle text-[11px]" aria-hidden />
      <select
        className="border-ui-line-strong bg-ui-field text-ui-fg min-w-0 grow rounded-md border px-2 py-1 text-xs"
        aria-label="Scenario"
        value={picked}
        onChange={handlePick}
      >
        <option value="">{scenarios.length > 0 ? 'Apply a saved case…' : 'No saved case yet'}</option>
        {scenarios.map(each => (
          <option key={each.name} value={each.name}>
            {each.name}
          </option>
        ))}
      </select>
      {picked && (
        <Button size="xs" intent="secondary" title={`Forget "${picked}"`} onClick={handleRemove}>
          <Button.Icon icon="fa-solid fa-trash-can" />
        </Button>
      )}
      <Button
        size="xs"
        intent="secondary"
        iconPlacement="before"
        title="Save the state, the visitor and the address"
        onClick={() => setNaming(picked)}
      >
        <Button.Icon icon="fa-solid fa-plus" />
        Save
      </Button>
    </div>
  );
};

export default Scenarios;
