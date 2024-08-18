/* eslint-disable react/no-danger */
// Packages
import React, { useCallback, useMemo } from 'react';
import ContainerCollapsable from '@plitzi/plitzi-ui-components/ContainerCollapsable';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

/**
 * @param {{
 *   className?: string;
 *   message?: string;
 *   params?: object;
 * }} props
 * @returns {React.ReactElement}
 */
const Log = props => {
  const { message, params = emptyObject } = props;

  const syntaxHighlight = useCallback(json => {
    const regexCallback = match => {
      let cls = 'number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-red-700';
        } else {
          cls = 'text-green-700';
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-blue-700';
      } else if (/null/.test(match)) {
        cls = '';
      }

      return `<span class="${cls}">${match}</span>`;
    };

    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      regexCallback
    );
  }, []);

  const content = useMemo(() => syntaxHighlight(JSON.stringify({ ...(params?.node ?? {}) }, null, 2)), [params.node]);

  return (
    <ContainerCollapsable
      className="w-full border-b last:border-b-none border-gray-300 px-2 py-1"
      title={message}
      collapsed
    >
      <div className="flex whitespace-pre">
        <pre dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </ContainerCollapsable>
  );
};

export default Log;
