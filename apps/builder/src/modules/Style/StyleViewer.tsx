import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import { useCallback, use, useMemo } from 'react';

import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';

import type { DisplayMode, Element, StyleItem } from '@plitzi/sdk-shared';

const StyleViewer = () => {
  const { elementSelected } = use(BuilderSelectedContext);
  const {
    schema: { flat }
  } = use(BuilderSchemaContext);
  const {
    style: { platform }
  } = use(BuilderStyleContext);

  const selectorToString = useCallback(
    (selector: string) => {
      let style = '';
      if (!isEmpty(selector)) {
        Object.keys(platform).forEach(mode => {
          const segment = platform[mode as DisplayMode][selector] as StyleItem | undefined;

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
    () =>
      get(flat, `${elementSelected}.definition.styleSelectors`) as unknown as
        | Element['definition']['styleSelectors']
        | undefined,
    [elementSelected, flat]
  );

  const style = useMemo(
    () =>
      Object.values(styleSelectors ?? {}).reduce(
        (acum, selector) => `${acum}${acum === '' ? '' : '\n'}${selectorToString(selector)}`,
        ''
      ),
    [styleSelectors, selectorToString]
  );

  return (
    <div className="flex grow flex-col">
      <CodeMirror theme="dark" readOnly value={style} />
    </div>
  );
};

export default StyleViewer;
