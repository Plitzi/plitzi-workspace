import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';

import ExportFileItem from './components/ExportFileItem';

export type ExportViewerProps = {
  /** Every file of the export, by path; one file shows alone, several beside a list to pick from. */
  paths: string[];
  selectedPath?: string;
  content?: string;
  mode: 'js' | 'json';
  theme: 'light' | 'dark';
  loading: boolean;
  onSelectPath: (path: string) => void;
};

/** The export itself, read-only: the file on the right, and when there are several, the files to pick on the left. */
const ExportViewer = ({ paths, selectedPath, content, mode, theme, loading, onSelectPath }: ExportViewerProps) => (
  <div className="relative flex min-h-0 grow overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700/70">
    {paths.length > 1 && (
      <nav className="w-56 shrink-0 space-y-0.5 overflow-auto border-r border-zinc-200 p-2 dark:border-zinc-700/70">
        {paths.map(path => (
          <ExportFileItem key={path} path={path} selected={path === selectedPath} onSelect={onSelectPath} />
        ))}
      </nav>
    )}
    <div className="flex min-w-0 grow flex-col">
      {paths.length > 1 && selectedPath && (
        <div className="border-b border-zinc-200 px-3 py-1.5 font-mono text-xs text-zinc-500 dark:border-zinc-700/70 dark:text-zinc-400">
          {selectedPath}
        </div>
      )}
      <div className="min-h-0 grow">
        <CodeMirror value={content ?? ''} mode={mode} theme={theme} size="sm" readOnly />
      </div>
    </div>
    {loading && (
      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white/70 text-sm text-zinc-600 backdrop-blur-[1px] dark:bg-zinc-900/70 dark:text-zinc-300">
        <i className="fa-solid fa-circle-notch fa-spin" />
        Generating…
      </div>
    )}
  </div>
);

export default ExportViewer;
