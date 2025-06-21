// Packages
import React, { useCallback, use, useMemo } from 'react';
import classNames from 'classnames';
import get from 'lodash/get';
import noop from 'lodash/noop';
import capitalize from 'lodash/capitalize';
import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import Button from '@plitzi/plitzi-ui-components/Button';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';

// Alias
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import useNetwork from '@pmodules/Network/hooks/useNetwork';
import NetworkContext from '@pmodules/Network/NetworkContext';

/**
 * @param {{
 *   className?: string;
 *   value?: string;
 *   mode?: 'js' | 'html';
 *   onChange?: (value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const ElementAdvancedEditor = props => {
  const { className = '', value = '', mode = 'js', onChange = noop } = props;
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

  const handleChange = useCallback(v => onChange(v), [onChange]);

  const handleFormat = useCallback(async () => {
    const response = await networkQuery('/utils/prettier-parser', { data: value, parser: mode }, 'post');
    if (!response || !response.data) {
      return;
    }

    const valuePretty = get(response, 'data', value);
    if (valuePretty !== value) {
      onChange(valuePretty);
    }
  }, [onChange, value]);

  const handlePluginInsert = type => () => onChange(state => `${state}<${type}></${type}>`);

  return (
    <div className={classNames('relative flex h-full flex-col', className)}>
      <CodeMirror value={value} theme="dark" lineWrapping onChange={handleChange} mode={mode} />
      <div className="absolute top-3 right-3 flex">
        <Button
          intent="custom"
          size="custom"
          className="mr-2 rounded-sm bg-white p-2"
          onClick={handleFormat}
          tilte="Auto format"
          disabled={networkLoading}
        >
          <i className="fa-solid fa-wand-magic-sparkles" />
        </Button>
        <ContainerFloating showIcon={false} containerTopOffset={8}>
          <ContainerFloating.Trigger>
            <Button intent="custom" size="custom" className="mr-2 rounded-sm bg-white p-2" title="Plugins">
              <i className="fa-solid fa-puzzle-piece" />
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
        <ContainerFloating showIcon={false} containerTopOffset={8}>
          <ContainerFloating.Trigger>
            <Button intent="custom" size="custom" className="rounded-sm bg-white p-2">
              <i className="fa-solid fa-circle-info" />
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
