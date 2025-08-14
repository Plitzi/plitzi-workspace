export type ResourceTypeProps = {
  type?: 'image' | 'video' | 'plugin' | 'application' | 'document';
};

const ResourceType = ({ type = 'image' }: ResourceTypeProps) => {
  return (
    <div className="absolute right-0 bottom-0 flex items-center justify-center rounded-tl bg-white p-1">
      {type === 'image' && <i className="fa-solid fa-image" title="Image" />}
      {type === 'video' && <i className="fa-solid fa-film" title="Video" />}
      {type === 'plugin' && <i className="fa-solid fa-puzzle-piece" title="Plugin" />}
      {!['image', 'video', 'plugin'].includes(type) && <i className="fa-solid fa-file" title="Plugin" />}
    </div>
  );
};

export default ResourceType;
