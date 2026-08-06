import type { BuiltinParam, ParamSpec } from './paramSpec';

// Built-in data-binding transformers — a hand-maintained mirror of sdk-shared/dataSource/utility. A transformer
// post-processes the value a binding pulls from its source before it reaches the element field:
// `source → transformer₁ → transformer₂ → field`. The SSR runtime resolves each one by its `action` ALONE
// (`utility[action]`), so an unknown action makes the runtime skip it and pass the value through UNCHANGED — the
// exact silent failure this catalog guards against (e.g. inventing `template` instead of `twigTemplate`).
//
// Binding-transformer params are ALWAYS strings over the wire (BindingTransformer.params is Record<string,string>),
// so a boolean/select param is modeled here as a `select` over the string tokens it accepts — this catalog only
// validates param NAMES and select OPTIONS, never JS value types (unlike the interaction catalogs, whose params are
// real scalars).

export interface BuiltinTransformer {
  title: string;
  // What the transformer does — so the agent picks the right one instead of inventing an action.
  description: string;
  // When true the param set is CLOSED: any key not listed is a mistake (the runtime ignores it), warned in validation.
  strictParams: boolean;
  params: ParamSpec;
}

// A string flag param (checkbox in the builder) is stored as the string "true"/"false" in a binding transformer.
const boolParam = (description: string, dflt: 'true' | 'false'): BuiltinParam => ({
  type: 'select',
  description,
  default: dflt,
  options: ['true', 'false']
});

export const BUILTIN_TRANSFORMERS: Record<string, BuiltinTransformer> = {
  twigTemplate: {
    title: 'Twig Template',
    description:
      'Render a Twig template around the bound value — the way to format/wrap a value (add units, compose a label). ' +
      'The incoming value is the token {{source}} (NOT {{value}}); {{sourceTo}} is the field’s previous value, and ' +
      'other data-source tokens are in scope too.',
    strictParams: true,
    params: {
      template: {
        type: 'textarea',
        required: true,
        description:
          'The Twig template string. Reference the incoming value as {{source}} — e.g. "{{source}} min de cocción". ' +
          'There is NO {{value}} token; {{sourceTo}} is the field’s original value.'
      }
    }
  },
  dateConverter: {
    title: 'Date Converter',
    description:
      'Format a date/timestamp value. Reads a unix-seconds number (isUnix) or a parseable date string and outputs a ' +
      'formatted date, or a relative "x ago" string (asAge).',
    strictParams: true,
    params: {
      format: {
        type: 'text',
        default: 'dd/MM/yyyy',
        description: 'date-fns format pattern, e.g. "dd/MM/yyyy" or "PPpp". Ignored when asAge is true.'
      },
      asAge: boolParam('Output a relative "x ago" string instead of a formatted date.', 'false'),
      isUnix: boolParam('The source value is a unix timestamp in SECONDS (not milliseconds).', 'true'),
      isUtc: boolParam('Format in UTC instead of local time.', 'false'),
      locale: {
        type: 'select',
        default: 'en',
        options: ['en', 'es', 'pt'],
        description: 'Locale for month/day names and relative text.'
      }
    }
  },
  capitalize: {
    title: 'Capitalize',
    description: 'Capitalize the first letter of a string value. Takes no params.',
    strictParams: true,
    params: {}
  },
  staticValue: {
    title: 'Static Value',
    description:
      'Ignore the source and emit a fixed value — use to hard-code a bound field. With valueType "select" the value ' +
      'is coerced to a boolean ("true"→true).',
    strictParams: true,
    params: {
      valueType: {
        type: 'select',
        default: 'text',
        options: ['text', 'textarea', 'select'],
        description: 'How `value` is interpreted: "text"/"textarea" → string, "select" → boolean ("true"/"false").'
      },
      value: {
        type: 'text',
        description: 'The constant value to emit (a string; "true"/"false" when valueType is select).'
      }
    }
  },
  arrayMap: {
    title: 'Array Map',
    description:
      'Reshape each object of a source array by remapping keys — pick/rename fields for a list. Input must be an ' +
      'array; a non-array passes through unchanged.',
    strictParams: true,
    params: {
      keys: {
        type: 'textarea',
        required: true,
        default: '[{"from": "", "to": ""}]',
        description:
          'A JSON array of { "from": <source path>, "to": <output key> } mappings, e.g. ' +
          '[{"from":"title","to":"label"},{"from":"id","to":"value"}].'
      }
    }
  },
  stringToArray: {
    title: 'Text to List',
    description:
      'Split a string into an array on a separator (each item trimmed). A non-string passes through unchanged.',
    strictParams: true,
    params: {
      separator: { type: 'text', default: ',', description: 'The delimiter to split on, e.g. "," or "|".' }
    }
  },
  styleSelector: {
    title: 'Style Selector',
    description:
      'Compute a style-class selector from data — bind a `style` target to switch an element’s class at runtime. ' +
      'Builder-oriented (its `selector` options come from the style schema); prefer style variants for most cases.',
    strictParams: true,
    params: {
      append: boolParam('Append `selector` to the existing selector instead of replacing it.', 'false'),
      originalSelector: boolParam(
        'When appending, keep the element’s original base selector (requires append).',
        'false'
      ),
      selector: { type: 'text', description: 'The class-selector name to apply (a class from the style schema).' }
    }
  },
  styleVariant: {
    title: 'Style Variant',
    description:
      'Compute an applied style-variant map from data — bind an `initialState` target to switch a variant at runtime. ' +
      'Builder-oriented (key/variant options come from the element’s style schema); prefer static variants for most cases.',
    strictParams: true,
    params: {
      key: { type: 'text', description: 'The selector key to target, e.g. "<type>.base".' },
      variant: { type: 'text', description: 'The variant name to apply under `key`.' },
      append: boolParam('Merge with the existing variant map instead of replacing it.', 'false')
    }
  }
};

/** The built-in transformer for an action, or undefined when the action is not a known built-in transformer. */
export const getTransformer = (action: string): BuiltinTransformer | undefined =>
  Object.hasOwn(BUILTIN_TRANSFORMERS, action) ? BUILTIN_TRANSFORMERS[action] : undefined;

/** The closest known transformer action to a mistyped one (substring match either way), so a wrong action like
 *  "template" teaches "twigTemplate". Undefined when nothing is close. */
export const suggestTransformer = (action: string): string | undefined => {
  const needle = action.toLowerCase();

  return Object.keys(BUILTIN_TRANSFORMERS).find(name => {
    const known = name.toLowerCase();

    return known.includes(needle) || needle.includes(known);
  });
};

export interface TransformerInfo {
  action: string;
  title: string;
  description: string;
  params: {
    name: string;
    type: string;
    description: string;
    default?: string | number | boolean;
    options?: string[];
  }[];
}

/** The transformer catalog projected for the data-sources resource / primer, so the agent knows the exact action
 *  names and params up front (the real fix for the "agent can't write transformers" problem). */
export const transformerCatalog = (): TransformerInfo[] =>
  Object.entries(BUILTIN_TRANSFORMERS).map(([action, { title, description, params }]) => ({
    action,
    title,
    description,
    params: Object.entries(params).map(([name, spec]) => ({
      name,
      type: spec.type,
      description: spec.description,
      ...(spec.default !== undefined ? { default: spec.default } : {}),
      ...(spec.options ? { options: spec.options } : {})
    }))
  }));
