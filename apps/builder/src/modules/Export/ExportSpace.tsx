import Alert from '@plitzi/plitzi-ui/Alert';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback } from 'react';

import { useTheme } from '@plitzi/sdk-shared/theme';

import ExportLocked from './components/ExportLocked';
import ExportToolbar from './components/ExportToolbar';
import ExportViewer from './components/ExportViewer';
import { downloadBlob, exportBlob } from './helpers/exportFiles';
import { descriptionOf } from './helpers/exportFormats';
import useExportSession from './hooks/useExportSession';

/**
 * A copy of the space on screen, as JSON or as the code that authors it.
 *
 * Generated as soon as a format is picked and shown before anything is saved, so the code can be copied straight into
 * an editor, or downloaded, from the one row of actions above it. The code is a paid plan's: on the free plan the dialog
 * says so in its place and offers the JSON, which every plan downloads.
 */
const ExportSpace = () => {
  const session = useExportSession();
  const { resolvedTheme } = useTheme();
  const { addToast } = useToast();
  const { content, spaceExport, changeFormat } = session;

  const handleCopy = useCallback(async () => {
    if (content === undefined) {
      return;
    }

    await navigator.clipboard.writeText(content);
    addToast('Copied to the clipboard', { appeareance: 'success', autoDismiss: true, placement: 'top-right' });
  }, [addToast, content]);

  const pickJson = useCallback(() => changeFormat('json'), [changeFormat]);

  const handleDownload = useCallback(async () => {
    if (!spaceExport) {
      return;
    }

    downloadBlob(spaceExport.fileName, await exportBlob(spaceExport));
  }, [spaceExport]);

  return (
    <div className="flex h-[min(760px,78vh)] flex-col gap-3">
      <ExportToolbar
        format={session.format}
        fileName={session.locked ? undefined : spaceExport?.fileName}
        canCopy={!session.locked && content !== undefined}
        onChangeFormat={session.changeFormat}
        onCopy={handleCopy}
        onDownload={handleDownload}
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{descriptionOf(session.format)}</p>
      {session.locked && <ExportLocked planName={session.planName} onPickJson={pickJson} />}
      {!session.locked && session.error && (
        <Alert intent="error" size="sm">
          {session.error}
        </Alert>
      )}
      {!session.locked && (
        <ExportViewer
          paths={session.paths}
          selectedPath={session.selectedPath}
          content={content}
          corrections={spaceExport?.corrections ?? []}
          mode={session.format === 'json' ? 'json' : 'js'}
          theme={resolvedTheme}
          loading={session.loading}
          onSelectPath={session.selectPath}
        />
      )}
    </div>
  );
};

export default ExportSpace;
