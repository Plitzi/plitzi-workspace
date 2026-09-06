import Badge from '@plitzi/plitzi-ui/Badge';
import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';

import { fontFamilyStack } from '@plitzi/sdk-shared/style';

import type { SpaceFont } from '@plitzi/sdk-shared';

export type FontRowProps = {
  font: SpaceFont;
  /** How many rules name this family. Removing one that is in use leaves those rules on their fallback. */
  uses: number;
  /** Whether this deployment has anywhere to copy a Google family INTO. */
  canMirror?: boolean;
  mirroring?: boolean;
  onRemove?: (family: string) => void;
  onMirror?: (family: string) => void;
};

const SOURCE_LABEL: Record<SpaceFont['source'], string> = {
  system: 'System',
  google: 'Google',
  remote: 'External',
  hosted: 'Uploaded'
};

const FontRow = ({ font, uses, canMirror = false, mirroring = false, onRemove, onMirror }: FontRowProps) => {
  return (
    <Flex direction="column" gap={1} className="border-grayviolet-200 rounded border p-2">
      <Flex justify="between" alignItems="center" gap={2}>
        {/* Drawn in the family it names — the point of loading the space's fonts into the editor document. */}
        <span className="truncate text-sm" style={{ fontFamily: fontFamilyStack(font) }}>
          {font.family}
        </span>
        <Flex alignItems="center" gap={1}>
          <Badge size="xs">{SOURCE_LABEL[font.source]}</Badge>
          {font.source === 'google' && canMirror && (
            <Button
              size="xs"
              intent="secondary"
              loading={mirroring}
              title="Copy the files here, so visitors stop fetching them from Google"
              onClick={() => onMirror?.(font.family)}
            >
              <Button.Icon icon="fa-solid fa-download" />
            </Button>
          )}
          {font.source !== 'system' && (
            <Button
              size="xs"
              intent="secondary"
              title={uses > 0 ? `Used by ${uses} rule${uses === 1 ? '' : 's'}` : 'Remove'}
              onClick={() => onRemove?.(font.family)}
            >
              <Button.Icon icon="fa-solid fa-trash" />
            </Button>
          )}
        </Flex>
      </Flex>
      <Flex gap={2} className="text-grayviolet-500 text-[10px]">
        <span>{font.weights.join(' · ')}</span>
        {font.styles.includes('italic') && <span>italic</span>}
        {uses > 0 && <span className="ml-auto">{uses} in use</span>}
      </Flex>
    </Flex>
  );
};

export default FontRow;
