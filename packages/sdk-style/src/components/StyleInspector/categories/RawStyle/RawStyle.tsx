import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import clsx from 'clsx';
import { use, useCallback, useMemo } from 'react';

import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';

import { processSelectors } from '../../../../helpers';
import CategoryContainer from '../../components/CategoryContainer';

import type { StyleItem } from '@plitzi/sdk-shared';

export type VariablesProps = {
  selectors?: StyleItem[];
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const RawStyle = ({ selectors, isCollapsed, onCollapse }: VariablesProps) => {
  const { theme } = use(ThemeContext);
  const CMValue = useMemo(() => processSelectors(selectors ?? [], false).join('\n\n'), [selectors]);

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('rawStyle', isCollapsed), [onCollapse]);

  return (
    <CategoryContainer
      className={isCollapsed ? '' : 'grow'}
      classNameContent={clsx('p-0', { grow: !isCollapsed })}
      title="Raw Style"
      isCollapsed={isCollapsed}
      onCollapse={handleCollapse}
    >
      <CodeMirror
        value={CMValue}
        className="h-full"
        theme={theme === 'dark' ? 'dark' : 'light'}
        lineWrapping
        readOnly
      />
    </CategoryContainer>
  );
};

export default RawStyle;
