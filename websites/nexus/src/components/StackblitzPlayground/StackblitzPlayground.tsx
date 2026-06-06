import sdk from '@stackblitz/sdk';
import { useCallback, useRef, useState } from 'react';

import { buildProject } from './stackblitzProject';

export type StackblitzPlaygroundProps = {
  demoId: string;
  demoCode: string;
  label?: string;
};

const StackblitzPlayground = ({ demoId, demoCode, label = '▶ Open in Stackblitz' }: StackblitzPlaygroundProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleOpen = useCallback(async () => {
    const project = buildProject(demoId, demoCode);
    await sdk.openProject(project, { openFile: 'src/App.tsx' });
  }, [demoId, demoCode]);

  const handleEmbed = useCallback(async () => {
    if (open || !containerRef.current) {
      return;
    }

    setOpen(true);
    const project = buildProject(demoId, demoCode);
    await sdk.embedProject(containerRef.current, project, {
      width: '100%',
      height: 500,
      openFile: 'src/App.tsx',
      hideNavigation: true,
      view: 'editor'
    });
  }, [open, demoId, demoCode]);

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-600/40 bg-brand-600/10 px-3 py-1.5 text-xs font-medium text-brand-300 transition hover:bg-brand-600/20 hover:text-white"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        {label}
      </button>

      <button
        onClick={handleEmbed}
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800/60 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-ink-700 hover:text-white"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8" />
          <path d="M12 17v4" />
        </svg>
        Embed
      </button>

      {open && (
        <button
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-900/40 bg-red-900/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-900/20"
        >
          Close
        </button>
      )}

      {open && (
        <div className="relative mt-2 w-full overflow-hidden rounded-xl border border-ink-600">
          <div
            ref={containerRef}
            className="h-[500px] w-full"
          />
        </div>
      )}
    </div>
  );
};

export default StackblitzPlayground;
