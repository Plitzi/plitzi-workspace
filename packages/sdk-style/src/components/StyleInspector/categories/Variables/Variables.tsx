import { useCallback } from 'react';

import VariableManager from '../../../VariableManager';
import CategoryContainer from '../../components/CategoryContainer';

export type VariablesProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Variables = ({ isCollapsed, onCollapse }: VariablesProps) => {
  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('variables', isCollapsed), [onCollapse]);

  return (
    <CategoryContainer title="Variables" isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <VariableManager />
    </CategoryContainer>
  );
};

export default Variables;
