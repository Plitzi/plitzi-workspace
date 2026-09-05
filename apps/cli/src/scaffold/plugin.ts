import type { CreateAnswers, ProjectFiles } from './types';

/**
 * A custom element of the project's own — the half of Plitzi nothing else in the scaffold would show.
 *
 * The built-in catalogue covers a page; it does not cover a sparkline, a map, a seat picker or whatever this
 * particular product is actually about. Those are components somebody writes, and the whole mechanism for it is
 * one React component plus one line of registration — which is a small enough fact that a project not carrying an
 * example of it leaves people assuming the catalogue is the ceiling.
 *
 * The contract is worth stating once, because it is the part that is not obvious: **a plugin's props ARE the
 * hosting element's resolved attributes**. The space writes `label`, the component reads `label`. That is what
 * makes a plugin bindable — point a data source at the element and the component re-renders with the answer,
 * without a line of plumbing in between. Plitzi's own server-side plugins (the dashboard's world map and its live
 * traffic view) are written to exactly this shape.
 */

const component = (): string => `import { useMemo, useState } from 'react';

import { RootElement } from '@plitzi/plitzi-sdk';

import type { CSSProperties } from 'react';

/**
 * The props ARE the element's attributes.
 *
 * Whatever \`src/space.ts\` writes on the \`custom\` element that hosts this arrives here by the same name — and so
 * does whatever a binding writes later, which is what makes a plugin a live component rather than a static one.
 * Everything is optional and everything has a default: an attribute that has not been authored yet, or a binding
 * whose source has not answered, is \`undefined\`, and a plugin that renders nothing in that moment is a hole in
 * the page.
 */
export interface StatCardProps {
  label?: string;
  value?: number;
  unit?: string;
  /** The sparkline, oldest first. Any length; the drawing scales itself. */
  series?: number[];
  /** Supplied by the runtime, not authored: the classes the element's own style rules are written against. */
  className?: string;
}

const EMPTY: number[] = [];

const WIDTH = 180;
const HEIGHT = 44;

const format = (value: number): string => value.toLocaleString('en-US');

/**
 * A number, its trend, and the point under the cursor.
 *
 * Deliberately deterministic: it draws the same markup on the server and in the browser, so the server-rendered
 * HTML and the first client render agree. That matters more than it sounds — React answers a hydration mismatch
 * by throwing away the whole tree it happened in, so a plugin that renders \`Date.now()\` or \`Math.random()\` on
 * the first pass does not break itself, it blanks the page. Anything genuinely live belongs in an effect, which
 * runs after hydration has already agreed.
 */
const StatCard = ({ label = 'Metric', value = 0, unit = '', series, className }: StatCardProps) => {
  const points = Array.isArray(series) ? series : EMPTY;
  const [hovered, setHovered] = useState<number | undefined>(undefined);

  const path = useMemo(() => {
    if (points.length < 2) {
      return '';
    }

    const top = Math.max(...points);
    const bottom = Math.min(...points);
    const span = top - bottom || 1;

    return points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * WIDTH;
        const y = HEIGHT - ((point - bottom) / span) * HEIGHT;

        return \`\${index === 0 ? 'M' : 'L'}\${x.toFixed(1)} \${y.toFixed(1)}\`;
      })
      .join(' ');
  }, [points]);

  const shown = hovered === undefined ? value : points[hovered];

  /**
   * \`RootElement\` is the root, and not a \`div\`.
   *
   * It is what makes this an ELEMENT rather than a component that happens to be on the page: the element's id and
   * classes land on it, so the CSS authored on it in \`src/space.ts\` applies, the builder can select it, a test
   * can find it by name, and interactions fire on it. A plain tag renders the same pixels and none of that.
   */
  return (
    <RootElement className={className} style={CARD}>
      <span style={LABEL}>{label}</span>
      <span style={VALUE}>
        {format(shown ?? 0)}
        {unit ? <span style={UNIT}>{unit}</span> : undefined}
      </span>
      {path && (
        <svg
          viewBox={\`0 0 \${WIDTH} \${HEIGHT}\`}
          style={CHART}
          preserveAspectRatio="none"
          onMouseLeave={() => setHovered(undefined)}
          role="presentation"
        >
          <path d={path} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {points.map((point, index) => (
            <rect
              key={\`\${index}-\${point}\`}
              x={(index / points.length) * WIDTH}
              y={0}
              width={WIDTH / points.length}
              height={HEIGHT}
              fill="transparent"
              onMouseEnter={() => setHovered(index)}
            />
          ))}
        </svg>
      )}
    </RootElement>
  );
};

/**
 * Styles inline, and colours borrowed rather than chosen.
 *
 * A plugin is dropped into a page whose palette it does not know, so naming a colour here is how a component ends
 * up black on black the first time somebody switches the theme. \`currentColor\` and the space's own variables
 * follow whatever the page decided.
 */
const CARD: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  padding: '16px 20px',
  borderRadius: '12px',
  color: 'var(--foreground)',
  background: 'color-mix(in srgb, currentColor 6%, transparent)',
  border: '1px solid color-mix(in srgb, currentColor 15%, transparent)'
};

const LABEL: CSSProperties = { fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.65 };

const VALUE: CSSProperties = { fontSize: '32px', fontWeight: 600, lineHeight: 1.1 };

const UNIT: CSSProperties = { fontSize: '14px', fontWeight: 400, opacity: 0.65, marginLeft: '6px' };

const CHART: CSSProperties = { width: '100%', height: \`\${HEIGHT}px\`, overflow: 'visible' };

export default StatCard;
`;

const barrel = (): string => `import StatCard from './StatCard';

export * from './StatCard';

export default StatCard;
`;

const readme = ({ mode }: CreateAnswers): string => `# Plugins

Components of your own, rendered by the space.

A plugin is a React component and a \`renderType\` it is registered under. The space hosts it with a \`custom\`
element naming that same \`renderType\` — see \`custom({ renderType: 'statCard', … })\` in \`src/space.ts\` — and the
element's attributes arrive as the component's props.

${
  mode === 'server'
    ? `\`src/main.ts\` registers this one with \`action: 'compile'\`, which is what makes it **server-rendered**: the
server builds the entry with esbuild, keeps React external so the plugin runs on the one copy the page already
has, serves the bundle to the browser AND imports it into the render — so the component's markup is in the HTML
before any JavaScript arrives. A plugin registered any other way renders only after hydration, which is a hole in
the document for anyone reading the page before then.`
    : `\`src/main.ts\` registers this one as the third argument to \`render()\`. There is no server here, so the
component is part of this project's own bundle and Vite hot-replaces it like any other module.`
}

## Adding another

1. \`src/plugins/YourThing/YourThing.tsx\` — a component whose props are the attributes you want to author.
2. \`src/plugins/YourThing/index.ts\` — \`export default\`, so the registration has one thing to point at.
3. Register it in \`src/main.ts\` under a \`renderType\`.
4. Put a \`custom({ renderType: 'yourThing', … })\` in \`src/space.ts\`.

## Three things that bite

**Render \`RootElement\`, not a \`div\`.** It is what makes a plugin an *element*: the id and classes the space
gave it land on what you render, so the CSS authored on the element applies, the builder can select it, and a test
can find it by name. A plain tag renders the same pixels and none of that.


**Do not render anything that differs between the server and the first client render** — a clock, a random number,
anything read out of \`window\`. React answers a hydration mismatch by discarding the whole tree, so it does not
break the plugin, it blanks the page. Put live values in an effect.

**Do not name colours.** The page carries a palette and a light/dark theme; a plugin that hard-codes \`#111\` is
invisible on one of them. Use \`currentColor\` and the space's own \`var(--…)\` variables.
`;

export const pluginFiles = (answers: CreateAnswers): ProjectFiles => ({
  'src/plugins/StatCard/StatCard.tsx': component(),
  'src/plugins/StatCard/index.ts': barrel(),
  'src/plugins/README.md': readme(answers)
});
