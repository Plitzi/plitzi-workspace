export type AITemplateHeaderProps = {
  baseElementId: string;
  onClick: () => void;
};

const AITemplateHeader = ({ baseElementId, onClick }: AITemplateHeaderProps) => {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-violet-100 bg-violet-50 px-3 py-1 font-mono text-xs text-violet-500 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-400">
      <div className="flex items-center gap-1">
        <span>◈</span>
        <span>proposed · {baseElementId}</span>
      </div>
      <button onClick={onClick} className="cursor-pointer">
        <i className="fa-solid fa-up-right-and-down-left-from-center" />
      </button>
    </div>
  );
};

export default AITemplateHeader;
