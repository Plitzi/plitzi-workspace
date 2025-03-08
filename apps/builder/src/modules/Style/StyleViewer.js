// Packages
import React, { useCallback, use, useMemo } from 'react';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';

import BuilderSelectedContext from '@plitzi/sdk-shared/builder/BuilderSelectedContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/BuilderSchemaContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/BuilderStyleContext';

/** @returns {React.ReactElement} */
const StyleViewer = () => {
  const { elementSelected } = use(BuilderSelectedContext);
  const {
    schema: { flat }
  } = use(BuilderSchemaContext);
  const {
    style: { platform }
  } = use(BuilderStyleContext);

  const selectorToString = useCallback(
    selector => {
      let style = '';
      if (!isEmpty(selector)) {
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

  const style = useMemo(
    () =>
      Object.values(styleSelectors).reduce(
        (acum, selector) => `${acum}${acum === '' ? '' : '\n'}${selectorToString(selector)}`,
        ''
      ),
    [styleSelectors, selectorToString]
  );

  return (
    <div className="flex flex-col grow">
      <CodeMirror theme="dark" readOnly value={style} />
    </div>
  );
};

export default StyleViewer;
