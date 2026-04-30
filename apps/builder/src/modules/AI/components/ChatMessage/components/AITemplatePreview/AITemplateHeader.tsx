import type { DisplayMode } from '@plitzi/sdk-shared';

const MODES: { mode: DisplayMode; icon: string }[] = [
  { mode: 'desktop', icon: 'fa-solid fa-desktop' },
  { mode: 'tablet', icon: 'fa-solid fa-tablet-screen-button' },
  { mode: 'mobile', icon: 'fa-solid fa-mobile-screen' }
];

export type AITemplateHeaderProps = {
  baseElementId: string;
  displayMode: DisplayMode;
  onDisplayMode: (mode: DisplayMode) => void;
  onClick: () => void;
};

const AITemplateHeader = ({ baseElementId, displayMode, onDisplayMode, onClick }: AITemplateHeaderProps) => (
  <div className="flex items-center justify-between gap-2 border-b border-violet-100 bg-violet-50 px-3 py-1 font-mono text-xs text-violet-500 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-400">
    <div className="flex items-center gap-1">
      <span>◈</span>
      <span>proposed · {baseElementId}</span>
    </div>

    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {MODES.map(({ mode, icon }) => (
          <button
            key={mode}
            onClick={() => onDisplayMode(mode)}
            title={mode}
            className={`cursor-pointer rounded px-1 py-0.5 transition-colors ${
              displayMode === mode
                ? 'bg-violet-200 text-violet-700 dark:bg-violet-800/60 dark:text-violet-300'
                : 'text-violet-400 hover:text-violet-600 dark:text-violet-600 dark:hover:text-violet-400'
            }`}
          >
            <i className={icon} />
          </button>
        ))}
      </div>

      <button onClick={onClick} className="cursor-pointer">
        <i className="fa-solid fa-up-right-and-down-left-from-center" />
      </button>
    </div>
  </div>
);

export default AITemplateHeader;
