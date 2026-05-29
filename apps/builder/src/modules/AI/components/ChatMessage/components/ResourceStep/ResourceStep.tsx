type ResourceStepProps = {
  name: string;
  uri: string;
};

const ResourceStep = ({ name, uri }: ResourceStepProps) => (
  <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
    <svg className="h-3 w-3 shrink-0 text-sky-500 dark:text-sky-400" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
        clipRule="evenodd"
      />
    </svg>
    <span className="text-zinc-700 dark:text-zinc-300">{name}</span>
    <span className="truncate text-zinc-400 dark:text-zinc-600">{uri}</span>
  </div>
);

export default ResourceStep;
