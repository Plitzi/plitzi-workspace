import { use, useCallback } from 'react';

import VariableManager from '../../../VariableManager';
import CategoryContainer from '../../components/CategoryContainer';
import StyleInspectorContext from '../../StyleInspectorContext';

export type VariablesProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Variables = ({ isCollapsed, onCollapse }: VariablesProps) => {
  const { displayMode, selector } = use(StyleInspectorContext);

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('variables', isCollapsed), [onCollapse]);

  return (
    <CategoryContainer title="Variables" isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <VariableManager variables={selector?.variables} displayMode={displayMode} selector={selector?.name} />
    </CategoryContainer>
  );
};

export default Variables;
