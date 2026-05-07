import type { DisplayMode } from '@plitzi/sdk-shared';
import type { AiMode } from '@pmodules/AI/types';

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
  showHtml?: boolean;
  onToggleHtml?: () => void;
  hasHtml?: boolean;
  mode?: AiMode;
};

const AITemplateHeader = ({
  baseElementId,
  displayMode,
  onDisplayMode,
  onClick,
  showHtml,
  onToggleHtml,
  hasHtml,
  mode
}: AITemplateHeaderProps) => (
  <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-1 font-mono text-xs text-zinc-600 dark:border-zinc-700/60 dark:bg-zinc-900 dark:text-zinc-400">
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 rounded border border-zinc-300 px-1 text-[9px] tracking-wider uppercase dark:border-zinc-600">
        preview
      </span>
      <span className="truncate">{showHtml ? 'HTML Source' : baseElementId}</span>
      {mode === 'plan' && <span className="shrink-0 font-mono text-[9px] text-sky-500 dark:text-sky-600">plan</span>}
    </div>

    <div className="flex items-center gap-2">
      {hasHtml && onToggleHtml && (
        <button
          onClick={onToggleHtml}
          title={showHtml ? 'Show Preview' : 'Show HTML'}
          className="cursor-pointer rounded px-1 py-0.5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
        >
          <i className={showHtml ? 'fa-solid fa-eye' : 'fa-solid fa-code'} />
        </button>
      )}

      <div className="flex items-center gap-1">
        {MODES.map(({ mode: dm, icon }) => (
          <button
            key={dm}
            onClick={() => onDisplayMode(dm)}
            title={dm}
            className={`cursor-pointer rounded px-1 py-0.5 transition-colors ${
              displayMode === dm
                ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400'
            }`}
          >
            <i className={icon} />
          </button>
        ))}
      </div>

      <button
        onClick={onClick}
        className="cursor-pointer text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
      >
        <i className="fa-solid fa-up-right-and-down-left-from-center" />
      </button>
    </div>
  </div>
);

export default AITemplateHeader;
