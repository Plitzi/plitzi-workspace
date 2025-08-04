import Button from '@plitzi/plitzi-ui/Button';
import classNames from 'classnames';

import type { MouseEvent } from 'react';

export type VariableActionsProps = {
  onUpdate?: (e: MouseEvent) => void;
  onRemove?: (e: MouseEvent) => void;
  selected?: boolean;
};

const VariableActions = ({ onUpdate, onRemove, selected = false }: VariableActionsProps) => (
  <div
    className={classNames('flex items-center gap-2 text-xs', { flex: selected, 'hidden group-hover:flex': !selected })}
  >
    <Button intent="custom" size="custom" border="none" onClick={onUpdate} title="Update">
      <Button.Icon intent="primary" icon="fas fa-pen" />
    </Button>
    <Button intent="custom" border="none" size="custom" onClick={onRemove} title="Remove">
      <Button.Icon intent="danger" icon="fas fa-trash-alt" />
    </Button>
  </div>
);

export default VariableActions;
