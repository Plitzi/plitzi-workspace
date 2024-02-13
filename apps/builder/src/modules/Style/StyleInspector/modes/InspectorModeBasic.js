// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';

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

const InspectorModeBasic = props => {
  const { selector = '', styleSelector = 'base', element } = props;
  const [cache, setCache, getCacheByKey] = useCache();
  const collapsedCache = useMemo(() => getCacheByKey('StyleInspector.collapsedCache', {}), [cache]);

  const handleChangeCollapse = useCallback(
    (id, isCollapsed) => setCache({ ...collapsedCache, [id]: isCollapsed }, 'StyleInspector.collapsedCache'),
    [collapsedCache]
  );

  return (
    <StyleInspectorProvider styleSelector={styleSelector} selector={selector} element={element}>
      <List isCollapsed={collapsedCache.list ?? true} onCollapse={handleChangeCollapse} />
      <ListItem isCollapsed={collapsedCache.listItem ?? true} onCollapse={handleChangeCollapse} />
      <DisplayFlexChild isCollapsed={collapsedCache.displayFlexChild ?? true} onCollapse={handleChangeCollapse} />
      <Display isCollapsed={collapsedCache.display ?? true} onCollapse={handleChangeCollapse} />
      <Spacing isCollapsed={collapsedCache.spacing ?? true} onCollapse={handleChangeCollapse} />
      <Size isCollapsed={collapsedCache.size ?? true} onCollapse={handleChangeCollapse} />
      <Position isCollapsed={collapsedCache.position ?? true} onCollapse={handleChangeCollapse} />
      <Typography isCollapsed={collapsedCache.typography ?? true} onCollapse={handleChangeCollapse} />
      <Background isCollapsed={collapsedCache.background ?? true} onCollapse={handleChangeCollapse} />
      <Border isCollapsed={collapsedCache.border ?? true} onCollapse={handleChangeCollapse} />
      <Effects isCollapsed={collapsedCache.effects ?? true} onCollapse={handleChangeCollapse} />
    </StyleInspectorProvider>
  );
};

InspectorModeBasic.propTypes = {
  selector: PropTypes.string,
  styleSelector: PropTypes.string,
  element: PropTypes.object
};

export default InspectorModeBasic;
