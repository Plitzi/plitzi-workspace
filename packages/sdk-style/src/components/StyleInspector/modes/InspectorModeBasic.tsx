import { get, set } from '@plitzi/plitzi-ui/helpers';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Switch from '@plitzi/plitzi-ui/Switch';
import { produce } from 'immer';
import { use, useCallback, useMemo } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';

import { makeSelector } from '../../../StyleHelper';
import Background from '../categories/Background';
import Border from '../categories/Border';
import Display from '../categories/Display';
import DisplayFlexChild from '../categories/DisplayFlexChild';
import Effects from '../categories/Effects';
import List from '../categories/List';
import ListItem from '../categories/ListItem';
import Position from '../categories/Position';
import Size from '../categories/Size';
import Spacing from '../categories/Spacing';
import Typography from '../categories/Typography';
import Variables from '../categories/Variables';
import useStyleInherit from '../hooks/useStyleInherit';
import StyleInspectorProvider from '../StyleInspectorProvider';

import type {
  DisplayMode,
  Element,
  StyleCategory,
  StyleItem,
  StyleObject,
  StyleState,
  StyleValue
} from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

export type InspectorModeBasicProps = {
  componentType?: string;
  selector?: StyleItem;
  styleState?: StyleState;
  styleVariant?: string;
  styleSelector?: string;
  element?: Element;
  displayMode: DisplayMode;
};

const InspectorModeBasic = ({
  componentType,
  selector,
  styleState,
  styleVariant,
  styleSelector = 'base',
  element,
  displayMode
}: InspectorModeBasicProps) => {
  const { builderHandler } = use(BuilderContext);
  const [collapsedCache, setCollapsedCache] = useStorage<Record<string, boolean | undefined>>(
    'builder-state.styleInspector.collapsedCache',
    {}
  );
  const [showAllOptions, setShowAllOptions] = useStorage('builder-state.styleInspector.showAllOptions', false);
  const [replaceTokens, setReplaceTokens] = useStorage('builder-state.styleInspector.replaceTokens', false);
  const inheritData = useStyleInherit({
    element,
    componentType,
    selector: selector?.name,
    styleSelector,
    styleState,
    styleVariant
  });

  const handleChangeCollapse = useCallback(
    (id: string, isCollapsed: boolean) => setCollapsedCache(state => ({ ...state, [id]: isCollapsed })),
    [setCollapsedCache]
  );

  const handleChangeShowAllOptions = useCallback(
    (e: ChangeEvent) => setShowAllOptions((e.target as HTMLInputElement).checked),
    [setShowAllOptions]
  );

  const handleChangeReplaceTokens = useCallback(
    (e: ChangeEvent) => setReplaceTokens((e.target as HTMLInputElement).checked),
    [setReplaceTokens]
  );

  const handleChange = useCallback(
    (styleKey?: StyleCategory, values?: StyleObject | StyleValue) => {
      if (selector) {
        builderHandler('styleUpdateSelector', displayMode, selector.name, styleKey, values, {
          componentType: selector.type === 'element' ? componentType : undefined,
          styleSelector,
          styleState,
          styleVariant
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
        styleVariant
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
    [builderHandler, componentType, displayMode, element, selector, styleSelector, styleState, styleVariant]
  );

  const isList = useMemo(() => {
    const type = element?.definition.type;

    return showAllOptions || type === 'list' || type === 'listItem';
  }, [element, showAllOptions]);

  const isFlexChild = useMemo(() => {
    return showAllOptions || get(inheritData, 'parentStyle.display', 'block') === 'flex';
  }, [inheritData, showAllOptions]);

  const isFlexVertical = useMemo(
    () => get(inheritData, 'parentStyle.flex-direction', 'row') === 'column',
    [inheritData]
  );

  return (
    <StyleInspectorProvider
      displayMode={displayMode}
      styleSelector={styleSelector}
      styleState={styleState}
      styleVariant={styleVariant}
      selector={selector}
      element={element}
      inheritData={inheritData}
      onChange={handleChange}
    >
      <div className="flex grow flex-col justify-between">
        <div className="flex flex-col">
          {isList && (
            <List
              replaceTokens={replaceTokens}
              isCollapsed={collapsedCache.list ?? true}
              onCollapse={handleChangeCollapse}
            />
          )}
          {isList && (
            <ListItem
              replaceTokens={replaceTokens}
              isCollapsed={collapsedCache.listItem ?? true}
              onCollapse={handleChangeCollapse}
            />
          )}
          <Display
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.display ?? true}
            onCollapse={handleChangeCollapse}
          />
          {isFlexChild && (
            <DisplayFlexChild
              replaceTokens={replaceTokens}
              isCollapsed={collapsedCache.displayFlexChild ?? true}
              isFlexVertical={isFlexVertical}
              onCollapse={handleChangeCollapse}
            />
          )}
          <Spacing
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.spacing ?? true}
            onCollapse={handleChangeCollapse}
          />
          <Size
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.size ?? true}
            onCollapse={handleChangeCollapse}
          />
          <Position
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.position ?? true}
            onCollapse={handleChangeCollapse}
          />
          <Typography
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.typography ?? true}
            onCollapse={handleChangeCollapse}
          />
          <Background
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.background ?? true}
            onCollapse={handleChangeCollapse}
          />
          <Border
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.border ?? true}
            onCollapse={handleChangeCollapse}
          />
          <Effects
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.effects ?? true}
            onCollapse={handleChangeCollapse}
          />
          <Variables isCollapsed={collapsedCache.variables ?? true} onCollapse={handleChangeCollapse} />
        </div>
        <div className="flex items-center justify-end gap-4 px-2 py-1">
          <Switch size="xs" label="Replace Tokens" checked={replaceTokens} onChange={handleChangeReplaceTokens} />
          <Switch size="xs" label="Show All Options" checked={showAllOptions} onChange={handleChangeShowAllOptions} />
        </div>
      </div>
    </StyleInspectorProvider>
  );
};

export default InspectorModeBasic;
