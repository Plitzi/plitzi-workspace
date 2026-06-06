import { createStoreHook } from '@plitzi/nexus/createStore';

import VariablesList from './VariablesList';
import VariablesStyleList from './VariablesStyleList';

import type { CommonState } from '@plitzi/sdk-shared';

const VariablesViewer = () => {
  const { useStore } = createStoreHook<CommonState>();
  const [[variables, styleVariables, variablesParsed]] = useStore([
    'schema.variables',
    'style.variables',
    'runtime.sources.variables'
  ]);

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-3">
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
          <i className="fa-solid fa-code" />
          Schema Variables
        </div>
        <VariablesList variables={variables} variablesParsed={variablesParsed as Record<string, string>} />
      </section>

      <section className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
          <i className="fa-solid fa-palette" />
          Style Variables
        </div>
        <VariablesStyleList variables={styleVariables} />
      </section>
    </div>
  );
};

export default VariablesViewer;
