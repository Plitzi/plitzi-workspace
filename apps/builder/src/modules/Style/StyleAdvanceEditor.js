// Packages
import React, { useCallback, useMemo, useState, useContext } from 'react';
import classNames from 'classnames';
import debounce from 'lodash/debounce';
import get from 'lodash/get';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';
import Button from '@plitzi/plitzi-ui-components/Button';
import CodeMirror from '@plitzi/plitzi-ui-components/CodeMirror';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

// Alias
import useNetwork from '@pmodules/Network/hooks/useNetwork';
import NetworkContext from '@pmodules/Network/NetworkContext';

/**
 * @param {{
 *   className?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const StyleAdvanceEditor = props => {
  const { className = '' } = props;
  const {
    schema: {
      settings: { customCss: customCssProp }
    },
    schemaUpdateSettings
  } = useContext(SchemaContext);
  const [customCss, setCustomCss] = useState(() => {
    if (typeof customCssProp !== 'string') {
      return '';
    }

    return customCssProp ?? '';
  });
  const schemaUpdateSettingsDebounce = useMemo(() => debounce(schemaUpdateSettings, 500), [schemaUpdateSettings]);
  const { server, webKey } = useContext(NetworkContext);
  const { networkQuery, networkLoading } = useNetwork({ initLoading: false, server, webKey });

  const handleChange = useCallback(
    value => {
      schemaUpdateSettingsDebounce(value, 'customCss');
      setCustomCss(value);
    },
    [setCustomCss, schemaUpdateSettingsDebounce]
  );

  const handleFormat = useCallback(async () => {
    const response = await networkQuery('/utils/prettier-parser', { data: customCss, parser: 'css' }, 'post');
    if (!response || !response.data) {
      return;
    }

    const customCssPretty = get(response, 'data', customCss);
    if (customCssPretty !== customCss) {
      setCustomCss(customCssPretty);
      schemaUpdateSettingsDebounce(customCssPretty, 'customCss');
    }
  }, [setCustomCss, schemaUpdateSettingsDebounce, customCss]);

  return (
    <div className={classNames('h-full flex flex-col relative', className)}>
      <CodeMirror value={customCss} theme="dark" lineWrapping onChange={handleChange} />
      <div className="flex absolute top-3 right-3">
        <Button
          intent="custom"
          size="custom"
          className="p-2 bg-white rounded mr-2"
          onClick={handleFormat}
          tilte="Auto format"
          disabled={networkLoading}
        >
          <i className="fa-solid fa-wand-magic-sparkles" />
        </Button>
        <Dropdown showIcon={false} containerLeftOffset={-208}>
          <Dropdown.Content>
            <Button intent="custom" size="custom" className="p-2 bg-white rounded">
              <i className="fa-solid fa-circle-info" />
            </Button>
          </Dropdown.Content>
          <Dropdown.Container>
            <div className="w-60 flex flex-col items-center justify-center p-4 text-center">
              <p>Add your own CSS code here to customize the appearance and layout of your site.</p>
              <a
                href="https://codex.wordpress.org/CSS"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline"
              >
                Learn more about CSS
                <span className="text-sm"> (opens in a new tab)</span>
              </a>
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

export default StyleAdvanceEditor;
