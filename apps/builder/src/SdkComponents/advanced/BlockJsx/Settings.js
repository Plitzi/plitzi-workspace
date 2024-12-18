// Packages
import React, { useCallback, use, useState } from 'react';
import { usePlitziServiceContext } from '@plitzi/plitzi-sdk';
import noop from 'lodash/noop';
import get from 'lodash/get';
import Button from '@plitzi/plitzi-ui-components/Button';
import Checkbox from '@plitzi/plitzi-ui-components/Checkbox';
import Alert from '@plitzi/plitzi-ui-components/Alert';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';

// Alias
import useNetwork from '@pmodules/Network/hooks/useNetwork';
import ElementAdvancedEditor from '@pmodules/Elements/ElementAdvancedEditor';

// content is done in builder side and injected here as child

/**
 * @param {{
 *   content?: string;
 *   contentCache?: string;
 *   props?: string;
 *   allowEmptyRender?: boolean;
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Settings = props => {
  const { content = '', props: componentProps = '{}', allowEmptyRender = false, onUpdate = noop } = props;
  const {
    contexts: { NetworkContext }
  } = usePlitziServiceContext();
  const { server, webKey } = use(NetworkContext);
  const [error, setError] = useState(undefined);
  const { networkQuery, networkLoading } = useNetwork({ initLoading: false, server, webKey });

  const generateJSX = useCallback(
    async data => {
      const queryResponse = await networkQuery('/utils/transform-jsx', { data }, 'post');
      const compiled = get(queryResponse, 'data');
      if (!compiled) {
        setError(get(queryResponse, 'error'));
        onUpdate('contentCache', '');

        return;
      }

      setError(undefined);
      onUpdate('contentCache', btoa(compiled));
    },
    [onUpdate, networkQuery]
  );

  const handleClick = useCallback(() => generateJSX(content), [generateJSX]);

  const handleChangeAllowEmpty = key => e => onUpdate(key, e.target.checked);

  const handleChangeContent = useCallback(value => onUpdate('content', value), [onUpdate]);

  const handleChangeProps = useCallback(value => onUpdate('props', value), [onUpdate]);

  return (
    <div className="flex flex-col grow">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Block JSX Settings</h1>
      </div>
      <ElementAdvancedEditor className="grow" value={content} mode="js" onChange={handleChangeContent} />
      <div className="flex flex-col pt-2">
        {error && (
          <Alert className="text-white mb-4" containerClassName="overflow-x-auto" iconClassName="" intent="danger">
            <div className="flex flex-col text-xs">
              <div className="whitespace-pre">{error.message}</div>
              <div className="my-2">
                Reason: <div className="inline-block font-bold">{error.reasonCode}</div>
              </div>
            </div>
          </Alert>
        )}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center">
            <Checkbox
              id="custom-is-plugin"
              checked={allowEmptyRender}
              onChange={handleChangeAllowEmpty('allowEmptyRender')}
              className="rounded mr-2"
            />
            <label htmlFor="custom-is-plugin" className="cursor-pointer select-none">
              Allow Empty Render
            </label>
          </div>
          <Button onClick={handleClick} disabled={networkLoading} className="rounded">
            {!networkLoading && 'Compile'}
            {networkLoading && (
              <div className="flex items-center justify-center">
                <i className="fas fa-sync fa-spin mr-1" />
                Compiling...
              </div>
            )}
          </Button>
        </div>
        <div className="flex flex-col mt-4">
          <label className="px-2">Properties</label>
          <CodeMirror
            className="min-h-[200px] p-0"
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
