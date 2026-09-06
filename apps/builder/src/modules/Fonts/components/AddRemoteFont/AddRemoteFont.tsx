import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useState } from 'react';

import { FontValidationError, parseSpaceFont } from '@plitzi/sdk-shared/style';

import type { SpaceFont } from '@plitzi/sdk-shared';

export type AddRemoteFontProps = {
  onAdd: (font: SpaceFont) => void;
};

const parseWeights = (value: string): number[] =>
  value
    .split(',')
    .map(part => Number(part.trim()))
    .filter(weight => Number.isFinite(weight) && weight > 0);

/**
 * A family that lives on somebody else's origin: Adobe Fonts, Bunny, Fontshare, the customer's own CDN.
 *
 * The weights are typed rather than discovered, because nothing on our side can read them out of a foundry's kit —
 * and they are not decoration: they are what the weight select offers, and what tells a bold apart from one the
 * browser drew itself.
 */
const AddRemoteFont = ({ onAdd }: AddRemoteFontProps) => {
  const [family, setFamily] = useState('');
  const [fallback, setFallback] = useState('system-ui, sans-serif');
  const [stylesheet, setStylesheet] = useState('');
  const [weights, setWeights] = useState('400, 700');
  const [italic, setItalic] = useState(false);
  const [error, setError] = useState<string>();

  const handleAdd = useCallback(() => {
    try {
      onAdd(
        parseSpaceFont({
          source: 'remote',
          family,
          fallback,
          stylesheet,
          weights: parseWeights(weights),
          styles: italic ? ['normal', 'italic'] : ['normal'],
          display: 'swap'
        })
      );
      setFamily('');
      setStylesheet('');
      setError(undefined);
    } catch (err) {
      setError(err instanceof FontValidationError ? err.message : String(err));
    }
  }, [family, fallback, stylesheet, weights, italic, onAdd]);

  return (
    <Flex direction="column" gap={2}>
      <Flex direction="column" gap={1}>
        <Input size="xs" label="Family" placeholder="Founders Grotesk" value={family} onChange={setFamily} />
        <span className="text-grayviolet-500 text-[10px]">
          Exactly as the stylesheet names it — this is what font-family will say.
        </span>
      </Flex>
      <Flex direction="column" gap={1}>
        <Input
          size="xs"
          label="Stylesheet URL"
          placeholder="https://use.typekit.net/abcdefg.css"
          value={stylesheet}
          onChange={setStylesheet}
        />
        <span className="text-grayviolet-500 text-[10px]">An https URL that declares the @font-face rules.</span>
      </Flex>
      <Input size="xs" label="Weights" placeholder="400, 700" value={weights} onChange={setWeights} />
      <Flex direction="column" gap={1}>
        <Input size="xs" label="Fallback" placeholder="system-ui, sans-serif" value={fallback} onChange={setFallback} />
        <span className="text-grayviolet-500 text-[10px]">What renders until the face arrives.</span>
      </Flex>
      <Flex gap={2} alignItems="center">
        <Button size="xs" intent={italic ? 'primary' : 'secondary'} onClick={() => setItalic(state => !state)}>
          Italic
        </Button>
        <Button size="xs" className="ml-auto" onClick={handleAdd} disabled={!family || !stylesheet}>
          Add font
        </Button>
      </Flex>
      {error && (
        <Alert intent="error" className="text-xs">
          {error}
        </Alert>
      )}
      <span className="text-grayviolet-500 text-[10px]">
        Plitzi links this stylesheet as it is: it is fetched by the visitor from that origin, and never proxied or
        cached here.
      </span>
    </Flex>
  );
};

export default AddRemoteFont;
