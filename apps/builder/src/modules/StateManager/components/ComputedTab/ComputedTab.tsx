import { isRecord } from '@plitzi/sdk-shared/helpers';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import { preview } from '../../helpers';

/**
 * The space's computed values (`settings.computed`): each one's template and what it gives now, on the page as the
 * canvas runs it. Read only — a value is changed by changing what it reads, in the other tabs.
 */
const ComputedTab = () => {
  const [[declared, values]] = useBuilderStore(['schema.settings.computed', 'runtime.sources.computed']);
  const entries = Object.entries(declared ?? {});
  const current: Record<string, unknown> = isRecord(values) ? values : {};

  if (entries.length === 0) {
    return (
      <p className="text-ui-fg-subtle px-1 text-xs leading-relaxed">
        The space computes no value. A computed value is a template read everywhere as{' '}
        <code>{'{{ computed.name }}'}</code>, worked out once — declared in the space's settings.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {entries.map(([name, template]) => (
        <div key={name} className="border-ui-line flex flex-col gap-0.5 border-b px-1 py-2 last:border-b-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-ui-fg truncate font-mono text-xs">{name}</span>
            <span
              className="text-ui-fg-muted max-w-[55%] truncate font-mono text-[11px]"
              title={JSON.stringify(current[name])}
            >
              {preview(current[name])}
            </span>
          </div>
          <span className="text-ui-fg-subtle truncate font-mono text-[10px]" title={template}>
            {template}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ComputedTab;
