// Packages
import React, { useCallback, useMemo } from 'react';
import get from 'lodash/get';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';
import Switch from '@plitzi/plitzi-ui-components/Switch';

// Relatives
import DisplayFlexChild from '../Categories/DisplayFlexChild';
import Display from '../Categories/Display';
import Spacing from '../Categories/Spacing';
import Size from '../Categories/Size';
import List from '../Categories/List';
import ListItem from '../Categories/ListItem';
import Position from '../Categories/Position';
import Typography from '../Categories/Typography';
import Background from '../Categories/Background';
import Border from '../Categories/Border';
import Effects from '../Categories/Effects';
import StyleInspectorProvider from '../StyleInspectorProvider';
import useStyleInherit from '../hooks/useStyleInherit';

/**
 * @param {{
 *   selector?: string;
 *   styleSelector?: string;
 *   element: object;
 * }} props
 * @returns {React.ReactElement}
 */
const InspectorModeBasic = props => {
  const { selector = '', styleSelector = 'base', element } = props;
  const [cache, setCache, getCacheByKey] = useCache();
  const collapsedCache = useMemo(() => getCacheByKey('StyleInspector.collapsedCache', {}), [cache]);
  const showAllOptions = get(cache, 'StyleInspector.showAllOptions', false);
  const inheritData = useStyleInherit({ element, selector, styleSelector });

  const handleChangeCollapse = useCallback(
    (id, isCollapsed) => setCache({ ...collapsedCache, [id]: isCollapsed }, 'StyleInspector.collapsedCache'),
    [collapsedCache]
  );

  const handleChangeShowAllOptions = useCallback(
    e => setCache(e.target.checked, 'StyleInspector.showAllOptions'),
    [cache]
  );

  const isList = useMemo(() => {
    if (showAllOptions) {
      return true;
    }

    const type = get(element, 'definition.type', '');

    return type === 'list' || type === 'listItem';
  }, [element, showAllOptions]);

  const isFlexChild = useMemo(() => {
    if (showAllOptions) {
      return true;
    }

    if (!inheritData || !inheritData.tree || !inheritData.tree.length === 0) {
      return false;
    }

    const parent = get(inheritData, 'tree', []).find(item => item.isParent);
    if (!parent) {
      return false;
    }

    const display = get(parent, 'style.base.display', 'block');

    return display === 'flex';
  }, [inheritData, showAllOptions]);

  return (
    <StyleInspectorProvider
      styleSelector={styleSelector}
      selector={selector}
      element={element}
      inheritData={inheritData}
    >
      <div className="flex flex-col justify-between grow">
        <div className="flex flex-col">
          {isList && <List isCollapsed={collapsedCache.list ?? true} onCollapse={handleChangeCollapse} />}
          {isList && <ListItem isCollapsed={collapsedCache.listItem ?? true} onCollapse={handleChangeCollapse} />}
          <Display isCollapsed={collapsedCache.display ?? true} onCollapse={handleChangeCollapse} />
          {isFlexChild && (
            <DisplayFlexChild isCollapsed={collapsedCache.displayFlexChild ?? true} onCollapse={handleChangeCollapse} />
          )}
          <Spacing isCollapsed={collapsedCache.spacing ?? true} onCollapse={handleChangeCollapse} />
          <Size isCollapsed={collapsedCache.size ?? true} onCollapse={handleChangeCollapse} />
          <Position isCollapsed={collapsedCache.position ?? true} onCollapse={handleChangeCollapse} />
          <Typography isCollapsed={collapsedCache.typography ?? true} onCollapse={handleChangeCollapse} />
          <Background isCollapsed={collapsedCache.background ?? true} onCollapse={handleChangeCollapse} />
          <Border isCollapsed={collapsedCache.border ?? true} onCollapse={handleChangeCollapse} />
          <Effects isCollapsed={collapsedCache.effects ?? true} onCollapse={handleChangeCollapse} />
        </div>
        <div className="flex items-center justify-end px-2 py-1 gap-2 text-xs">
          Show All Options
          <Switch className="!w-auto" size="sm" value={showAllOptions} onChange={handleChangeShowAllOptions} />
        </div>
      </div>
    </StyleInspectorProvider>
  );
};

export default InspectorModeBasic;
