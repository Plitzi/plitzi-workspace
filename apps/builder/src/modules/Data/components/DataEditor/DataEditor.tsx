import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import clsx from 'clsx';

import { EDITOR_CLASS_NAME } from '@pmodules/FileTree';

import { queryOf } from '../../helpers';

export type DataEditorProps = {
  file: string;
  value: string;
  modified: boolean;
  /** What is wrong with the text as JSON, as it is typed — none when it reads. */
  problem?: string;
  theme: 'light' | 'dark';
  onChange: (text: string) => void;
};

/** The file being edited, with the query a provider reads it by and whether it is JSON as it stands. */
const DataEditor = ({ file, value, modified, problem, theme, onChange }: DataEditorProps) => (
  <div className="flex min-w-0 grow basis-0 flex-col overflow-hidden">
    <div className="border-ui-line flex h-9 shrink-0 items-center justify-between gap-3 border-b px-3">
      <span className="flex min-w-0 items-center gap-1 font-mono text-xs">
        <span className="text-ui-fg truncate font-medium">{queryOf(file)}</span>
        {modified && <span className="ml-1 size-1.5 shrink-0 rounded-full bg-amber-500" title="Unsaved changes" />}
      </span>
      <span
        className="text-ui-fg-subtle flex min-w-0 shrink items-center gap-1.5 truncate text-[11px]"
        title={problem ?? 'It reads as JSON'}
      >
        <span className={clsx('size-1.5 shrink-0 rounded-full', { 'bg-green-500': !problem, 'bg-red-500': problem })} />
        {problem ?? 'JSON'}
      </span>
    </div>
    <div className="min-h-0 min-w-0 grow basis-0 overflow-hidden">
      {/* One editor per file: its own undo history, and nothing typed in one ever lands in another. */}
      <CodeMirror
        key={file}
        className={EDITOR_CLASS_NAME}
        mode="json"
        theme={theme}
        value={value}
        onChange={onChange}
      />
    </div>
  </div>
);

export default DataEditor;
