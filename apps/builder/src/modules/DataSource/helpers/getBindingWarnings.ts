import utility from '@plitzi/sdk-shared/dataSource/utility';

import type { BindingTransformer, SourceMeta } from '@plitzi/sdk-shared';

// Mirrors the interaction node-warning convention (see Interactions/.../nodeWarnings). `danger` — the binding is
// broken and produces nothing at runtime (no source, or a source out of scope). `warning` — the binding still runs
// but is misconfigured (an unknown transformer that gets skipped). Kept independent of the mcp-ai validator: the
// builder checks against the sources it actually renders from.
export type WarningLevel = 'warning' | 'danger';

export interface BindingWarning {
  level: WarningLevel;
  message: string;
}

/** FontAwesome classes (icon + color) per level — same visual language as the interaction indicators. */
export const WARNING_ICON: Record<WarningLevel, string> = {
  danger: 'fa-solid fa-circle-exclamation text-red-500',
  warning: 'fa-solid fa-triangle-exclamation text-orange-400'
};

/** The most severe level among a binding's warnings (danger beats warning), or undefined when there are none. */
export const worstLevel = (warnings: BindingWarning[]): WarningLevel | undefined => {
  if (warnings.some(w => w.level === 'danger')) {
    return 'danger';
  }

  return warnings.some(w => w.level === 'warning') ? 'warning' : undefined;
};

export type GetBindingWarningsProps = {
  source?: string;
  transformers?: BindingTransformer[];
  // The sources actually visible to this element (globals + ancestor providers), from getSourcesByElementId. A
  // binding whose source is not in here points at something out of scope — schema-valid but broken at runtime.
  sources?: Record<string, SourceMeta>;
};

// Problems with a SAVED binding, each tagged with a severity, surfaced in the builder so the user sees a binding is
// malformed. Mirrors the mcp-ai validator: a source not in scope for this element never resolves, and an unknown
// transformer action is silently skipped.
const getBindingWarnings = ({
  source = '',
  transformers = [],
  sources = {}
}: GetBindingWarningsProps): BindingWarning[] => {
  const warnings: BindingWarning[] = [];

  const dotIndex = source.indexOf('.');
  const sourceName = dotIndex > -1 ? source.substring(0, dotIndex) : source;

  if (!source) {
    warnings.push({ level: 'danger', message: 'This binding has no source selected, so it produces no value.' });
  } else if (sourceName && !(sourceName in sources)) {
    warnings.push({
      level: 'danger',
      message:
        `The source "${sourceName}" is not available to this element. A data source is only visible to elements ` +
        'inside its provider (e.g. the ApiContainer), so this binding is out of scope and will not resolve at ' +
        'runtime. Move the element under the provider, or pick a source that is in scope.'
    });
  }

  for (const transformer of transformers) {
    if (transformer.action && !(transformer.action in utility)) {
      warnings.push({
        level: 'warning',
        message:
          `Unknown transformer "${transformer.action}" — it is not a known transformer, so the runtime skips it ` +
          'and passes the value through unchanged.'
      });
    }
  }

  return warnings;
};

export default getBindingWarnings;
