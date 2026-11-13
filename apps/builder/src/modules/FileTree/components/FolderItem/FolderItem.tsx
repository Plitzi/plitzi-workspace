import { FILE_INDENT_PX } from '../../helpers';

export type FolderItemProps = { name: string; depth: number };

/** A folder in the list: its name, once, above the files in it. */
const FolderItem = ({ name, depth }: FolderItemProps) => (
  <div
    className="text-ui-fg-subtle flex items-center gap-1.5 px-2 py-1 text-xs"
    style={{ paddingLeft: 8 + depth * FILE_INDENT_PX }}
  >
    <i className="fa-regular fa-folder-open text-[10px]" />
    {name}
  </div>
);

export default FolderItem;
