import { get } from '@plitzi/plitzi-ui/helpers';
import { useState, use, useMemo } from 'react';

import { ComponentContext } from '@plitzi/sdk-shared/elements';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import ManagerSelector from './ManagerSelector';
import StyleInspector from '../StyleInspector';

import type { StyleItem } from '@plitzi/sdk-shared';

const StyleManager = () => {
  const { componentDefinitions } = use(ComponentContext);
  const [selector, setSelector] = useState<StyleItem | undefined>(undefined);

  const [[flat, displayMode]] = useBuilderStore(['schema.flat', 'displayMode']);
  const [selectors] = useBuilderStore(`style.platform.${displayMode}`);

  const flatList = useMemo(() => Object.values(flat), [flat]);

  const styleSelectorsAvailables = useMemo(
    () =>
      selector?.type === 'element'
        ? Object.keys(get(componentDefinitions.current, `${selector.componentType}.definition.styleSelectors`, {}))
        : ['base'],
    [componentDefinitions, selector]
  );

  const componentSubTypesAvailables = useMemo(
    () =>
      selector?.type === 'element'
        ? Object.keys(get(componentDefinitions.current, `${selector.componentType}.defaultStyle.subTypes`, {}))
        : [],
    [componentDefinitions, selector]
  );

  const styleSelectors = useMemo<Record<string, string> | undefined>(() => {
    if (!selector) {
      return undefined;
    }

    if (selector.type === 'element' && styleSelectorsAvailables.length > 1) {
      return styleSelectorsAvailables.reduce((acum, key) => ({ ...acum, [key]: selector.componentType }), {});
    }

    return { base: selector.name };
  }, [selector, styleSelectorsAvailables]);

  const dressed = useMemo(
    () =>
      selector
        ? flatList.filter(element =>
            Object.values(element.definition.styleSelectors).some(classes => classes.split(' ').includes(selector.name))
          ).length
        : 0,
    [flatList, selector]
  );

  return (
    <div className="flex h-full grow flex-col overflow-hidden">
      <div className="flex grow overflow-hidden">
        <ManagerSelector
          displayMode={displayMode}
          selectors={selectors}
          flat={flat}
          flatList={flatList}
          selected={selector?.name}
          onSelect={setSelector}
        />
        {/* The inspector's own surface, as the sidebar gives it: its lines are drawn for that ground, and on the floating
            window's they were the same colour as it. */}
        <div className="flex min-w-0 grow basis-0 flex-col overflow-auto bg-white dark:bg-zinc-900">
          {selector && (
            <>
              <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-zinc-800">
                <span
                  className="bg-primary-50 text-primary-600 dark:bg-primary-400/15 dark:text-primary-300 flex size-7 shrink-0 items-center justify-center rounded-md text-xs"
                  aria-hidden
                >
                  {selector.type === 'element' ? <i className="fa-solid fa-cube" /> : <b className="font-mono">.</b>}
                </span>
                <div className="flex min-w-0 grow flex-col">
                  <span className="truncate font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {selector.type === 'element' ? selector.name : `.${selector.name}`}
                  </span>
                  <span className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                    {selector.type === 'element'
                      ? `The defaults of every ${selector.componentType ?? selector.name}`
                      : dressed > 0
                        ? `A class, worn by ${String(dressed)} element${dressed === 1 ? '' : 's'}`
                        : 'A class no element wears'}
                  </span>
                </div>
                <span
                  className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-zinc-600 capitalize dark:bg-zinc-800 dark:text-zinc-300"
                  title="The breakpoint the styles below are edited at: the one the canvas shows"
                >
                  <i className="fa-solid fa-display mr-1 text-[10px]" />
                  {displayMode}
                </span>
              </div>
              <StyleInspector
                mode="manager"
                displayMode={displayMode}
                selectors={selectors}
                styleSelectors={styleSelectors}
                styleSelectorsAvailables={styleSelectorsAvailables}
                componentSubTypesAvailables={componentSubTypesAvailables}
                allowStyleSelector={selector.type === 'element'}
                componentType={selector.componentType}
                value={selector.name}
              />
            </>
          )}
          {!selector && (
            <div className="flex grow flex-col items-center justify-center gap-2 p-6 text-center select-none">
              <span className="bg-primary-50 text-primary-600 dark:bg-primary-400/15 dark:text-primary-300 flex size-10 items-center justify-center rounded-lg">
                <i className="fas fa-swatchbook" />
              </span>
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Pick a selector to edit it</span>
              <span className="max-w-64 text-xs text-zinc-500 dark:text-zinc-400">
                A class changes every element that wears it; an element’s defaults, every element of that type.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StyleManager;
