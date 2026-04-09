import ToolsListItem from './ToolsListItem';

export type ToolsListProps = {
  onSelect: (id: string) => void;
  selected: string;
};

const ToolsList = ({ onSelect, selected }: ToolsListProps) => {
  return (
    <ul className="list-type-none m-0 flex w-full justify-around border-b border-gray-300 p-0 select-none dark:border-zinc-700">
      <ToolsListItem id="style" title="Style" onClick={onSelect} active={selected === 'style'} />
      <ToolsListItem id="settings" title="Settings" onClick={onSelect} active={selected === 'settings'} />
      <ToolsListItem id="bindings" title="Bindings" onClick={onSelect} active={selected === 'bindings'} />
      <ToolsListItem id="interactions" title="Interactions" onClick={onSelect} active={selected === 'interactions'} />
    </ul>
  );
};

export default ToolsList;
