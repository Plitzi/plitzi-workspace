// import Switch from '@plitzi/plitzi-ui/Switch';
// import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import get from 'lodash/get';
// import { useCallback, useMemo } from 'react';

// import DisplayFlexChild from '../Categories/DisplayFlexChild';
// import Display from '../Categories/Display';
// import Spacing from '../Categories/Spacing';
// import Size from '../Categories/Size';
// import List from '../Categories/List';
// import ListItem from '../Categories/ListItem';
// import Position from '../Categories/Position';
// import Typography from '../Categories/Typography';
// import Background from '../Categories/Background';
// import Border from '../Categories/Border';
// import Effects from '../Categories/Effects';
import useStyleInherit from '../hooks/useStyleInherit';
import StyleInspectorProvider from '../StyleInspectorProvider';

import type { DisplayMode, Element } from '@plitzi/sdk-shared';

export type InspectorModeBasicProps = {
  selector?: string;
  styleSelector?: string;
  element?: Element;
  displayMode: DisplayMode;
};

const InspectorModeBasic = ({
  selector = '',
  styleSelector = 'base',
  element,
  displayMode
}: InspectorModeBasicProps) => {
  // const [cache, setCache, getCacheByKey] = useCache();
  // const collapsedCache = useMemo(() => getCacheByKey('StyleInspector.collapsedCache', {}), [cache]);
  const [cache, setCache] = useStorage<{ viewMode: 'basic' | 'advanced'; collapsedCache: boolean }>('StyleInspector', {
    viewMode: 'basic',
    collapsedCache: false
  });
  const showAllOptions = get(cache, 'StyleInspector.showAllOptions', false);
  const inheritData = useStyleInherit({ element, selector, styleSelector });

  // const handleChangeCollapse = useCallback(
  //   (id, isCollapsed) => setCache({ ...collapsedCache, [id]: isCollapsed }, 'StyleInspector.collapsedCache'),
  //   [collapsedCache]
  // );

  // const handleChangeShowAllOptions = useCallback(
  //   e => setCache(e.target.checked, 'StyleInspector.showAllOptions'),
  //   [cache]
  // );

  // const isList = useMemo(() => {
  //   if (showAllOptions) {
  //     return true;
  //   }

  //   const type = get(element, 'definition.type', '');

  //   return type === 'list' || type === 'listItem';
  // }, [element, showAllOptions]);

  // const isFlexChild = useMemo(() => {
  //   if (showAllOptions) {
  //     return true;
  //   }

  //   return get(inheritData, 'parentStyle.display', 'block') === 'flex';
  // }, [inheritData, showAllOptions]);

  // const isFlexVertical = useMemo(
  //   () => get(inheritData, 'parentStyle.flex-direction', 'row') === 'column',
  //   [inheritData]
  // );

  return (
    <StyleInspectorProvider
      displayMode={displayMode}
      styleSelector={styleSelector}
      selector={selector}
      element={element}
      inheritData={inheritData}
    >
      <div className="flex flex-col justify-between grow">
        <div className="flex flex-col">
          {/* {isList && <List isCollapsed={collapsedCache.list ?? true} onCollapse={handleChangeCollapse} />}
          {isList && <ListItem isCollapsed={collapsedCache.listItem ?? true} onCollapse={handleChangeCollapse} />}
          <Display isCollapsed={collapsedCache.display ?? true} onCollapse={handleChangeCollapse} />
          {isFlexChild && (
            <DisplayFlexChild
              isCollapsed={collapsedCache.displayFlexChild ?? true}
              isFlexVertical={isFlexVertical}
              onCollapse={handleChangeCollapse}
            />
          )}
          <Spacing isCollapsed={collapsedCache.spacing ?? true} onCollapse={handleChangeCollapse} />
          <Size isCollapsed={collapsedCache.size ?? true} onCollapse={handleChangeCollapse} />
          <Position isCollapsed={collapsedCache.position ?? true} onCollapse={handleChangeCollapse} />
          <Typography isCollapsed={collapsedCache.typography ?? true} onCollapse={handleChangeCollapse} />
          <Background isCollapsed={collapsedCache.background ?? true} onCollapse={handleChangeCollapse} />
          <Border isCollapsed={collapsedCache.border ?? true} onCollapse={handleChangeCollapse} />
          <Effects isCollapsed={collapsedCache.effects ?? true} onCollapse={handleChangeCollapse} /> */}
        </div>
        <div className="flex items-center justify-end px-2 py-1 gap-2 text-xs">
          Show All Options
          {/* <Switch className="!w-auto" size="sm" value={showAllOptions} onChange={handleChangeShowAllOptions} /> */}
        </div>
      </div>
    </StyleInspectorProvider>
  );
};

export default InspectorModeBasic;
