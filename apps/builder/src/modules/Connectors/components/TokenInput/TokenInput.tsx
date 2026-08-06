import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import Label from '@plitzi/plitzi-ui/Label';
import { use, useMemo } from 'react';

import { getConnectorTokens } from '@plitzi/sdk-shared/connectors';
import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';

import type { AutoComplete } from '@plitzi/plitzi-ui/CodeMirror';
import type { ConnectorTokenScope } from '@plitzi/sdk-shared';

export type TokenInputProps = {
  label: string;
  description?: string;
  value: string;
  placeholder?: string;
  scope?: ConnectorTokenScope;
  onChange: (value: string) => void;
};

/**
 * A one-line field that completes the engine's template tokens.
 *
 * Every value in a manifest is a template, and the tokens are the part an author cannot guess — the difference
 * between `{{offset}}` and `{{page}}` decides whether paging works at all. Ctrl+Space (or typing a prefix) lists
 * what this position accepts, which is why these are CodeMirror fields rather than plain inputs.
 */
const TokenInput = ({ label, description, value, placeholder, scope = 'request', onChange }: TokenInputProps) => {
  const { theme } = use(ThemeContext);
  const autoComplete = useMemo<AutoComplete[]>(
    () => getConnectorTokens(scope).map(token => ({ type: 'token', value: token.value, detail: token.description })),
    [scope]
  );

  return (
    <div className="flex flex-col gap-1">
      <Label size="xs">{label}</Label>
      <CodeMirror
        value={value}
        mode="text"
        multiline={false}
        theme={theme === 'dark' ? 'dark' : 'light'}
        placeholder={placeholder}
        autoComplete={autoComplete}
        size="xs"
        onChange={onChange}
      />
      {description && <span className="text-xs text-gray-500 dark:text-zinc-400">{description}</span>}
    </div>
  );
};

export default TokenInput;
