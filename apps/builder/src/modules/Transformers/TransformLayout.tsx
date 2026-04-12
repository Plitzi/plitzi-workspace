import Button from '@plitzi/plitzi-ui/Button';
import Select2 from '@plitzi/plitzi-ui/Select2';
import clsx from 'clsx';
import { useMemo } from 'react';

import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';

export type TransformLayoutProps = {
  layoutMode?: 'horizontal' | 'vertical';
  isEditorVisible?: boolean;
  onClickEditorVisible?: () => void;
  onLayoutModeChange?: (value?: Exclude<Option, OptionGroup>) => void;
};

const TransformLayout = ({
  layoutMode = 'horizontal',
  isEditorVisible = true,
  onClickEditorVisible,
  onLayoutModeChange
}: TransformLayoutProps) => {
  const optionsLayoutMode = useMemo(
    () => [
      { value: 'horizontal', label: 'Horizontal' },
      { value: 'vertical', label: 'Vertical' }
    ],
    []
  );

  return (
    <div className="flex gap-2">
      <Button
        size="xs"
        title="Hide/Show Editor"
        className={clsx('rounded-sm', { 'opacity-70': !isEditorVisible })}
        onClick={onClickEditorVisible}
      >
        <i className="fas fa-code" />
      </Button>
      <Select2
        className="w-37.5"
        clearable={false}
        isSearchable={false}
        value={layoutMode}
        onChange={onLayoutModeChange}
        size="xs"
        options={optionsLayoutMode}
      />
    </div>
  );
};

export default TransformLayout;
