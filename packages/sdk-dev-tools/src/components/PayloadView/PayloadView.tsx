import JsonView from '@uiw/react-json-view';
import * as vscode from '@uiw/react-json-view/vscode';

import useTheme from '@plitzi/sdk-shared/theme/useTheme';

const jsonViewStyle = {
  ...vscode.vscodeTheme,
  width: '100%',
  overflow: 'auto',
  padding: '6px',
  fontSize: '11px'
};

export type PayloadViewProps = {
  value: unknown;
};

/**
 * A value, read the way the panel reads values: the same JSON viewer everywhere, wearing the panel's theme.
 *
 * Shared rather than per tab because the viewer ships a light palette and nothing else — on a dark panel its keys
 * come out near-black on near-black — and every tab that shows a payload had to remember to dress it.
 */
const PayloadView = ({ value }: PayloadViewProps) => {
  const { resolvedTheme } = useTheme();

  // A flow can answer with a bare value: `flow.output` names whatever the author wrote, and the JSON reader takes
  // an object or an array. Anything else is shown as it is rather than dropped.
  if (typeof value !== 'object' || value === null) {
    return (
      <pre className="overflow-auto p-1.5 font-mono text-[11px] break-words whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">
        {JSON.stringify(value)}
      </pre>
    );
  }

  return (
    <JsonView
      value={value}
      style={resolvedTheme === 'dark' ? jsonViewStyle : undefined}
      enableClipboard={false}
      displayDataTypes={false}
      collapsed={2}
    />
  );
};

export default PayloadView;
