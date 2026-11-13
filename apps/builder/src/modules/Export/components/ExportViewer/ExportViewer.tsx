import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import { useState } from 'react';

import ExportFileTab from './components/ExportFileTab';
import ExportFileTree from './components/ExportFileTree';
import ExportViewTab from './components/ExportViewTab';
import { FULL_HEIGHT_EDITOR } from '../../helpers/editor';
import { fileNavigationOf } from '../../helpers/exportFiles';
import ExportChanges from '../ExportChanges';

import type { ExportView } from './components/ExportViewTab';
import type { SpecCorrection } from '@plitzi/sdk-authoring';

export type ExportViewerProps = {
  /** Every file of the export, by path: one shows alone, a few as tabs, many beside a list to pick from. */
  paths: string[];
  selectedPath?: string;
  content?: string;
  /** What the export tidied on the way; a view of its own when there is any. */
  corrections: SpecCorrection[];
  mode: 'js' | 'json';
  theme: 'light' | 'dark';
  loading: boolean;
  onSelectPath: (path: string) => void;
};

/** The export itself, read-only — the code, and on a view of its own, what was tidied to write it. */
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
  const hasChanges = corrections.length > 0;
  const showChanges = view === 'changes' && hasChanges;
  const navigation = fileNavigationOf(paths);

  return (
    <div className="border-ui-line relative flex min-h-0 grow flex-col overflow-hidden rounded-lg border">
      <div className="border-ui-line flex min-h-9 items-center justify-between gap-3 border-b px-2">
        <div role="tablist" className="flex min-w-0 items-center gap-1">
          {!showChanges &&
            navigation === 'tabs' &&
            paths.map(path => (
              <ExportFileTab key={path} path={path} selected={path === selectedPath} onSelect={onSelectPath} />
            ))}
          {!showChanges && navigation !== 'tabs' && selectedPath && (
            <span className="text-ui-fg-subtle truncate px-2 font-mono text-xs">{selectedPath}</span>
          )}
        </div>
        {hasChanges && (
          <div role="tablist" className="flex shrink-0 items-center">
            <ExportViewTab
              view="code"
              label="Code"
              icon="fa-solid fa-code"
              selected={!showChanges}
              onSelect={setView}
            />
            <ExportViewTab
              view="changes"
              label="Changes"
              icon="fa-solid fa-wand-magic-sparkles"
              count={corrections.length}
              selected={showChanges}
              onSelect={setView}
            />
          </div>
        )}
      </div>
      <div className="flex min-h-0 grow">
        {showChanges && (
          <div className="min-h-0 min-w-0 grow">
            <ExportChanges corrections={corrections} />
          </div>
        )}
        {!showChanges && navigation === 'list' && (
          <ExportFileTree paths={paths} selectedPath={selectedPath} onSelect={onSelectPath} />
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
        <div className="text-ui-fg-muted dark:bg-ui-panel/70 absolute inset-0 flex items-center justify-center gap-2 bg-white/70 text-sm backdrop-blur-[1px]">
          <i className="fa-solid fa-circle-notch fa-spin" />
          Generating…
        </div>
      )}
    </div>
  );
};

export default ExportViewer;
