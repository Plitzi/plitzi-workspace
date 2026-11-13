import ToolsListItem from './ToolsListItem';

export type ToolsListProps = {
  onSelect: (id: string) => void;
  selected: string;
};

const ToolsList = ({ onSelect, selected }: ToolsListProps) => {
  return (
    <ul
      role="tablist"
      aria-label="Element tools"
      className="list-type-none border-ui-line m-0 flex w-full border-b p-0 select-none"
    >
      <ToolsListItem id="style" title="Style" onClick={onSelect} active={selected === 'style'} />
      <ToolsListItem id="settings" title="Settings" onClick={onSelect} active={selected === 'settings'} />
      <ToolsListItem id="bindings" title="Bindings" onClick={onSelect} active={selected === 'bindings'} />
      <ToolsListItem id="motion" title="Motion" onClick={onSelect} active={selected === 'motion'} />
      <ToolsListItem id="interactions" title="Interactions" onClick={onSelect} active={selected === 'interactions'} />
    </ul>
  );
};

export default ToolsList;
