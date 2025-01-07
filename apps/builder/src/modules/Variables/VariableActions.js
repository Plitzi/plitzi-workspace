// Packages
import classNames from 'classnames';
import Button from '@plitzi/plitzi-ui/Button';
// import Button from '@plitzi/plitzi-ui-components/Button';

const VariableActions = ({ onUpdate, onRemove, selected }) => (
  <div
    className={classNames('flex gap-2 items-center text-xs', { flex: selected, 'group-hover:flex hidden': !selected })}
  >
    <Button intent="custom" size="custom" border="none" onClick={onUpdate} title="Update">
      <Button.Icon intent="primary" icon="fas fa-pen" />
    </Button>
    <Button intent="custom" border="none" size="custom" onClick={onRemove} title="Remove">
      <Button.Icon intent="error" icon="fas fa-trash-alt" />
    </Button>
  </div>
);

export default VariableActions;
