// Packages
import React, { useCallback, useMemo } from 'react';
import get from 'lodash/get.js';
import isEmpty from 'lodash/isEmpty.js';
import CodeMirror from '@plitzi/plitzi-ui-components/CodeMirror';

/**
 * @param {{
 *   elementSelected: string;
 *   schema: object;
 *   style: object;
 * }} props
 * @returns {React.ReactElement}
 */
const StyleViewer = props => {
  const { elementSelected, schema, style } = props;
  const flat = useMemo(() => get(schema, 'flat', {}), [schema]);
  const platform = useMemo(() => get(style, 'platform', {}), [style]);

  const selectorToString = useCallback(
    selector => {
      let style = '';
      if (!isEmpty(selector)) {
        selector = btoa(selector);
        Object.keys(platform).forEach(mode => {
          const segment = platform[mode][selector];

          if (segment) {
            style = `${style}/* ${mode} */\n${segment.cache}\n`;
          }
        });

        style = style.replace(/(;)/gim, '$1\n');
        style = style.replace(/([a-z0-9\-_])({)/gim, '$1 $2\n');
        style = style.replace(/(})(\.)/gim, '$1\n$2');
        style = style.replace(/^([a-z\-:0-9#; %._(),]+)$/gim, '  $1');
      }

      return style;
    },
    [platform]
  );

  const styleSelectors = useMemo(
    () => get(flat, `${elementSelected}.definition.styleSelectors`, {}),
    [elementSelected, flat]
  );

  const styleStr = useMemo(
    () =>
      Object.values(styleSelectors).reduce(
        (acum, selector) => `${acum}${acum === '' ? '' : '\n'}${selectorToString(selector)}`,
        ''
      ),
    [styleSelectors, selectorToString]
  );

  return (
    <div className="flex flex-col grow">
      <CodeMirror theme="dark" readOnly value={styleStr} />
    </div>
  );
};

export default StyleViewer;
