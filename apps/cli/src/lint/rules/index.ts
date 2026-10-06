import { colourNotToken } from './colourNotToken';
import { fileTooLong } from './fileTooLong';
import { inlineRecords } from './inlineRecords';
import { pagesInOneFile } from './pagesInOneFile';
import { positionalId } from './positionalId';
import { repeatedCss } from './repeatedCss';
import { specialCaseInMap } from './specialCaseInMap';
import { unusedFile } from './unusedFile';

import type { Rule } from '../types';

/** Every rule this command reads the source with, in the order a file's findings are said. */
export const RULES: readonly Rule[] = [
  unusedFile,
  fileTooLong,
  pagesInOneFile,
  inlineRecords,
  repeatedCss,
  specialCaseInMap,
  colourNotToken,
  positionalId
];
