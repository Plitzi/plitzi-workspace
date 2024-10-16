/**
 * @param {{
 *   name?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const ResourceName = props => {
  const { name } = props;

  return (
    <div className="absolute bottom-0 left-0 right-8 bg-gray-300 p-1 rounded-tr flex items-center text-xs px-2 truncate max-w-[200px] overflow-hidden">
      <div className="truncate" title={name}>
        {name}
      </div>
    </div>
  );
};

export default ResourceName;
