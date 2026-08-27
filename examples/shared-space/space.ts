import {
  authorSpace,
  container,
  element,
  fontAwesome,
  heading,
  image,
  link,
  paragraph
} from '@plitzi/sdk-authoring';

import type { AuthoredSpace, ElementSpec, SpaceSpec } from '@plitzi/sdk-authoring';
import type { ElementRuntime } from '@plitzi/sdk-shared';

/**
 * The sample space every example renders, declared.
 *
 * It used to be 35 KB of exported JSON, which is fine for a machine and useless to a reader: an example that says
 * "this is your space" and then hands over an unreadable blob teaches nothing about what a space IS. This is the
 * same page — every element, every rule, the same variables — written as what a person decides, with the ids,
 * the class names and the breakpoint maps derived.
 *
 * Examples build on it by spreading the spec and replacing its pages, so each one shows its own wiring and
 * inherits the palette rather than restating it.
 */

/**
 * The three elements the examples' own servers feed. Not built-ins: each example ships the components.
 *
 * Named, because a server has to be able to find them. RSC data is keyed by element ID — the opaque one — and an
 * authored space derives those, so an example looks its own elements up by the name it gave them
 * (`elementIdOf(schema, 'rsc-server')`) instead of hard-coding a hash.
 *
 * The `runtime` is the whole subject of what they demonstrate, so it is declared and not defaulted: `server`
 * renders on the server and is never mounted in the browser, `client` is skipped during SSR entirely, and `shared`
 * does both. Left out, every one of them is `shared` — three elements that look identical and prove nothing.
 */
const rscElement = (
  type: 'serverInfo' | 'clientInfo' | 'sharedInfo',
  id: string,
  runtime: ElementRuntime
): ElementSpec => element(type, { id, runtime });

const card = (title: string, body: string): ElementSpec =>
  link({
    href: '#',
    class: 'buttonLink',
    children: [
      container({
        class: 'titleContainer',
        children: [
          heading({ content: title, subType: 'h1', variant: 'title' }),
          fontAwesome({ icon: 'fas fa-arrow-right', size: 'fa-2x', class: 'titleIcon' })
        ]
      }),
      paragraph({ content: body })
    ]
  });

export const sampleSpace: SpaceSpec = {
  name: 'Plitzi Example',
  permanentUrl: 'plitzi-example',

  /** Both halves of every colour, so a page reads in either scheme instead of only in the one it was written in. */
  variables: {
    color: {
      foreground: { light: '#17171c', dark: '#fafafa', default: '#17171c' },
      'grid-big': { light: '#00000010', dark: '#ffffff10', default: '#00000010' },
      'grid-small': { light: '#0000000A', dark: '#ffffff0A', default: '#0000000A' },
      'background-outer': { light: '#dce6ff', dark: '#000000', default: '#dce6ff' },
      'background-inner': { light: '#ffffff', dark: '#080866', default: '#ffffff' }
    }
  },

  /** What every element of a type looks like before any class applies. */
  elements: {
    heading: {
      base: { color: 'var(--foreground)' },
      variants: { lg: { 'font-size': '50px' }, title: { 'margin-top': '0px', 'margin-bottom': '0px' } }
    },
    text: { base: { color: 'var(--foreground)' } },
    paragraph: { base: { color: 'var(--foreground)' } },
    fontAwesome: { base: { color: 'var(--foreground)' } }
  },

  classes: {
    page: {
      desktop: {
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        'justify-content': 'space-between',
        padding: '100px',
        position: 'relative',
        'min-width': '100vw',
        'min-height': '100vh',
        'background-image':
          'radial-gradient(circle at 50% 50%, var(--background-inner) -30%, var(--background-outer) 100%)',
        'background-size': 'auto',
        'background-position': '0% 0%',
        'background-repeat': 'no-repeat',
        'background-attachment': 'scroll',
        'background-clip': 'border-box'
      },
      tablet: { 'justify-content': 'flex-start', padding: '60px' },
      mobile: { 'justify-content': 'flex-start', padding: '32px 24px' }
    },

    /** The grid behind everything: two sizes of line, painted with the theme's own colours. */
    backdrop: {
      desktop: {
        inset: '0%',
        position: 'fixed',
        'background-image':
          'linear-gradient(0deg, var(--grid-big) 1px, transparent 1px), linear-gradient(90deg, var(--grid-big) 1px, transparent 1px), linear-gradient(0deg, var(--grid-small) 1px, transparent 1px), linear-gradient(90deg, var(--grid-small) 1px, transparent 1px)',
        'background-size': '100px 100px, 100px 100px, 10px 10px, 10px 10px',
        'background-position': '0% 0%, 0% 0%, 0% 0%, 0% 0%',
        'background-repeat': 'repeat, repeat, repeat, repeat',
        'background-attachment': 'scroll, scroll, scroll, scroll',
        'background-clip': 'border-box, border-box, border-box, border-box',
        'pointer-events': 'none'
      }
    },

    logoFrame: {
      desktop: { width: '75vw', height: '75vh', position: 'absolute' },
      mobile: { width: '90vw', height: '40vh' }
    },
    logo: { desktop: { width: '100%', height: '100%', opacity: '0.45' } },
    headline: { desktop: { 'z-index': '1', color: 'white', 'margin-bottom': '40px' } },
    rscSection: { desktop: { 'z-index': '1' } },

    cards: {
      desktop: { display: 'flex', 'align-items': 'center', gap: '40px', 'z-index': '1' },
      tablet: {
        'flex-direction': 'column',
        'min-height': 'auto',
        'min-width': 'auto',
        'flex-grow': '1',
        'flex-shrink': '1',
        'flex-basis': '0%',
        'align-items': 'flex-start'
      },
      mobile: {
        'flex-direction': 'column',
        'min-height': 'auto',
        'min-width': 'auto',
        'align-items': 'stretch',
        gap: '24px'
      }
    },
    buttonLink: { desktop: { color: 'white', flex: '1 1 0px' } },
    titleContainer: { desktop: { display: 'flex', 'align-items': 'center' } },
    titleIcon: { desktop: { 'margin-left': '10px' } }
  },

  /** The arrow that slides on hover: a state no style panel models, and the reason `customCss` exists. */
  customCss: `
.buttonLink:hover .titleIcon {
  transform: translateX(10px);
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.4, 0.2, 1);
  transition-duration: 150ms;
}
`,

  /** The server resolves this space's `runtime: 'server'` elements — without it they render from mock data. */
  rsc: { enabled: true },

  pages: [
    {
      name: 'Home',
      // Named for the same reason the RSC elements are: something outside this file addresses them. The e2e suite
      // drafts an edit onto the heading and the MCP takes a `pageRef`/`ref`, and both are names an author wrote —
      // a derived ref is positional, and the document id is a hash nothing should ever be written against.
      id: 'home',
      slug: '',
      class: 'page',
      body: [
        container({ class: 'backdrop' }),
        container({
          class: 'logoFrame',
          children: [
            image({ id: 'logo', src: 'https://cdn.plitzi.com/resources/img/favicon.svg', class: 'logo' })
          ]
        }),
        container({
          class: 'headline',
          children: [heading({ id: 'mainHeading', content: 'Welcome To Plitzi', subType: 'h1', variant: 'lg' })]
        }),
        container({
          class: 'rscSection',
          children: [
            rscElement('serverInfo', 'rsc-server', 'server'),
            rscElement('clientInfo', 'rsc-client', 'client'),
            rscElement('sharedInfo', 'rsc-shared', 'shared')
          ]
        }),
        container({
          class: 'cards',
          children: [
            card('Docs', 'Find in-depth information about Plitzi features and API.'),
            card('Learn', 'Learn about Plitzi in an interactive course with quizzes!'),
            card('Templates', 'Explore the Plitzi playground'),
            card('Deploy', 'Instantly deploy your Plitzi Space')
          ]
        })
      ]
    }
  ]
};

/** The space as the two documents every Plitzi renderer consumes, plus whatever the validator had to say. */
export const offlineData = (): AuthoredSpace => authorSpace(sampleSpace);
