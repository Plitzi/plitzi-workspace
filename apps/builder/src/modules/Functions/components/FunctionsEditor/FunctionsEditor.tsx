import { EditorView, ViewPlugin } from '@codemirror/view';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import clsx from 'clsx';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import { EDITOR_CLASS_NAME } from '@pmodules/FileTree';

import { lineRange } from '../../helpers';

import type { EditorTarget } from '../../helpers';
import type { Extension } from '@codemirror/state';

export type FunctionsEditorProps = {
  file: string;
  value: string;
  modified: boolean;
  theme: 'light' | 'dark';
  /** The language service's extensions for this file — none until it is ready. Kept stable by the caller. */
  extensions: Extension[];
  /** Whether the language service is checking the code as it is typed. */
  checking: boolean;
  /** A line to bring into view and put the cursor on: a new `key` asks again, even for the same line. */
  target?: EditorTarget;
  onChange: (code: string) => void;
  /** Where the cursor is when the person moves it: the panel follows it to the task it is in. */
  onCursor: (file: string, offset: number) => void;
};

/** The file being edited, under the path it is at — one editor per file, so each keeps its own undo history. */
const FunctionsEditor = ({
  file,
  value,
  modified,
  theme,
  extensions,
  checking,
  target,
  onChange,
  onCursor
}: FunctionsEditorProps) => {
  const [editor, setEditor] = useState<{ view: EditorView; file: string } | undefined>(undefined);
  const reached = useRef<number | undefined>(undefined);
  const cursorListener = useRef(onCursor);
  const segments = useMemo(() => ['functions', ...file.split('/')], [file]);

  // The editor's view, known with the file it shows: a jump waits for the one its file opens in.
  const capture = useMemo(
    () =>
      ViewPlugin.define(view => {
        setEditor({ view, file });

        return { destroy: () => setEditor(current => (current?.view === view ? undefined : current)) };
      }),
    [file]
  );
  const follow = useMemo(
    () =>
      EditorView.updateListener.of(update => {
        if (update.selectionSet && update.view.hasFocus) {
          cursorListener.current(file, update.state.selection.main.head);
        }
      }),
    [file]
  );
  const allExtensions = useMemo(() => [...extensions, capture, follow], [capture, extensions, follow]);

  useEffect(() => {
    cursorListener.current = onCursor;
  }, [onCursor]);

  useEffect(() => {
    if (!editor || !target || editor.file !== target.file || reached.current === target.key) {
      return;
    }

    reached.current = target.key;
    const { from, to } = lineRange(editor.view.state.doc, target.line);
    editor.view.dispatch({
      selection: { anchor: from, head: to },
      effects: EditorView.scrollIntoView(from, { y: 'center' })
    });
    if (target.focus) {
      editor.view.focus();
    }
  }, [editor, target]);

  return (
    <div className="flex min-w-0 grow basis-0 flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-3 dark:border-zinc-800">
        <nav className="flex min-w-0 items-center gap-1 font-mono text-xs" aria-label="File">
          {segments.map((segment, index) => (
            <Fragment key={`${String(index)}:${segment}`}>
              {index > 0 && <span className="text-gray-300 dark:text-zinc-600">/</span>}
              <span
                className={clsx('truncate', {
                  'font-medium text-gray-900 dark:text-zinc-100': index === segments.length - 1,
                  'text-gray-500 dark:text-zinc-400': index < segments.length - 1
                })}
              >
                {segment}
              </span>
            </Fragment>
          ))}
          {modified && <span className="ml-1 size-1.5 shrink-0 rounded-full bg-amber-500" title="Unsaved changes" />}
        </nav>
        <span
          className="flex shrink-0 items-center gap-1.5 text-[11px] text-gray-500 dark:text-zinc-400"
          title={checking ? 'Types and errors are checked as you type' : 'Checked when you save'}
        >
          <span
            className={clsx('size-1.5 rounded-full', {
              'bg-green-500': checking,
              'bg-gray-300 dark:bg-zinc-600': !checking
            })}
          />
          TypeScript
        </span>
      </div>
      {/* CodeMirror scrolls its own content: the gutter stays put while a long line is scrolled to. */}
      <div className="min-h-0 min-w-0 grow basis-0 overflow-hidden">
        {/* One editor per file: its own undo history, and nothing typed in one ever lands in another. */}
        <CodeMirror
          key={file}
          className={EDITOR_CLASS_NAME}
          mode="ts"
          theme={theme}
          value={value}
          extensions={allExtensions}
          onChange={onChange}
        />
      </div>
    </div>
  );
};

export default FunctionsEditor;
