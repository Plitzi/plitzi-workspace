import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';

export type NodePreviewProps = {
  preview?: Record<string, unknown>;
  defaultPreview?: Record<string, unknown>;
  onChange?: (data: Record<string, unknown>) => void;
  onClickOpen?: () => void;
};

const NodePreview = ({ preview, defaultPreview, onChange }: NodePreviewProps) => {
  const { theme } = use(ThemeContext);
  const previewStr = useMemo(() => JSON.stringify(preview, null, 2), [preview]);
  const defaultPreviewStr = useMemo(() => JSON.stringify(defaultPreview, null, 2), [defaultPreview]);
  const [previewState, setPreviewState] = useState(previewStr);
  const [error, setError] = useState('');

  const handleChange = useCallback(
    (data: string) => {
      try {
        const dataParsed = JSON.parse(data) as unknown;
        if (previewStr !== data) {
          onChange?.({ preview: dataParsed });
        }

        setError('');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPreviewState(data);
      }
    },
    [previewStr, onChange]
  );

  const initRef = useRef(false);
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      if ((!preview || Object.keys(preview).length === 0) && defaultPreview && Object.keys(defaultPreview).length > 0) {
        onChange?.({ preview: defaultPreview });
      }

      return;
    }

    if (previewStr !== defaultPreviewStr) {
      onChange?.({ preview: defaultPreview });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPreview]);

  useEffect(() => {
    if (previewStr !== previewState) {
      setPreviewState(previewStr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewStr]);

  const isCollapsed = useMemo(
    () => !preview || Object.keys(preview).length === 0 || previewStr === defaultPreviewStr,
    [defaultPreviewStr, preview, previewStr]
  );

  return (
    <div className="flex flex-col items-center border-t-2 border-dotted border-gray-300 px-4 py-2 dark:border-zinc-600">
      <ContainerCollapsable className="flex w-full justify-center" collapsed={isCollapsed}>
        <ContainerCollapsable.Header title="Preview" placement="right" />
        <ContainerCollapsable.Content>
          <CodeMirror
            className="min-h-20 pt-2"
            value={previewState}
            theme={theme === 'dark' ? 'dark' : 'light'}
            mode="json"
            lineWrapping
            onChange={handleChange}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </ContainerCollapsable.Content>
      </ContainerCollapsable>
    </div>
  );
};

export default NodePreview;
