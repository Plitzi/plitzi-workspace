import type { ComponentCatalogEntry } from '@plitzi/sdk-shared';

// Curated semantics for the built-in Plitzi element types: what each one is FOR, so an agent picks the right type
// (e.g. apiContainer to bring backend data into the frontend, link to navigate between pages). The element
// catalog in sdk-elements ships these with empty `description` fields, so the authoritative purpose text lives
// here. `label`/`category` mirror each element's own definition/market metadata. Plugin (custom) types are NOT
// here — their metadata arrives at runtime via the getComponentCatalog adapter. Keyed by the schema `type`.
type BuiltinComponent = Required<Pick<ComponentCatalogEntry, 'label' | 'description' | 'category'>>;

export const BUILTIN_COMPONENTS: Partial<Record<string, BuiltinComponent>> = {
  // Structure — layout boxes and containers.
  container: {
    label: 'Container',
    category: 'structure',
    description:
      'Generic layout box (a div). The primary building block for structure: groups and positions child ' +
      'elements with flex/grid. Reach for it whenever you need to wrap or arrange other elements.'
  },
  list: {
    label: 'List',
    category: 'structure',
    description:
      'Repeats a template (its listItem child) once per entry of a data array — the way to render a dynamic ' +
      'collection. Bind its items to a data source (e.g. an apiContainer/collectionContainer response).'
  },
  listItem: {
    label: 'List Item',
    category: 'structure',
    description: 'The repeated template rendered once per row inside a list; its fields bind to each array entry.'
  },
  dialogContainer: {
    label: 'Dialog Container',
    category: 'structure',
    description: 'A native <dialog> container shown or hidden through interactions (e.g. an onClick open/close).'
  },
  modalContainer: {
    label: 'Modal Container',
    category: 'structure',
    description: 'A modal overlay container opened and closed through interactions; use for dialogs over the page.'
  },
  tabContainer: {
    label: 'Tab Container',
    category: 'structure',
    description: 'A tabbed container that switches between panels; composed of header/body/item parts.'
  },
  tabContainerHeader: {
    label: 'Tab Container Header',
    category: 'structure',
    description: 'The row of tab triggers inside a tabContainer.'
  },
  tabContainerBody: {
    label: 'Tab Container Body',
    category: 'structure',
    description: 'The panel area inside a tabContainer that shows the active tab item.'
  },
  tabContainerItem: {
    label: 'Tab Container Item',
    category: 'structure',
    description: 'One selectable tab (trigger + panel) inside a tabContainer.'
  },

  // Provider — bring backend/CMS data into the tree as a data source.
  apiContainer: {
    label: 'Api Container',
    category: 'provider',
    description:
      'Fetches data from a backend HTTP API (its `query`/`method`/`credentials`) and exposes the response as a ' +
      'data source ITS DESCENDANTS bind to (source `apiContainer_<idRef>.data`; only elements inside it can consume ' +
      'it). This is how you get backend data into the frontend. Its `mockData` prop is builder-only sample data — ' +
      'the published runtime fetches the real `query`, so always set a real query for production.'
  },
  collectionContainer: {
    label: 'Collection Container',
    category: 'provider',
    description:
      'Exposes a Plitzi Collection (built-in CMS) as a data source for its descendants to bind to — the ' +
      'CMS-backed counterpart of apiContainer.'
  },

  // Basic — text, actions, navigation.
  text: {
    label: 'Text',
    category: 'basic',
    description: 'Inline plain-text content. Use for short runs of copy; bind its content to data for dynamic text.'
  },
  paragraph: {
    label: 'Paragraph',
    category: 'basic',
    description: 'A block of body text (a <p>). Use for longer prose passages.'
  },
  heading: {
    label: 'Heading',
    category: 'basic',
    description: 'A section heading (<h1>–<h6>) for titles and document hierarchy.'
  },
  button: {
    label: 'Button',
    category: 'basic',
    description:
      'A clickable button. On its own it only renders; wire an interaction flow (trigger onClick → callbacks) ' +
      'to make it DO something.'
  },
  link: {
    label: 'Link',
    category: 'basic',
    description:
      'Navigation. Moves the user between pages of the site or to an external URL (its `mode`/`href` decide ' +
      'which). Use this to go page-to-page rather than a button + interaction.'
  },
  markdown: {
    label: 'Markdown',
    category: 'basic',
    description: 'Renders a Markdown source string as formatted HTML.'
  },
  dropdown: {
    label: 'Dropdown',
    category: 'basic',
    description: 'A trigger that toggles an attached popup panel (dropdownPopup) — menus, selects, flyouts.'
  },
  dropdownPopup: {
    label: 'Dropdown Popup',
    category: 'basic',
    description: 'The floating panel revealed by a dropdown.'
  },

  // Form — capture user input.
  form: {
    label: 'Form',
    category: 'form',
    description:
      'A <form> that groups form controls and handles submission; wire its submit through an interaction flow.'
  },
  formControl: {
    label: 'Form Control',
    category: 'form',
    description:
      'A single labelled input (text/select/checkbox/… per its subType) inside a form; captures one field of ' +
      'user input.'
  },

  // Media.
  image: { label: 'Image', category: 'media', description: 'Displays an image from a URL.' },
  video: { label: 'Video', category: 'media', description: 'Embeds a video from a URL.' },
  fontAwesome: {
    label: 'Font Awesome',
    category: 'media',
    description: 'Renders a Font Awesome icon by its icon name.'
  },

  // Internal — framework-provided screens/shells, usually not hand-placed.
  page: {
    label: 'Page',
    category: 'internal',
    description:
      'The root of a routable screen. Managed through the page ops (upsertPage/deletePage), not added as a ' +
      'child element.'
  },
  layoutContainer: {
    label: 'Layout Container',
    category: 'internal',
    description: 'A reusable layout shell (header/footer chrome) shared across pages.'
  },
  notFound: {
    label: 'Not Found',
    category: 'internal',
    description: 'The 404 screen shown when no route matches.'
  },
  loading: {
    label: 'Loading',
    category: 'internal',
    description: 'A loading placeholder shown while data or a suspense boundary resolves.'
  },

  // Advanced — escape hatches for raw markup / references.
  reference: {
    label: 'Reference',
    category: 'advanced',
    description: 'Reuses another element or template by id, rendering it in place.'
  },
  custom: {
    label: 'Custom',
    category: 'advanced',
    description: 'A custom element slot whose behaviour is supplied by a host/plugin component.'
  },
  blockHtml: {
    label: 'HTML Block',
    category: 'advanced',
    description: 'Renders an arbitrary raw HTML string as a block. Escape hatch when no structured element fits.'
  },
  nodeHtml: {
    label: 'Html Node',
    category: 'advanced',
    description: 'A single raw HTML tag with custom attributes.'
  },
  blockJsx: {
    label: 'Block JSX',
    category: 'advanced',
    description: 'A compiled JSX block for advanced authoring.'
  }
};
