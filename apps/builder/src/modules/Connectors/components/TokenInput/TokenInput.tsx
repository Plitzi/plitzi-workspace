import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import Label from '@plitzi/plitzi-ui/Label';
import { use, useMemo } from 'react';

import { getConnectorTokens } from '@plitzi/sdk-shared/connectors';
import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';

import type { AutoComplete } from '@plitzi/plitzi-ui/CodeMirror';
import type { ConnectorTokenScope } from '@plitzi/sdk-shared';

export type TokenInputProps = {
  label: string;
  /** Hover text. The same line is available in full under the section's help toggle via `FieldHelp`. */
  title?: string;
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
const TokenInput = ({ label, title, value, placeholder, scope = 'request', onChange }: TokenInputProps) => {
  const { resolvedTheme } = use(ThemeContext);
  const autoComplete = useMemo<AutoComplete[]>(
    () => getConnectorTokens(scope).map(token => ({ type: 'token', value: token.value, detail: token.description })),
    [scope]
  );

  return (
    <div className="flex flex-col gap-1" title={title}>
      <Label size="xs">{label}</Label>
      <CodeMirror
        value={value}
        mode="text"
        multiline={false}
        theme={resolvedTheme}
        placeholder={placeholder}
        autoComplete={autoComplete}
        size="xs"
        onChange={onChange}
      />
    </div>
  );
};

export default TokenInput;
