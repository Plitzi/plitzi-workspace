import Button from '@plitzi/plitzi-ui/Button';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import classNames from 'classnames';
import capitalize from 'lodash/capitalize';
import get from 'lodash/get';
import { useCallback, use, useMemo } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import useNetwork from '@pmodules/Network/hooks/useNetwork';

export type ElementAdvancedEditorProps = {
  className?: string;
  value?: string;
  mode?: 'js' | 'html';
  onChange?: (value: string) => void;
};

const ElementAdvancedEditor = ({ className = '', value = '', mode = 'js', onChange }: ElementAdvancedEditorProps) => {
  const { componentDefinitions } = use(ComponentContext);
  const { server, webKey } = use(NetworkContext);
  const { networkQuery, networkLoading } = useNetwork({ initLoading: false, server, webKey });
  const pluginsAvailables = useMemo(
    () =>
      Object.keys(componentDefinitions)
        .filter(type => !['page', 'notFound', 'loading', 'custom', 'blockJsx', 'blockHtml'].includes(type))
        .map(type => capitalize(type)),
    [componentDefinitions]
  );

  const handleChange = useCallback((newValue: string) => onChange?.(newValue), [onChange]);

  const handleFormat = useCallback(async () => {
    const response = await networkQuery<{ data: string }>(
      '/utils/prettier-parser',
      { data: value, parser: mode },
      'post'
    );
    if (!response || !response.data) {
      return;
    }

    const valuePretty = get(response, 'data', value);
    if (valuePretty !== value) {
      onChange?.(valuePretty);
    }
  }, [mode, networkQuery, onChange, value]);

  const handlePluginInsert = useCallback(
    (type: string) => () => onChange?.(`${value}<${type}></${type}>`),
    [onChange, value]
  );

  return (
    <div className={classNames('relative flex h-full flex-col', className)}>
      <CodeMirror value={value} theme="dark" className="h-full" lineWrapping onChange={handleChange} mode={mode} />
      <div className="absolute top-3 right-3 flex">
        <Button
          intent="custom"
          size="custom"
          className="mr-2 rounded-sm bg-white p-2"
          onClick={handleFormat}
          title="Auto format"
          disabled={networkLoading}
        >
          <Button.Icon icon="fa-solid fa-wand-magic-sparkles" />
        </Button>
        <ContainerFloating containerTopOffset={8}>
          <ContainerFloating.Trigger>
            <Button intent="custom" size="custom" className="mr-2 rounded-sm bg-white p-2" title="Plugins">
              <Button.Icon icon="fa-solid fa-puzzle-piece" />
            </Button>
          </ContainerFloating.Trigger>
          <ContainerFloating.Content>
            <ul className="max-h-[300px] overflow-y-auto">
              {pluginsAvailables.map(type => (
                <li
                  key={type}
                  className="border-gray-300 px-4 py-2 not-first:border-t"
                  onClick={handlePluginInsert(type)}
                >
                  {type}
                </li>
              ))}
            </ul>
          </ContainerFloating.Content>
        </ContainerFloating>
        <ContainerFloating containerTopOffset={8}>
          <ContainerFloating.Trigger>
            <Button intent="custom" size="custom" className="rounded-sm bg-white p-2">
              <Button.Icon icon="fa-solid fa-circle-info" />
            </Button>
          </ContainerFloating.Trigger>
          <ContainerFloating.Content>
            <div className="flex w-60 flex-col items-center justify-center p-4 text-center">
              <p>
                Add your own <span className="font-bold">{mode === 'js' ? 'JSX' : 'HTML'}</span> code here to customize
                the appearance and layout of your site.
              </p>
              <p>
                <span className="font-bold">Ctrl + Space</span> to autocomplete.
              </p>
            </div>
          </ContainerFloating.Content>
        </ContainerFloating>
      </div>
    </div>
  );
};

export default ElementAdvancedEditor;
