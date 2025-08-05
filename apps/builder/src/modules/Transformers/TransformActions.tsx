import Button from '@plitzi/plitzi-ui/Button';
import Select2 from '@plitzi/plitzi-ui/Select2';
import { useMemo } from 'react';

import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';

export type TransformActionsProps = {
  mode?: 'horizontal' | 'vertical';
  disabled?: boolean;
  onChangeMode?: (mode?: Exclude<Option, OptionGroup>) => void;
  onClickEraser?: () => void;
  onTransform?: () => void;
  onImport?: () => void;
};

const TransformActions = ({
  mode = 'horizontal',
  disabled,
  onChangeMode,
  onClickEraser,
  onTransform,
  onImport
}: TransformActionsProps) => {
  const options = useMemo(
    () => [
      // { value: 'html', label: 'Html' },
      { value: 'html-tailwind', label: 'Html + Tailwind' },
      // { value: 'json', label: 'Json' },
      { value: 'webflow', label: 'Webflow' }
    ],
    []
  );

  return (
    <div className="flex gap-2">
      <Button size="sm" className="rounded-sm" title="Clean Up" onClick={onClickEraser}>
        <i className="fa-solid fa-eraser" />
      </Button>
      <Select2
        className="w-[150px] rounded-sm"
        size="sm"
        placeholder="Select mode"
        value={mode}
        onChange={onChangeMode}
        options={options}
        isSearchable={false}
        clearable={false}
      />
      <Button size="sm" className="rounded-sm" disabled={disabled} onClick={onTransform} title="Transform">
        {disabled ? 'Loading...' : 'Compile'}
      </Button>
      <Button size="sm" className="rounded-sm" disabled={disabled} onClick={onImport} title="Import">
        Import
      </Button>
    </div>
  );
};

export default TransformActions;
