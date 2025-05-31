import ToolsListItem from './ToolsListItem';

export type ToolsListProps = {
  onSelect: (id: string) => void;
  selected: string;
};

const ToolsList = ({ onSelect, selected }: ToolsListProps) => {
  return (
    <ul className="w-full m-0 p-0 flex justify-around list-type-none border-b border-gray-300 select-none">
      <ToolsListItem id="style" title="Style" onClick={onSelect} active={selected === 'style'} />
      <ToolsListItem id="settings" title="Settings" onClick={onSelect} active={selected === 'settings'} />
      <ToolsListItem id="bindings" title="Bindings" onClick={onSelect} active={selected === 'bindings'} />
      <ToolsListItem id="interactions" title="Interactions" onClick={onSelect} active={selected === 'interactions'} />
    </ul>
  );
};

export default ToolsList;
