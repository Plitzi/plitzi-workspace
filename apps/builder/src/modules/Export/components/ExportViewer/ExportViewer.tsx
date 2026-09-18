import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import { useState } from 'react';

import ExportChanges from './components/ExportChanges';
import ExportFileItem from './components/ExportFileItem';
import ExportViewTab from './components/ExportViewTab';
import { FULL_HEIGHT_EDITOR } from '../../helpers/editor';

import type { ExportView } from './components/ExportViewTab';
import type { SpecCorrection } from '@plitzi/sdk-authoring';

export type ExportViewerProps = {
  /** Every file of the export, by path; one file shows alone, several beside a list to pick from. */
  paths: string[];
  selectedPath?: string;
  content?: string;
  /** What the export tidied on the way; a tab of its own when there is any. */
  corrections: SpecCorrection[];
  mode: 'js' | 'json';
  theme: 'light' | 'dark';
  loading: boolean;
  onSelectPath: (path: string) => void;
};

/** The export itself, read-only — the code, and beside it on a tab of its own, what was tidied to write it. */
const ExportViewer = ({
  paths,
  selectedPath,
  content,
  corrections,
  mode,
  theme,
  loading,
  onSelectPath
}: ExportViewerProps) => {
  const [view, setView] = useState<ExportView>('code');
  const showChanges = view === 'changes' && corrections.length > 0;

  return (
    <div className="relative flex min-h-0 grow flex-col overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700/70">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-2 dark:border-zinc-700/70">
        <div role="tablist" className="flex items-center">
          <ExportViewTab view="code" label="Code" icon="fa-solid fa-code" selected={!showChanges} onSelect={setView} />
          {corrections.length > 0 && (
            <ExportViewTab
              view="changes"
              label="Changes"
              icon="fa-solid fa-wand-magic-sparkles"
              count={corrections.length}
              selected={showChanges}
              onSelect={setView}
            />
          )}
        </div>
        {!showChanges && selectedPath && (
          <span className="truncate px-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">{selectedPath}</span>
        )}
      </div>
      <div className="flex min-h-0 grow">
        {showChanges && (
          <div className="min-h-0 min-w-0 grow">
            <ExportChanges corrections={corrections} />
          </div>
        )}
        {!showChanges && paths.length > 1 && (
          <nav className="w-56 shrink-0 space-y-0.5 overflow-auto border-r border-zinc-200 p-2 dark:border-zinc-700/70">
            {paths.map(path => (
              <ExportFileItem key={path} path={path} selected={path === selectedPath} onSelect={onSelectPath} />
            ))}
          </nav>
        )}
        {!showChanges && (
          <div className="min-h-0 min-w-0 grow">
            <CodeMirror
              className={FULL_HEIGHT_EDITOR}
              value={content ?? ''}
              mode={mode}
              theme={theme}
              size="sm"
              readOnly
            />
          </div>
        )}
      </div>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white/70 text-sm text-zinc-600 backdrop-blur-[1px] dark:bg-zinc-900/70 dark:text-zinc-300">
          <i className="fa-solid fa-circle-notch fa-spin" />
          Generating…
        </div>
      )}
    </div>
  );
};

export default ExportViewer;
