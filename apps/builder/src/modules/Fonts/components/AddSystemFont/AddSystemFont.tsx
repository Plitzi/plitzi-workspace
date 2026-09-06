import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useState } from 'react';

import { FontValidationError, parseSpaceFont } from '@plitzi/sdk-shared/style';

import type { SpaceFont } from '@plitzi/sdk-shared';

export type AddSystemFontProps = {
  onAdd: (font: SpaceFont) => void;
};

/**
 * A stack the visitor's machine is expected to have already: a licensed face installed across a company, or a
 * platform family the common stacks do not cover.
 *
 * Nothing is downloaded, which is the whole appeal — and the whole risk. Whoever does not have it installed reads
 * the fallback, so the fallback is the field that matters here.
 */
const AddSystemFont = ({ onAdd }: AddSystemFontProps) => {
  const [family, setFamily] = useState('');
  const [fallback, setFallback] = useState('system-ui, sans-serif');
  const [error, setError] = useState<string>();

  const handleAdd = useCallback(() => {
    try {
      onAdd(parseSpaceFont({ source: 'system', family, fallback, weights: [400, 700], styles: ['normal', 'italic'] }));
      setFamily('');
      setError(undefined);
    } catch (err) {
      setError(err instanceof FontValidationError ? err.message : String(err));
    }
  }, [family, fallback, onAdd]);

  return (
    <Flex direction="column" gap={2}>
      <Input size="xs" label="Family" placeholder="Helvetica Neue" value={family} onChange={setFamily} />
      <Flex direction="column" gap={1}>
        <Input size="xs" label="Fallback" placeholder="system-ui, sans-serif" value={fallback} onChange={setFallback} />
        <span className="text-grayviolet-500 text-[10px]">
          What everyone without the font installed will read, which on the web is most people.
        </span>
      </Flex>
      <Button size="xs" className="ml-auto" onClick={handleAdd} disabled={!family}>
        Add stack
      </Button>
      {error && (
        <Alert intent="error" className="text-xs">
          {error}
        </Alert>
      )}
    </Flex>
  );
};

export default AddSystemFont;
