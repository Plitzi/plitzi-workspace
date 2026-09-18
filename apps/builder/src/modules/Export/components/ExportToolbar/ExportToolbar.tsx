import Button from '@plitzi/plitzi-ui/Button';

import ExportFormatButton from './components/ExportFormatButton';
import { EXPORT_FORMATS } from '../../helpers/exportFormats';

import type { ExportFormat } from '../../helpers/exportFormats';

export type ExportToolbarProps = {
  format: ExportFormat;
  /** What the shown code can be copied as, and the file the export downloads as — absent until there is one. */
  fileName?: string;
  canCopy: boolean;
  onChangeFormat: (format: ExportFormat) => void;
  onCopy: () => void;
  onDownload: () => void;
};

/** The format on the left, what can be done with the result on the right — one row, one place for every action. */
const ExportToolbar = ({ format, fileName, canCopy, onChangeFormat, onCopy, onDownload }: ExportToolbarProps) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div role="tablist" className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
      {EXPORT_FORMATS.map(option => (
        <ExportFormatButton
          key={option.value}
          option={option}
          selected={option.value === format}
          onSelect={onChangeFormat}
        />
      ))}
    </div>
    <div className="flex items-center gap-2">
      <Button size="sm" intent="secondary" onClick={onCopy} disabled={!canCopy}>
        <Button.Icon icon="fa-regular fa-copy" />
        Copy
      </Button>
      <Button size="sm" onClick={onDownload} disabled={!fileName} title={fileName}>
        <Button.Icon icon="fa-solid fa-download" />
        Download
      </Button>
    </div>
  </div>
);

export default ExportToolbar;
