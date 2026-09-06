import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { use, useCallback, useRef, useState } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { FontValidationError, parseSpaceFont } from '@plitzi/sdk-shared/style';

import type { FontStyle, SpaceFont } from '@plitzi/sdk-shared';

export type AddHostedFontProps = {
  /** Already declared, so a second face of the same family is added to it rather than refused as a duplicate. */
  fonts: SpaceFont[];
  onAdd: (font: SpaceFont) => void;
  onUpdate: (family: string, font: SpaceFont) => void;
};

type UploadedFace = { path: string; format: 'woff2' | 'woff' };

const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/**
 * A face this deployment stores and serves itself.
 *
 * One file is one WEIGHT and one slant, which is why the two are asked for here rather than guessed: a family with
 * a real bold is a second upload, and the weight select in the inspector offers exactly what has been declared.
 * Uploading another face of a family that already exists extends it instead of starting a second entry, because
 * `font-family` could not tell two entries of one name apart anyway.
 */
const AddHostedFont = ({ fonts, onAdd, onUpdate }: AddHostedFontProps) => {
  const { server, userKey, webId } = use(NetworkContext);
  const inputRef = useRef<HTMLInputElement>(null);
  const [family, setFamily] = useState('');
  const [fallback, setFallback] = useState('system-ui, sans-serif');
  const [weight, setWeight] = useState('400');
  const [style, setStyle] = useState<FontStyle>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const upload = useCallback(
    async (file: File): Promise<UploadedFace | undefined> => {
      const response = await fetch(`${server.apiServer}/spaces/${webId}/fonts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'plitzi-access-token': userKey, 'Content-Type': 'application/octet-stream' },
        body: await file.arrayBuffer()
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string; hint?: string };
        setError([body.error ?? `The server answered ${response.status}.`, body.hint].filter(Boolean).join(' '));

        return undefined;
      }

      return (await response.json()) as UploadedFace;
    },
    [server.apiServer, webId, userKey]
  );

  const handleUpload = useCallback(async () => {
    const file = inputRef.current?.files?.[0];
    if (!file || !family) {
      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      const face = await upload(file);
      if (!face) {
        return;
      }

      const declared = fonts.find(item => item.family === family);
      const files = [
        ...(declared?.source === 'hosted' ? declared.files : []),
        { weight: Number(weight), style, format: face.format, path: face.path }
      ];
      const font = parseSpaceFont({
        source: 'hosted',
        family,
        fallback,
        weights: files.map(item => item.weight),
        styles: [...new Set(files.map(item => item.style))],
        display: 'swap',
        files
      });

      if (declared) {
        onUpdate(family, font);
      } else {
        onAdd(font);
      }

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof FontValidationError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [family, fallback, weight, style, fonts, upload, onAdd, onUpdate]);

  return (
    <Flex direction="column" gap={2}>
      <Input size="xs" label="Family" placeholder="Acme Grotesk" value={family} onChange={setFamily} />
      <Flex gap={2}>
        <Select size="xs" label="Weight" value={weight} onChange={setWeight} className="grow">
          {WEIGHTS.map(item => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Select size="xs" label="Style" value={style} onChange={value => setStyle(value as FontStyle)} className="grow">
          <option value="normal">Normal</option>
          <option value="italic">Italic</option>
        </Select>
      </Flex>
      <Flex direction="column" gap={1}>
        <Input size="xs" label="Fallback" placeholder="system-ui, sans-serif" value={fallback} onChange={setFallback} />
        <span className="text-grayviolet-500 text-[10px]">What renders until the face arrives.</span>
      </Flex>
      <input ref={inputRef} type="file" accept=".woff2,.woff,font/woff2,font/woff" className="text-xs" />
      <Button size="xs" className="ml-auto" loading={busy} disabled={!family || busy} onClick={handleUpload}>
        Upload face
      </Button>
      {error && (
        <Alert intent="error" className="text-xs">
          {error}
        </Alert>
      )}
      <span className="text-grayviolet-500 text-[10px]">
        One file per weight and slant. You are responsible for holding a licence that allows this font to be served from
        your site.
      </span>
    </Flex>
  );
};

export default AddHostedFont;
