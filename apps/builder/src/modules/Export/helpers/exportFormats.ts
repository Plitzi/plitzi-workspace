/** What a space can be exported as. */
export type ExportFormat = 'authoring' | 'authoring-split' | 'json';

export type ExportFormatOption = {
  value: ExportFormat;
  label: string;
  icon: string;
  description: string;
};

export const EXPORT_FORMATS: readonly ExportFormatOption[] = [
  {
    value: 'authoring',
    label: 'TypeScript',
    icon: 'fa-solid fa-code',
    description: 'The code that authors this space with @plitzi/sdk-authoring, in one file to paste into your editor.'
  },
  {
    value: 'authoring-split',
    label: 'TypeScript · per page',
    icon: 'fa-solid fa-folder-tree',
    description: 'The same code with a file per page and per layout, and one for the shared classes, as a .zip.'
  },
  {
    value: 'json',
    label: 'JSON',
    icon: 'fa-solid fa-file-code',
    description: 'The space’s two documents, schema and style, exactly as they are stored — a .zip of both.'
  }
];

export const DEFAULT_EXPORT_FORMAT: ExportFormat = 'authoring';

export const descriptionOf = (format: ExportFormat): string =>
  EXPORT_FORMATS.find(option => option.value === format)?.description ?? '';

/**
 * Whether `format` is held back by the workspace's plan: the code is a paid plan's, the documents are every plan's — a
 * free workspace takes its work as JSON (RFC 0029 §8). `refused`: the server said so, the plan unread.
 */
export const exportLocked = (format: ExportFormat, isFree: boolean, refused: boolean): boolean =>
  format !== 'json' && (isFree || refused);
