import { get, set } from '@plitzi/plitzi-ui/helpers';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { produce } from 'immer';
import { use, useCallback, useMemo, useState } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';

import { makeSelector } from '../../StyleHelper';
import Background from './categories/Background';
import Border from './categories/Border';
import Display from './categories/Display';
import DisplayFlexChild from './categories/DisplayFlexChild';
import Effects from './categories/Effects';
import List from './categories/List';
import ListItem from './categories/ListItem';
import Others from './categories/Others';
import Position from './categories/Position';
import RawStyle from './categories/RawStyle';
import Size from './categories/Size';
import Spacing from './categories/Spacing';
import Typography from './categories/Typography';
import Variables from './categories/Variables';
import { CATEGORY_IDS, CATEGORY_KEYS } from './categoryKeys';
import InspectorFooter from './components/InspectorFooter';
import InspectorSearch from './components/InspectorSearch';
import useStyleInherit from './hooks/useStyleInherit';
import InspectorSearchContext from './InspectorSearchContext';
import { categoryMatches, normalizeQuery } from './search';
import StyleInspectorProvider from './StyleInspectorProvider';

import type { CategoryId } from './categoryKeys';
import type {
  DisplayMode,
  Element,
  StyleCategory,
  StyleItem,
  StyleObject,
  StylePseudo,
  StyleState,
  StyleValue
} from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

export type InspectorProps = {
  selectors?: StyleItem[];
  componentType?: string;
  componentSubType?: string;
  selector?: StyleItem;
  styleState?: StyleState;
  styleVariant?: string;
  styleAncestor?: string;
  stylePseudo?: StylePseudo;
  styleCondition?: string;
  styleSelector?: string;
  element?: Element;
  displayMode: DisplayMode;
  mode?: 'element' | 'manager';
};

const Inspector = ({
  selectors,
  componentType,
  componentSubType,
  selector,
  styleState,
  styleVariant,
  styleAncestor,
  stylePseudo,
  styleCondition,
  styleSelector = 'base',
  element,
  displayMode,
  mode = 'element'
}: InspectorProps) => {
  const { builderHandler } = use(BuilderContext);
  const [collapsedCache, setCollapsedCache] = useStorage<Record<string, boolean | undefined>>(
    `builder-state.styleInspector.${mode}.collapsedCache`,
    {}
  );
  const [showAllOptions, setShowAllOptions] = useStorage(`builder-state.styleInspector.${mode}.showAllOptions`, false);
  const [replaceTokens, setReplaceTokens] = useStorage(`builder-state.styleInspector.${mode}.replaceTokens`, false);
  const [search, setSearch] = useState('');
  const query = normalizeQuery(search);
  const inheritData = useStyleInherit({
    element,
    componentType,
    componentSubType,
    selector: selector?.name,
    styleSelector,
    styleState,
    styleVariant,
    styleAncestor,
    stylePseudo,
    styleCondition
  });

  const handleChangeCollapse = useCallback(
    (id: string, isCollapsed: boolean) => setCollapsedCache(state => ({ ...state, [id]: isCollapsed })),
    [setCollapsedCache]
  );

  const handleCollapseAll = useCallback(
    () => setCollapsedCache(Object.fromEntries(CATEGORY_IDS.map(id => [id, true]))),
    [setCollapsedCache]
  );

  const handleChangeShowAllOptions = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setShowAllOptions(e.target.checked),
    [setShowAllOptions]
  );

  const handleChangeReplaceTokens = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setReplaceTokens(e.target.checked),
    [setReplaceTokens]
  );

  const handleChange = useCallback(
    (styleKey?: StyleCategory, values?: StyleObject | StyleValue) => {
      if (selector) {
        builderHandler('styleUpdateSelector', displayMode, selector.name, styleKey, values, {
          componentType: selector.type === 'element' ? componentType : undefined,
          styleSelector,
          styleState,
          styleVariant,
          styleAncestor,
          stylePseudo,
          styleCondition
        });

        return;
      }

      if (!componentType) {
        return undefined;
      }

      const customClass = makeSelector(componentType, styleSelector);
      builderHandler('styleAddSelector', displayMode, customClass, 'class', styleKey, values, {
        styleSelector,
        styleState,
        styleVariant,
        styleAncestor,
        stylePseudo,
        styleCondition
      });
      if (!element) {
        return;
      }

      const existingClasses = get(element, `definition.styleSelectors.${styleSelector}`);
      builderHandler(
        'schemaUpdateElement',
        produce(element, draft => {
          if (existingClasses) {
            set(draft, `definition.styleSelectors.${styleSelector}`, `${existingClasses} ${customClass}`);
          } else {
            set(draft, `definition.styleSelectors.${styleSelector}`, customClass);
          }
        })
      );
    },
    [
      builderHandler,
      componentType,
      displayMode,
      element,
      selector,
      styleSelector,
      styleState,
      styleVariant,
      styleAncestor,
      stylePseudo,
      styleCondition
    ]
  );

  const isList = useMemo(() => {
    const type = element?.definition.type;

    return showAllOptions || mode === 'manager' || type === 'list' || type === 'listItem';
  }, [element?.definition.type, mode, showAllOptions]);

  const isFlexChild = useMemo(() => {
    return showAllOptions || mode === 'manager' || get(inheritData, 'parentStyle.display', 'block') === 'flex';
  }, [inheritData, mode, showAllOptions]);

  const isFlexVertical = useMemo(
    () => get(inheritData, 'parentStyle.flex-direction', 'row') === 'column',
    [inheritData]
  );

  // What a search shows is what the element would show anyway, narrowed: a category it has no use for stays hidden.
  const applies = useCallback(
    (id: CategoryId) => {
      if (id === 'list' || id === 'listItem') {
        return isList;
      }

      if (id === 'displayFlexChild') {
        return isFlexChild;
      }

      return true;
    },
    [isFlexChild, isList]
  );
  const shown = useCallback(
    (id: CategoryId) => applies(id) && categoryMatches(CATEGORY_KEYS[id], query),
    [applies, query]
  );
  // While searching every match is open; the folds the person chose come back with an empty search.
  const collapsed = useCallback((id: CategoryId) => !query && (collapsedCache[id] ?? true), [collapsedCache, query]);
  const nothingFound = !!query && !CATEGORY_IDS.some(shown);

  return (
    <StyleInspectorProvider
      componentType={componentType}
      displayMode={displayMode}
      styleSelector={styleSelector}
      styleState={styleState}
      styleVariant={styleVariant}
      styleAncestor={styleAncestor}
      stylePseudo={stylePseudo}
      styleCondition={styleCondition}
      selector={selector}
      element={element}
      inheritData={inheritData}
      onChange={handleChange}
    >
      <InspectorSearchContext value={query}>
        <div className="flex grow flex-col justify-between">
          <div className="flex grow flex-col">
            <InspectorSearch value={search} onChange={setSearch} />
            {nothingFound && (
              <p className="m-0 px-3 py-4 text-xs text-zinc-500 dark:text-zinc-400">
                No property here matches “{search.trim()}”.
                {!showAllOptions &&
                  mode === 'element' &&
                  ' “All options” includes the categories this element does not use.'}
              </p>
            )}
            {shown('list') && (
              <List replaceTokens={replaceTokens} isCollapsed={collapsed('list')} onCollapse={handleChangeCollapse} />
            )}
            {shown('listItem') && (
              <ListItem
                replaceTokens={replaceTokens}
                isCollapsed={collapsed('listItem')}
                onCollapse={handleChangeCollapse}
              />
            )}
            {shown('display') && (
              <Display
                replaceTokens={replaceTokens}
                isCollapsed={collapsed('display')}
                onCollapse={handleChangeCollapse}
              />
            )}
            {shown('displayFlexChild') && (
              <DisplayFlexChild
                replaceTokens={replaceTokens}
                isCollapsed={collapsed('displayFlexChild')}
                isFlexVertical={isFlexVertical}
                onCollapse={handleChangeCollapse}
              />
            )}
            {shown('spacing') && (
              <Spacing
                replaceTokens={replaceTokens}
                isCollapsed={collapsed('spacing')}
                onCollapse={handleChangeCollapse}
              />
            )}
            {shown('size') && (
              <Size replaceTokens={replaceTokens} isCollapsed={collapsed('size')} onCollapse={handleChangeCollapse} />
            )}
            {shown('position') && (
              <Position
                replaceTokens={replaceTokens}
                isCollapsed={collapsed('position')}
                onCollapse={handleChangeCollapse}
              />
            )}
            {shown('typography') && (
              <Typography
                replaceTokens={replaceTokens}
                isCollapsed={collapsed('typography')}
                onCollapse={handleChangeCollapse}
              />
            )}
            {shown('background') && (
              <Background
                replaceTokens={replaceTokens}
                isCollapsed={collapsed('background')}
                onCollapse={handleChangeCollapse}
              />
            )}
            {shown('border') && (
              <Border
                replaceTokens={replaceTokens}
                isCollapsed={collapsed('border')}
                onCollapse={handleChangeCollapse}
              />
            )}
            {shown('effects') && (
              <Effects
                replaceTokens={replaceTokens}
                isCollapsed={collapsed('effects')}
                onCollapse={handleChangeCollapse}
              />
            )}
            {shown('others') && (
              <Others
                replaceTokens={replaceTokens}
                isCollapsed={collapsed('others')}
                onCollapse={handleChangeCollapse}
              />
            )}
            {shown('variables') && <Variables isCollapsed={collapsed('variables')} onCollapse={handleChangeCollapse} />}
            {shown('rawStyle') && (
              <RawStyle isCollapsed={collapsed('rawStyle')} selectors={selectors} onCollapse={handleChangeCollapse} />
            )}
          </div>
          <InspectorFooter
            replaceTokens={replaceTokens}
            showAllOptions={showAllOptions}
            canShowAllOptions={mode === 'element'}
            onCollapseAll={handleCollapseAll}
            onChangeReplaceTokens={handleChangeReplaceTokens}
            onChangeShowAllOptions={handleChangeShowAllOptions}
          />
        </div>
      </InspectorSearchContext>
    </StyleInspectorProvider>
  );
};

export default Inspector;
