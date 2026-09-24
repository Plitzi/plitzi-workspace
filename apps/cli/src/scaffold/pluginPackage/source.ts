import { tsString } from './quote';

import type { PluginNames } from './names';
import type { ProjectFiles } from '../types';

/**
 * The element's code, in the shape Plitzi's own elements are written in (`@plitzi/sdk-elements`): a folder holding
 * the component, its declaration, the panel the builder edits it with, and the `index.ts` that puts them together.
 *
 * The example is deliberately generic — a count somebody raises — because it is replaced on day one. What it is for is
 * the three ways an element talks to the space around it, which are not obvious from the outside and which a
 * component that only draws something would never show: attributes in (its props), an event out (`onCount`, which a
 * flow can start on), and an action in (`reset`, which a flow can call).
 */

/** What somebody said about the element when it was created: the words the builder and an agent see. */
export interface ElementText {
  title: string;
  description: string;
  owner: string;
}

const declarationFile = (
  { component: name, type }: PluginNames,
  { title, description, owner }: ElementText
): string => `import type { ${name}Props } from './${name}';
import type { PluginDeclaration } from '@plitzi/plitzi-sdk';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ${name}Attributes = Omit<${name}Props, 'className'>;

/**
 * Static declaration for ${name}: its type, the events it fires and the actions it answers to, and the element the
 * builder adds when somebody drops it on a page. Data only, no React — the build reads it to write the manifest.
 */
const declaration = {
  /** What a space names it by: the \`renderType\` of the \`custom\` element that hosts it. Renaming it orphans every one. */
  type: '${type}',
  /** The events it fires. The component registers these; the builder offers them as what a flow can start on. */
  triggers: {
    // \`preview\` names what a flow started by the event can read — shown in the builder, never sent.
    onCount: { action: 'onCount', title: 'On Count', type: 'trigger', params: {}, preview: { count: '' } }
  },
  /** The actions it answers to, static half: the component adds the function, and a title naming its label. */
  callbacks: {
    reset: { action: 'reset', title: 'Reset', type: 'callback', params: {} }
  },
  content: {
    /** The starting attributes — the component's defaults, written where the builder can show them. */
    attributes: { label: ${tsString(title)}, start: 0, step: 1 },
    definition: {
      label: ${tsString(title)},
      type: '${type}',
      /** What it is for: the builder shows it, and an agent connected over MCP reads it to choose the element. */
      description: ${tsString(description)},
      items: [],
      bindings: {},
      styleSelectors: { base: '' },
      initialState: { visibility: true }
    },
    builder: {
      canDelete: true,
      canSelect: true,
      canDragDrop: true,
      canMove: true,
      canTemplate: true,
      itemsAllowed: [],
      itemsNotAllowed: []
    },
    market: {
      category: ${tsString(title)},
      owner: ${tsString(owner)},
      license: 'MIT',
      website: '',
      backgroundColor: '#4422ee',
      icon: ''
    },
    defaultStyle: {
      name: ${tsString(title)},
      displayMode: 'desktop',
      style: { base: { default: {} } },
      /** The attributes a data source may be pointed at — what the builder offers when somebody connects data to it. */
      bindingsAllowed: {
        attributes: [
          { path: 'label', label: 'Label' },
          { path: 'start', label: 'Starts at' },
          { path: 'step', label: 'Step' }
        ],
        initialState: []
      }
    },
    settings: {}
  }
} satisfies PluginDeclaration<${name}Attributes>;

export default declaration;
`;

const component = ({
  component: name,
  title
}: PluginNames): string => `import { use, useCallback, useMemo, useState } from 'react';

import { RootElement, useElement, usePlitziServiceContext } from '@plitzi/plitzi-sdk';

import declaration from './declaration';

import type { InteractionCallback } from '@plitzi/plitzi-sdk';
import type { CSSProperties } from 'react';

/**
 * The props ARE the element's attributes.
 *
 * Whatever a space writes on the \`custom\` element that hosts this arrives here by the same name — and so does whatever
 * a binding writes later, which is what makes a plugin a live component rather than a static one. Everything is
 * optional and everything has a default: an attribute nobody has authored yet, or a binding whose source has not
 * answered, is \`undefined\`, and a plugin that renders nothing in that moment is a hole in the page.
 */
export interface ${name}Props {
  label?: string;
  /** Where the count starts, and where \`reset\` puts it back. */
  start?: number;
  /** How much one press adds. */
  step?: number;
  /** Supplied by the runtime, not authored: the classes the element's own style rules are written against. */
  className?: string;
}

/**
 * A count somebody raises.
 *
 * Deterministic on its first render: it draws the same markup on a server and in the browser, so a server-rendered
 * page and its hydration agree. React answers a mismatch by throwing away the whole tree it happened in, so a plugin
 * that renders \`Date.now()\` or reads \`window\` on the first pass does not break itself, it blanks the page. Anything
 * live belongs in an effect.
 */
const ${name} = ({ label = ${tsString(title)}, start = 0, step = 1, className }: ${name}Props) => {
  const { id } = useElement();
  const {
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use(InteractionsContext);
  const [count, setCount] = useState(start);

  const handleAdd = useCallback(() => {
    const next = count + step;
    setCount(next);
    void interactionsManager.interactionTrigger(id, declaration.triggers.onCount.action, { count: next });
  }, [count, step, interactionsManager, id]);

  const handleReset = useCallback(() => setCount(start), [start]);

  /** The declared events, titled with this element's label so the builder tells two of them apart. */
  const interactionTriggers = useMemo<Record<string, InteractionCallback>>(
    () => ({ onCount: { ...declaration.triggers.onCount, title: \`\${label} counted\` } }),
    [label]
  );

  /** The declared actions, with what only a mounted element has: the function that does it. */
  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(
    () => ({ reset: { ...declaration.callbacks.reset, title: \`Reset \${label}\`, callback: handleReset } }),
    [label, handleReset]
  );

  /**
   * \`RootElement\` is the root, and not a \`div\`.
   *
   * It is what makes this an ELEMENT rather than a component that happens to be on the page: the element's id and
   * classes land on it, so the CSS authored on it applies, the builder can select it, a test can find it by name, and
   * the events and actions above are this element's.
   */
  return (
    <RootElement
      className={className}
      style={CARD}
      interactionTriggers={interactionTriggers}
      interactionCallbacks={interactionCallbacks}
    >
      <span style={LABEL}>{label}</span>
      {/* A status: announced when it changes, and what a test finds the count by. */}
      <span style={VALUE} role="status">
        {count}
      </span>
      <button type="button" style={BUTTON} onClick={handleAdd}>
        +{step}
      </button>
    </RootElement>
  );
};

/**
 * Styles inline, and colours borrowed rather than chosen.
 *
 * A plugin is dropped into a page whose palette it does not know, so naming a colour here is how a component ends up
 * black on black the first time somebody switches the theme. \`currentColor\` and the space's own variables follow
 * whatever the page decided. The element's own look belongs in \`defaultStyle\` in the declaration, where the space can
 * restyle it; these are only what makes it usable before anybody does.
 */
const CARD: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  borderRadius: '12px',
  border: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
  background: 'color-mix(in srgb, currentColor 6%, transparent)'
};

const LABEL: CSSProperties = { fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.65 };

const VALUE: CSSProperties = { fontSize: '24px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' };

const BUTTON: CSSProperties = {
  font: 'inherit',
  color: 'inherit',
  padding: '4px 12px',
  borderRadius: '8px',
  border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
  background: 'transparent',
  cursor: 'pointer'
};

export default ${name};
`;

const settings = ({ component: name }: PluginNames): string => `import { useCallback } from 'react';

import type { ${name}Attributes } from './declaration';
import type { ChangeEvent, CSSProperties } from 'react';

/**
 * The builder's panel for the element.
 *
 * The builder hands it the element's attributes as props and gives it \`onUpdate\` to write one back — the same
 * attributes the component reads, so what is edited here is what renders. Only the builder loads it: a published page
 * never draws a panel.
 */
export type SettingsProps = ${name}Attributes & {
  onUpdate?: (attribute: string, value: string | number) => void;
};

const Settings = ({ label = '', start = 0, step = 1, onUpdate }: SettingsProps) => {
  const handleLabel = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onUpdate?.('label', event.target.value),
    [onUpdate]
  );
  const handleStart = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onUpdate?.('start', Number(event.target.value)),
    [onUpdate]
  );
  const handleStep = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onUpdate?.('step', Number(event.target.value)),
    [onUpdate]
  );

  return (
    <div style={PANEL}>
      <label style={FIELD}>
        Label
        <input style={INPUT} value={label} onChange={handleLabel} />
      </label>
      <label style={FIELD}>
        Starts at
        <input style={INPUT} type="number" value={start} onChange={handleStart} />
      </label>
      <label style={FIELD}>
        Step
        <input style={INPUT} type="number" min={1} value={step} onChange={handleStep} />
      </label>
    </div>
  );
};

/** The builder's own theme is light or dark, so the panel borrows its colours the way the component does. */
const PANEL: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' };

const FIELD: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' };

const INPUT: CSSProperties = {
  font: 'inherit',
  color: 'inherit',
  padding: '6px 8px',
  borderRadius: '6px',
  border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
  background: 'transparent'
};

export default Settings;
`;

const elementIndex = ({ component: name }: PluginNames): string => `import Base${name} from './${name}';
import declaration from './declaration';
import Settings from './Settings';

/**
 * The element, as whatever registers it reads it: the component, everything its declaration says — its \`type\` first
 * — and the panel the builder edits it with. The same three things Plitzi's own elements are made of.
 */
const ${name} = Object.assign(Base${name}, declaration, { pluginSettings: Settings });

export * from './${name}';

export type { ${name}Attributes } from './declaration';

export default ${name};
`;

const declarationsList = ({
  component: name,
  type
}: PluginNames): string => `import ${type} from './${name}/declaration';

/**
 * Every element this package holds, the one it is named after first: the build writes each into
 * \`plugin-manifest.json\`, and the first is the one a space's \`plugins\` entry loads the package by.
 */
export const declarations = [${type}];
`;

const entry = ({ component: name }: PluginNames): string => `import ${name} from './${name}';

/**
 * What a space loads: the element this package is named after.
 *
 * A package can hold more than one: export the others as \`plugins\` (\`export const plugins = { legend: Legend }\`),
 * each written the way \`${name}/\` is, and add its declaration to \`declarations.ts\`.
 */

/** The package's version, kept by the runtime on the element. Written in at build time from \`package.json\`. */
export const version = __PLUGIN_VERSION__;

export default ${name};
`;

const env =
  (): string => `/** Written in by \`vite.config.ts\` from \`package.json\`: the version the manifest and the runtime report. */
declare const __PLUGIN_VERSION__: string;
`;

/** The element alone: its folder's files, by their path inside it. */
export const elementFiles = (names: PluginNames, text: ElementText): ProjectFiles => ({
  [`${names.component}.tsx`]: component(names),
  'declaration.ts': declarationFile(names, text),
  'Settings.tsx': settings(names),
  'index.ts': elementIndex(names)
});

/** The element inside a plugin package, beside the list of its declarations and the entry that publishes it. */
export const packageSourceFiles = (names: PluginNames, text: ElementText): ProjectFiles => ({
  ...Object.fromEntries(
    Object.entries(elementFiles(names, text)).map(([file, contents]) => [`src/${names.component}/${file}`, contents])
  ),
  'src/declarations.ts': declarationsList(names),
  'src/index.ts': entry(names),
  'src/env.d.ts': env()
});
