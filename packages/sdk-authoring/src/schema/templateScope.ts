import { hasTemplateSyntax, inspectTemplate } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { GLOBAL_SOURCES } from './bindings';
import { didYouMean } from './suggest';

import type { SourceIndex } from './bindings';

/** Where one template is evaluated, which decides the names it may read beyond the sources in scope. */
export type TemplateSite =
  /** A binding's `twigTemplate`: the bound value as `source`, the attribute's previous value as `sourceTo`. */
  | { kind: 'binding' }
  /** An attribute's `{{ token }}`: the route params of the page it renders on, flattened to bare names. */
  | { kind: 'attribute'; routeParams: readonly string[] }
  /** One of the space's computed values: the globals and the values declared before it, nothing an element publishes. */
  | { kind: 'computed'; earlier: readonly string[] };

/** The names a binding's template is handed besides the sources — see the `twigTemplate` transformer. */
const BINDING_NAMES = new Set(['source', 'sourceTo']);

const shorten = (template: string): string => (template.length > 80 ? `${template.slice(0, 77)}…` : template);

/**
 * What a template may read, and the refusal for anything else.
 *
 * A template that names nothing renders nothing — the token is left as written or comes out empty — and every layer
 * below considers the document valid. So each name a template reads is held here to what will actually be in scope
 * when it renders: a global, a variable of the space, a route param where the context flattens them, or the source
 * of an element this one sits inside. Scoped sources are published to their element's descendants only, so the
 * element publishing it has to be an ancestor — or live in a layout, whose providers surround every page in it.
 */
export class TemplateScope {
  constructor(
    private readonly sources: SourceIndex,
    private readonly variables: ReadonlySet<string>,
    /** Whether an element lives in a layout shell rather than on a page. */
    private readonly inLayout: (id: string) => boolean,
    /**
     * Whether the source catalogue was supplied. Without it an element's source cannot be told from a typo, so only
     * the syntax is held; the composed surface always supplies it.
     */
    private readonly checkNames: boolean,
    /** The space's computed values, in the order they are declared. */
    private readonly computedNames: readonly string[] = []
  ) {}

  /**
   * Every `computed.<name>` a template reads has to be one the space declares — and, inside a computed value, one
   * declared above it: they are evaluated in order, so a later one is not there yet.
   */
  private assertComputedReads(template: string, where: string, site: TemplateSite | undefined): void {
    const readable = site?.kind === 'computed' ? site.earlier : this.computedNames;
    for (const [, name = ''] of template.matchAll(/\bcomputed\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      if (readable.includes(name)) {
        continue;
      }

      const later = site?.kind === 'computed' && this.computedNames.includes(name);
      throw new Error(
        later
          ? `${where} reads "computed.${name}", which is declared after it. Computed values are evaluated in order: move "${name}" above.`
          : `${where} reads "computed.${name}", which the space does not compute${didYouMean(name, this.computedNames) || '.'} Declare it in \`computed\`: { ${name}: '{{ … }}' }.`
      );
    }
  }

  /** Every source this space publishes, spelled the way a template names it. */
  private fullNames(): string[] {
    return [...this.sources].map(([id, prefix]) => `${prefix}_${id}`);
  }

  /**
   * Refuses a template the interpreter would read past, then — given where it is evaluated — any name in it that
   * nothing will answer. A flow step's params are read in a scope of their own (the trigger's payload, the steps before
   * it), so for those only the syntax is held.
   */
  assertTemplate(
    template: string,
    where: string,
    site?: TemplateSite,
    ancestors: ReadonlySet<string> = new Set()
  ): void {
    if (!hasTemplateSyntax(template)) {
      return;
    }

    const { issues, freeNames } = inspectTemplate(template);
    this.assertComputedReads(template, where, site);
    if (issues.length > 0) {
      throw new Error(
        `${where}: the template "${shorten(template)}" cannot be read as written — ${issues.join('; ')}. The interpreter would skip what it cannot read and render a value nobody wrote.`
      );
    }

    if (!this.checkNames || !site) {
      return;
    }

    for (const name of freeNames) {
      this.assertName(name, template, where, site, ancestors);
    }
  }

  private assertName(
    name: string,
    template: string,
    where: string,
    site: TemplateSite,
    ancestors: ReadonlySet<string>
  ): void {
    if (GLOBAL_SOURCES.includes(name) || this.variables.has(name)) {
      return;
    }

    if (site.kind === 'computed') {
      throw new Error(
        `${where} reads "${name}" in "${shorten(template)}". A computed value reads only the globals (${GLOBAL_SOURCES.join(', ')}) and the space's variables — it belongs to the whole space, so no element's source is around it. Compute from \`state\`, or bind the element's source on the element itself.`
      );
    }

    if (site.kind === 'binding' ? BINDING_NAMES.has(name) : site.routeParams.includes(name)) {
      return;
    }

    const shortPrefix = this.sources.get(name);
    if (shortPrefix) {
      throw new Error(
        `${where} reads "${name}" in "${shorten(template)}". Inside a template a source is named in full — write "${shortPrefix}_${name}" where it says "${name}". (A binding's own \`source\` is completed for you; a template is read as written.)`
      );
    }

    const separator = name.indexOf('_');
    const id = separator === -1 ? '' : name.slice(separator + 1);
    const prefix = this.sources.get(id);
    if (prefix && name === `${prefix}_${id}`) {
      if (!ancestors.has(id) && !this.inLayout(id)) {
        throw new Error(
          `${where} reads "${name}" in "${shorten(template)}", but "${id}" is not around it. An element's source reaches only the elements inside it — move this one into "${id}", or read the value through something both can see, like \`state\`.`
        );
      }

      return;
    }

    const known = [...GLOBAL_SOURCES, ...this.variables, ...this.fullNames()];
    const flattened =
      site.kind === 'attribute'
        ? ` A query parameter is \`navigation.queryParams.${name}\`${site.routeParams.length > 0 ? `; this page's route params are ${site.routeParams.join(', ')}` : ''}.`
        : ' The bound value is `source`.';

    throw new Error(
      `${where} reads "${name}" in "${shorten(template)}", which nothing here answers to${didYouMean(name, known) || '.'} A template reads the globals (${GLOBAL_SOURCES.join(', ')}), the space's variables, and an element's source named in full (\`list_rows\`, \`apiContainer_posts\`) from inside that element.${flattened}`
    );
  }
}
