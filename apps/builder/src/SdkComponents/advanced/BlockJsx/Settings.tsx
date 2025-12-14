import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import Heading from '@plitzi/plitzi-ui/Heading';
import get from 'lodash-es/get';
import { useCallback, use, useState } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import ElementAdvancedEditor from '@pmodules/Elements/ElementAdvancedEditor';
import useNetwork from '@pmodules/Network/hooks/useNetwork';

import type { ChangeEvent } from 'react';

// content is done in builder side and injected here as child

type SettingsProps = {
  content?: string;
  contentCache?: string;
  props?: string;
  allowEmptyRender?: boolean;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({
  content = '',
  props: componentProps = '{}',
  allowEmptyRender = false,
  onUpdate
}: SettingsProps) => {
  const {
    contexts: { NetworkContext }
  } = usePlitziServiceContext();
  const { server, webKey } = use(NetworkContext);
  const [error, setError] = useState<{ message: string; reasonCode: number } | undefined>(undefined);
  const { networkQuery, networkLoading } = useNetwork({ initLoading: false, server, webKey });

  const generateJSX = useCallback(
    async (data: string) => {
      const queryResponse = await networkQuery<{ data: string; error?: { message: string; reasonCode: number } }>(
        '/utils/transform-jsx',
        { data },
        'post'
      );
      if (!queryResponse) {
        return;
      }

      const compiled = get(queryResponse, 'data');
      if (!compiled) {
        setError(get(queryResponse, 'error'));
        onUpdate?.('contentCache', '');

        return;
      }

      setError(undefined);
      onUpdate?.('contentCache', btoa(compiled));
    },
    [onUpdate, networkQuery]
  );

  const handleClick = useCallback(() => void generateJSX(content), [generateJSX, content]);

  const handleChangeAllowEmpty = useCallback(
    (e: ChangeEvent) => onUpdate?.('allowEmptyRender', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  const handleChangeContent = useCallback((value: string) => onUpdate?.('content', value), [onUpdate]);

  const handleChangeProps = useCallback((value: string) => onUpdate?.('props', value), [onUpdate]);

  return (
    <div className="flex h-full flex-col">
      <ElementAdvancedEditor
        className="min-h-0 grow basis-0"
        value={content}
        mode="js"
        onChange={handleChangeContent}
      />
      <div className="flex flex-col py-2">
        {error && (
          <Alert className="mb-4 text-white" intent="error">
            <div className="flex flex-col text-xs">
              <div className="whitespace-pre">{error.message}</div>
              <div className="my-2">
                Reason: <div className="inline-block font-bold">{error.reasonCode}</div>
              </div>
            </div>
          </Alert>
        )}
        <div className="flex items-center justify-between">
          <Checkbox size="sm" checked={allowEmptyRender} onChange={handleChangeAllowEmpty} label="Allow Empty Render" />
          <Button size="sm" onClick={handleClick} disabled={networkLoading}>
            {!networkLoading && 'Compile'}
            {networkLoading && (
              <div className="flex items-center justify-center">
                <i className="fas fa-sync fa-spin mr-1" />
                Compiling...
              </div>
            )}
          </Button>
        </div>
        <div className="flex flex-col">
          <Heading as="h5">Properties</Heading>
          <CodeMirror
            size="sm"
            className="min-h-40 p-0"
            value={componentProps}
            theme="dark"
            mode="json"
            lineWrapping
            onChange={handleChangeProps}
          />
        </div>
      </div>
    </div>
  );
};

export default Settings;
