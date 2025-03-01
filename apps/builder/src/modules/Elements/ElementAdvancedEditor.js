// Packages
import React, { useCallback, use, useMemo } from 'react';
import classNames from 'classnames';
import get from 'lodash/get';
import noop from 'lodash/noop';
import capitalize from 'lodash/capitalize';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';
import Button from '@plitzi/plitzi-ui-components/Button';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';

// Alias
import ComponentContext from '@plitzi/sdk-elements/ComponentContext';
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
    <div className={classNames('h-full flex flex-col relative', className)}>
      <CodeMirror value={value} theme="dark" lineWrapping onChange={handleChange} mode={mode} />
      <div className="flex absolute top-3 right-3">
        <Button
          intent="custom"
          size="custom"
          className="p-2 bg-white rounded-sm mr-2"
          onClick={handleFormat}
          tilte="Auto format"
          disabled={networkLoading}
        >
          <i className="fa-solid fa-wand-magic-sparkles" />
        </Button>
        <Dropdown showIcon={false} containerLeftOffset={-208}>
          <Dropdown.Content>
            <Button intent="custom" size="custom" className="p-2 bg-white rounded-sm mr-2" title="Plugins">
              <i className="fa-solid fa-puzzle-piece" />
            </Button>
          </Dropdown.Content>
          <Dropdown.Container>
            <ul className="max-h-[300px] overflow-y-auto">
              {pluginsAvailables.map(type => (
                <li key={type} className="border border-t px-4 py-2 border-gray-300" onClick={handlePluginInsert(type)}>
                  {type}
                </li>
              ))}
            </ul>
          </Dropdown.Container>
        </Dropdown>
        <Dropdown showIcon={false} containerLeftOffset={-208}>
          <Dropdown.Content>
            <Button intent="custom" size="custom" className="p-2 bg-white rounded-sm">
              <i className="fa-solid fa-circle-info" />
            </Button>
          </Dropdown.Content>
          <Dropdown.Container>
            <div className="w-60 flex flex-col items-center justify-center p-4 text-center">
              <p>
                Add your own <span className="font-bold">{mode === 'js' ? 'JSX' : 'HTML'}</span> code here to customize
                the appearance and layout of your site.
              </p>
              <p>
                <span className="font-bold">Ctrl + Space</span> to autocomplete.
              </p>
            </div>
          </Dropdown.Container>
        </Dropdown>
      </div>
    </div>
  );
};

export default ElementAdvancedEditor;
