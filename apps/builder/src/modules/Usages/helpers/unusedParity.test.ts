import { describe, expect, it } from 'vitest';

import { authorSpace, component, container, text } from '@plitzi/sdk-authoring';

import { buildUsageIndex, isUnused } from './usageIndex';

import type { UsageCategory } from './usageIndex';
import type { PageSpec, SpaceSpec } from '@plitzi/sdk-authoring';

const page = (id: string, body: PageSpec['body']): PageSpec => ({ id, name: id, slug: id === 'home' ? '' : id, body });

const palette = {
  color: {
    ink: { light: '#111111', dark: '#eeeeee', default: '#111111' },
    text: { light: '#111', dark: '#EEEEEE', default: '#111' },
    accent: 'var(--ink)',
    spare: { light: '#00ff00', dark: '#00aa00', default: '#00ff00' }
  },
  spacing: { gap: '8px', 'font-gap': '2px', orphanGap: '4px' }
};

/** A space that puts every clause of the rule to work: worn, named in prose, in `customCss`, at every breakpoint. */
const SPEC: SpaceSpec = {
  name: 'Prose',
  permanentUrl: 'prose',
  variables: palette,
  customCss: '.legacy { gap: var(--gap); }',
  classes: {
    legacy: {},
    mentioned: {},
    everywhere: { desktop: { color: 'red' }, tablet: { color: 'blue' }, mobile: { color: 'green' } },
    worn: { gap: 'var(--accent)' }
  },
  components: [
    { id: 'Badge', root: container({ class: 'worn', children: [text({ content: 'New' })] }) },
    { id: 'Shelf', root: container({ children: [component('Badge')] }) },
    { id: 'Lonely', root: container({ children: [text({ content: 'Nobody places me' })] }) }
  ],
  pages: [page('home', [text({ content: 'The word mentioned is only prose here' }), component('Shelf')])]
};

const subjectsOf = (spec: SpaceSpec, code: string): string[] =>
  [...(authorSpace(spec).suggestions.find(suggestion => suggestion.code === code)?.subjects ?? [])].sort();

describe('the Usages panel agrees with sdk-authoring’s unused-* suggestions', () => {
  it('is what the panel calls unused, for classes, tokens and components', () => {
    const spec = SPEC;
    const index = buildUsageIndex(authorSpace(spec));
    const unusedIn = (category: UsageCategory, prefix: string): string[] =>
      index[category]
        .filter(item => item.key.startsWith(prefix) && isUnused(item))
        .map(item => (category === 'components' ? item.detail : item.name))
        .sort();

    expect(unusedIn('classes', 'class:')).toEqual(subjectsOf(spec, 'unused-class'));
    expect(unusedIn('variables', 'token:')).toEqual(subjectsOf(spec, 'unused-token'));
    expect(unusedIn('components', 'component:')).toEqual(subjectsOf(spec, 'unused-component'));
    expect(subjectsOf(spec, 'unused-component')).toEqual(['Lonely']);
    expect(subjectsOf(spec, 'unused-class')).toEqual(['everywhere']);
  });
});
