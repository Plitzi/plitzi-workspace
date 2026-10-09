/* eslint-disable quotes -- the generated code quotes its own strings, and reads best in the other quotes */
import { elementTriggers } from '@plitzi/sdk-authoring';
import { BUILTIN_ELEMENT_CALLBACKS } from '@plitzi/sdk-shared/authoring/elementCallbacks';

import { tsString } from './quote';

import type { PluginNames } from './names';
import type { ElementText } from './source';

/**
 * An element written in its final shape, from what `plitzi plugin add` was told: its props with their types and
 * defaults, the events it fires and what each hands a flow, the actions it answers to, and whether it draws anything.
 *
 * The counter `plugin add` writes without them shows the three ways an element talks to a space, and is rewritten on
 * day one; told the shape, it writes that shape — four files with nothing to delete.
 */

/** `list` and `json` are data: a list of rows or a record, which a binding fills — `[]` and `{}` until it does. */
export const PROP_TYPES = ['string', 'number', 'boolean', 'list', 'json'] as const;

export type PropType = (typeof PROP_TYPES)[number];

export type PropValue = string | number | boolean | unknown[] | Record<string, unknown>;

export interface PropShape {
  name: string;
  type: PropType;
  value: PropValue;
}

/** The TypeScript a prop of each type is written with. */
const TS_TYPES: Record<PropType, string> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  list: 'unknown[]',
  json: 'Record<string, unknown>'
};

export interface TriggerShape {
  name: string;
  /** What a flow started by the event reads: `{{ <step>.count }}`. */
  fields: string[];
}

export interface ElementShape {
  props: PropShape[];
  triggers: TriggerShape[];
  callbacks: string[];
  /** Nothing to see: hidden on a page, a badge in the builder — a clock, a listener, a bridge to something else. */
  headless: boolean;
}

export interface ShapeFlags {
  prop?: string[];
  trigger?: string[];
  callback?: string[];
  headless?: boolean;
}

const IDENTIFIER = /^[a-z][A-Za-z0-9]*$/;

const EVENT = /^on[A-Z][A-Za-z0-9]*$/;

/** What the runtime hands every element already, so a prop of that name would never be the author's. */
const RESERVED_PROPS = ['className', 'children', 'ref', 'key', 'id', 'style'];

const parseProp = (flag: string): PropShape | string => {
  const match = /^([^:=]+):([^=]+)(?:=(.*))?$/.exec(flag);
  if (!match) {
    return `--prop ${flag}: write it name:type or name:type=default — interval:number=5000, paused:boolean, label:string=Hi, rows:list.`;
  }

  const [, name, type] = match;
  // The default is an optional group: absent when the flag gives none.
  const given: string | undefined = match.at(3);
  if (!IDENTIFIER.test(name) || RESERVED_PROPS.includes(name)) {
    return `--prop ${flag}: "${name}" is not a prop name of its own — camelCase, starting with a lowercase letter, and none of ${RESERVED_PROPS.join(', ')}.`;
  }

  const propType = PROP_TYPES.find(candidate => candidate === type);
  if (!propType) {
    return `--prop ${flag}: the type is ${PROP_TYPES.join(', ')}, not "${type}".`;
  }

  if (propType === 'number') {
    const value = given === undefined ? 0 : Number(given);

    return Number.isFinite(value) && given !== ''
      ? { name, type: propType, value }
      : `--prop ${flag}: "${given ?? ''}" is not a number.`;
  }

  if (propType === 'boolean') {
    if (given !== undefined && given !== 'true' && given !== 'false') {
      return `--prop ${flag}: a boolean's default is true or false, not "${given}".`;
    }

    return { name, type: propType, value: given === 'true' };
  }

  if (propType === 'list' || propType === 'json') {
    // Data a binding fills: what it holds before then is empty, and written as the binding will write it.
    if (given !== undefined) {
      return `--prop ${flag}: a ${propType} is data a binding fills — write it ${name}:${propType}, with no default.`;
    }

    return { name, type: propType, value: propType === 'list' ? [] : {} };
  }

  return { name, type: propType, value: given ?? '' };
};

const parseTrigger = (flag: string): TriggerShape | string => {
  const [name, ...rest] = flag.split(':');
  const fields = rest
    .join(':')
    .split(',')
    .map(field => field.trim())
    .filter(Boolean);
  if (!EVENT.test(name)) {
    return `--trigger ${flag}: an event is named on + what happened, in camelCase — onTick, onPick.`;
  }

  if (Object.hasOwn(elementTriggers, 'custom') && elementTriggers.custom.includes(name)) {
    return `--trigger ${flag}: every element already fires "${name}"; name the event after what this one does.`;
  }

  const wrong = fields.find(field => !IDENTIFIER.test(field));

  return wrong
    ? `--trigger ${flag}: "${wrong}" is not a field name — camelCase, starting with a lowercase letter.`
    : { name, fields };
};

const parseCallback = (name: string): string | { problem: string } => {
  if (!IDENTIFIER.test(name)) {
    return {
      problem: `--callback ${name}: an action is named in camelCase, starting with a lowercase letter — reset, play.`
    };
  }

  return Object.hasOwn(BUILTIN_ELEMENT_CALLBACKS, name)
    ? {
        problem: `--callback ${name}: every element already answers to "${name}"; name the action after what this one does.`
      }
    : name;
};

const repeated = (names: string[]): string | undefined => names.find((name, index) => names.indexOf(name) !== index);

/**
 * The shape the flags describe — `undefined` when none was given, which keeps the example — or the first thing wrong
 * with them, said so it can be fixed in one go.
 */
export const shapeFromFlags = (flags: ShapeFlags): { shape?: ElementShape; problem?: string } => {
  const given = [flags.prop, flags.trigger, flags.callback].some(list => list && list.length > 0) || flags.headless;
  if (!given) {
    return {};
  }

  const props: PropShape[] = [];
  for (const flag of flags.prop ?? []) {
    const prop = parseProp(flag);
    if (typeof prop === 'string') {
      return { problem: prop };
    }

    props.push(prop);
  }

  const triggers: TriggerShape[] = [];
  for (const flag of flags.trigger ?? []) {
    const trigger = parseTrigger(flag);
    if (typeof trigger === 'string') {
      return { problem: trigger };
    }

    triggers.push(trigger);
  }

  const callbacks: string[] = [];
  for (const flag of flags.callback ?? []) {
    const callback = parseCallback(flag);
    if (typeof callback !== 'string') {
      return { problem: callback.problem };
    }

    callbacks.push(callback);
  }

  const twice = repeated([...props.map(prop => prop.name), ...triggers.map(trigger => trigger.name), ...callbacks]);
  if (twice) {
    return { problem: `"${twice}" is named twice: a prop, an event and an action each need a name of their own.` };
  }

  return { shape: { props, triggers, callbacks, headless: flags.headless === true } };
};

/** `onTick` → `On Tick`, `pausedOnHover` → `Paused On Hover`: what the builder shows for a name. */
const titleOf = (name: string): string => {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');

  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};

const literal = (value: PropValue): string => {
  if (typeof value === 'string') {
    return tsString(value);
  }

  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

export const shapedDeclaration = (
  { component: name, type }: PluginNames,
  { title, description, owner }: ElementText,
  shape: ElementShape
): string => `import { definePlugin } from '@plitzi/sdk-authoring/plugin';

import type { ${name}Props } from './${name}';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ${name}Attributes = Omit<${name}Props, 'className'>;

/**
 * ${name}, declared: what a space names it by, its words, its defaults, the events it fires and the actions it answers.
 * Data only, no React — the build reads it to write the manifest. \`definePlugin\` writes the rest (the builder's
 * gestures, the catalogue entry, every attribute bindable), and a space places it with \`defineElement(declaration)\`.
 */
export default definePlugin<${name}Attributes>()({
  /** What a space names it by — the element type. Renaming it orphans every one. */
  type: '${type}',
  label: ${tsString(title)},
  /** What it is for: the builder shows it, and an agent connected over MCP reads it to choose the element. */
  description: ${tsString(description)},${
    shape.headless
      ? `
  /** It draws nothing on a page — it is there for what it does — so a page check never looks for it on screen. */
  drawsNothing: true,`
      : ''
  }
  /** The starting attributes — the component's defaults, written where the builder can show them. */
  attributes: { ${shape.props.map(prop => `${prop.name}: ${literal(prop.value)}`).join(', ')} },${
    shape.triggers.length > 0
      ? `
  /** The events it fires, and what a flow started by each reads — what \`usePluginTrigger\` hands it. */
  triggers: {${shape.triggers
    .map(trigger => `\n    ${trigger.name}: { preview: { ${trigger.fields.map(field => `${field}: ''`).join(', ')} } }`)
    .join(',')}\n  },`
      : ''
  }${
    shape.callbacks.length > 0
      ? `
  /** The actions it answers to, static half: the component adds the function that does each. */
  callbacks: { ${shape.callbacks.map(callback => `${callback}: {}`).join(', ')} },`
      : ''
  }
  market: { owner: ${tsString(owner)} }
});
`;

const callbacksSource = (callbacks: string[]): string =>
  callbacks.length === 0
    ? ''
    : `
  /** The declared actions, with what only a mounted element has: the function that does each. */
  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(
    () => ({${callbacks
      .map(
        callback => `
      ${callback}: {
        ...declaration.callbacks.${callback},
        callback: () => {
          // What \`${callback}\` does when a flow calls it.
        }
      }`
      )
      .join(',')}
    }),
    []
  );
`;

export const shapedComponent = ({ component: name, title }: PluginNames, shape: ElementShape): string => {
  const { props, triggers, callbacks, headless } = shape;
  const reactImports = callbacks.length > 0 ? ['useMemo'] : [];
  const sdkImports = ['RootElement', ...(headless ? ['usePlitzi'] : [])];
  const imports = [
    ...(reactImports.length > 0 ? [`import { ${reactImports.join(', ')} } from 'react';`, ''] : []),
    `import { ${sdkImports.join(', ')} } from '@plitzi/plitzi-sdk';`,
    '',
    "import declaration from './declaration';",
    '',
    ...(callbacks.length > 0 ? ["import type { InteractionCallback } from '@plitzi/plitzi-sdk';"] : []),
    "import type { CSSProperties } from 'react';"
  ];
  const params = [...props.map(prop => `${prop.name} = ${literal(prop.value)}`), 'className'].join(', ');
  const rootProps = [
    'className={className}',
    'style={style}',
    ...(triggers.length > 0 ? ['interactionTriggers={declaration.triggers}'] : []),
    ...(callbacks.length > 0 ? ['interactionCallbacks={interactionCallbacks}'] : [])
  ];
  // Headless, what it holds is only drawn in the builder; on a page the element is there, hidden, for what it does.
  const shown = (line: string): string => (headless ? `{!previewMode && ${line}}` : line);
  const body = [
    shown(`<span style={LABEL}>${title}</span>`),
    ...props.map(prop =>
      shown(
        `<span>${titleOf(prop.name)}: {${prop.type === 'list' || prop.type === 'json' ? `JSON.stringify(${prop.name})` : `String(${prop.name})`}}</span>`
      )
    )
  ]
    .map(line => `      ${line}`)
    .join('\n');
  const look = headless
    ? `
  const {
    settings: { previewMode }
  } = usePlitzi();
  const style = previewMode ? HIDDEN : BADGE;
`
    : `
  const style = CARD;
`;
  const styles = headless
    ? `const HIDDEN: CSSProperties = { display: 'none' };

/** In the builder: small, and in the colours of whatever page it is on. */
const BADGE: CSSProperties = {
  display: 'inline-flex',
  gap: '8px',
  padding: '4px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  border: '1px dashed color-mix(in srgb, currentColor 35%, transparent)'
};`
    : `/** Colours borrowed rather than chosen: a plugin does not know the palette of the page it is dropped on. */
const CARD: CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  gap: '4px',
  padding: '12px 16px',
  borderRadius: '12px',
  border: '1px solid color-mix(in srgb, currentColor 15%, transparent)'
};`;

  return `${imports.join('\n')}

/**
 * The props ARE the element's attributes: whatever a space writes on the element arrives here by the same name, and so
 * does whatever a binding writes later. Everything is optional with a default — an attribute nobody has authored yet,
 * or a binding whose source has not answered, is \`undefined\`.
 */
export interface ${name}Props {
${props.map(prop => `  ${prop.name}?: ${TS_TYPES[prop.type]};\n`).join('')}  /** Supplied by the runtime, not authored: the classes the element's own style rules are written against. */
  className?: string;
}

/**
 * ${
   headless
     ? 'Nothing to see on a page: it is there for what it does. In the builder it shows as a badge with its attributes, so it can be selected; on a page it renders hidden — still an element, so its events and actions are its own.'
     : 'What it draws — for now its attributes, to be replaced by what it is. Deterministic on its first render (the same markup on a server and in the browser); anything live goes in an effect.'
 }${
   triggers.length > 0
     ? `
 *
 * It fires its events with \`usePluginTrigger(declaration)\` from \`@plitzi/plitzi-sdk\`, typed by the declaration:
 * \`const fire = usePluginTrigger(declaration); fire('${triggers[0].name}', { ${triggers[0].fields.map(field => `${field}: …`).join(', ')} })\`.`
     : ''
 }
 */
const ${name} = ({ ${params} }: ${name}Props) => {${look}${callbacksSource(callbacks)}
  return (
    <RootElement
${rootProps.map(prop => `      ${prop}`).join('\n')}
    >
${body}
    </RootElement>
  );
};

${styles}

const LABEL: CSSProperties = { fontSize: '12px', opacity: 0.65 };

export default ${name};
`;
};

/** An `<input>` with these attributes at this indent, on one line while it fits in 120 columns — one per line past that. */
const inputTag = (attributes: string[], indent: string): string => {
  const inline = `${indent}<input ${attributes.join(' ')} />`;

  return inline.length <= 120
    ? inline
    : [`${indent}<input`, ...attributes.map(attribute => `${indent}  ${attribute}`), `${indent}/>`].join('\n');
};

const settingsControl = (prop: PropShape): string => {
  const label = titleOf(prop.name);
  if (prop.type === 'list' || prop.type === 'json') {
    return `    <p style={FIELD}>${label}: data — bind it to a source.</p>`;
  }

  if (prop.type === 'boolean') {
    return `    <label style={FIELD}>
${inputTag(['type="checkbox"', `checked={${prop.name}}`, `onChange={event => onUpdate?.('${prop.name}', event.target.checked)}`], '      ')}
      ${label}
    </label>`;
  }

  const attributes =
    prop.type === 'number'
      ? [
          'type="number"',
          `value={${prop.name}}`,
          `onChange={event => onUpdate?.('${prop.name}', Number(event.target.value))}`
        ]
      : [`value={${prop.name}}`, `onChange={event => onUpdate?.('${prop.name}', event.target.value)}`];

  return `    <label style={FIELD}>
      ${label}
${inputTag(['style={INPUT}', ...attributes], '      ')}
    </label>`;
};

export const shapedSettings = ({ component: name }: PluginNames, shape: ElementShape): string => {
  const { props } = shape;
  const typed = props.some(prop => prop.type === 'string' || prop.type === 'number');
  // Data has no control of its own — a binding fills it — so the panel reads only what it draws a control for.
  const edited = props.filter(prop => prop.type !== 'list' && prop.type !== 'json');
  const panel =
    props.length === 0
      ? 'const Settings = () => <div style={PANEL}>It has no attributes to set.</div>;'
      : `const Settings = ({ ${[...edited.map(prop => `${prop.name} = ${literal(prop.value)}`), 'onUpdate'].join(', ')} }: SettingsProps) => (
  <div style={PANEL}>
${props.map(settingsControl).join('\n')}
  </div>
);`;

  return `import type { ${name}Attributes } from './declaration';
import type { CSSProperties } from 'react';

/**
 * The builder's panel for the element: one control per attribute, writing back through \`onUpdate\` the attributes the
 * component reads. Only the builder loads it.
 */
export type SettingsProps = ${name}Attributes & {
  onUpdate?: (attribute: string, value: string | number | boolean) => void;
};

${panel}

const PANEL: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' };
${
  props.length > 0
    ? `
const FIELD: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' };
`
    : ''
}${
    typed
      ? `
const INPUT: CSSProperties = {
  font: 'inherit',
  color: 'inherit',
  padding: '6px 8px',
  borderRadius: '6px',
  border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
  background: 'transparent'
};
`
      : ''
  }
export default Settings;
`;
};
