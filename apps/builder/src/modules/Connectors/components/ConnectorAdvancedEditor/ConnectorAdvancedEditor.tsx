import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import { use, useMemo } from 'react';

import { connectorTokens } from '@plitzi/sdk-shared/connectors';
import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';

import type { AutoComplete } from '@plitzi/plitzi-ui/CodeMirror';

export type ConnectorAdvancedEditorProps = {
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

/**
 * The manifest as the server stores it.
 *
 * The basic editor covers the fields a CMS connector actually needs; this is here for the provider that does not fit
 * — an extra endpoint, a hand-written operator, a field the form has no control for. Both edit the same document,
 * so switching modes is not a conversion.
 */
const ConnectorAdvancedEditor = ({ value, error, onChange }: ConnectorAdvancedEditorProps) => {
  const { theme } = use(ThemeContext);
  const autoComplete = useMemo<AutoComplete[]>(
    () => connectorTokens.map(token => ({ type: 'token', value: token.value, detail: token.description })),
    []
  );

  return (
    <div className="flex min-h-80 grow flex-col gap-2">
      <CodeMirror
        value={value}
        theme={theme === 'dark' ? 'dark' : 'light'}
        mode="json"
        lineWrapping
        autoComplete={autoComplete}
        onChange={onChange}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
      <span className="text-xs text-gray-500 dark:text-zinc-400">
        Reference a credential by key — <code>{'{{credential.token}}'}</code> resolves on the server. The secret itself
        never leaves it, and neither does this manifest.
      </span>
    </div>
  );
};

export default ConnectorAdvancedEditor;
