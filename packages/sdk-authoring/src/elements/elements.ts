import { elementDeclarations } from '@plitzi/sdk-elements/elements/declarations';

import { defineElement } from './element';
import { isSourcePath, sourceRow } from './source';

import type { ElementProps, ListRow, RowWriter } from './element';
import type { SourceName, SourcePath, SourceRow } from './source';
import type { ElementSpec } from '../schema';
import type { AttributesOf } from '@plitzi/sdk-shared/authoring';

/**
 * A factory per element, named after it.
 *
 * Names only: every attribute type, every default and the builder label come off the element's own declaration, so
 * adding an element here cannot get its types wrong — and forgetting to add one is what `elements.test.ts` fails
 * on, by walking the catalogue.
 *
 * The internal types (`page`, `loading`, `notFound`, `layoutContainer`) have no factory on purpose: a page is
 * declared as a `PageSpec`, and the other three are the machinery's own.
 *
 * The sub-elements are here — a list's row, a dropdown's panel, a tab's three parts. They are real types that
 * appear in real documents, and their components are attached to their parent rather than exported on their own,
 * which is why their declarations had to be written before they could be authored at all.
 */

export const apiContainer = defineElement(elementDeclarations.ApiContainer);
export const blockHtml = defineElement(elementDeclarations.BlockHtml);
export const blockJsx = defineElement(elementDeclarations.BlockJsx);
export const button = defineElement(elementDeclarations.Button);
type CarouselAttributes = AttributesOf<typeof elementDeclarations.Carousel>;

/**
 * A carousel's `items` may name the source its slides come from, as a list's may: `carousel({ id: 'hero', items:
 * 'site.data.slides', row: r => … })` writes the slide into a `carouselTrack`, and its `children` are the controls.
 */
export const carousel = defineElement<
  Omit<CarouselAttributes, 'items'> & { items?: CarouselAttributes['items'] | SourceName }
>(elementDeclarations.Carousel);
export const carouselTrack = defineElement(elementDeclarations.CarouselTrack);
export const chart = defineElement(elementDeclarations.Chart);
export const channel = defineElement(elementDeclarations.Channel);
export const container = defineElement(elementDeclarations.Container);
/**
 * How long is left until an instant: `countdown({ to: '2026-12-01T09:00:00Z' })`, or `countdown()` inside a `timeWindow`
 * to count to its end. `onCountdownEnd` runs a flow at zero.
 */
export const countdown = defineElement(elementDeclarations.Countdown);
export const custom = defineElement(elementDeclarations.Custom);
export const dialogContainer = defineElement(elementDeclarations.DialogContainer);
/**
 * What a summary shows or hides — a question and its answer, a menu, "show more": `disclosure({ name: 'faq', children:
 * [disclosureSummary([text({ content: 'Question?' })]), paragraph({ content: 'Answer.' })] })`. The summary comes first.
 */
export const disclosure = defineElement(elementDeclarations.Disclosure);
export const disclosureSummary = defineElement(elementDeclarations.DisclosureSummary);
export const dropdown = defineElement(elementDeclarations.Dropdown);
export const dropdownPopup = defineElement(elementDeclarations.DropdownPopup);
export const focusGroup = defineElement(elementDeclarations.FocusGroup);
export const embed = defineElement(elementDeclarations.Embed);
export const fontAwesome = defineElement(elementDeclarations.FontAwesome);
export const form = defineElement(elementDeclarations.Form);
export const formControl = defineElement(elementDeclarations.FormControl);
export const heading = defineElement(elementDeclarations.Heading);
export const image = defineElement(elementDeclarations.Image);
export const link = defineElement(elementDeclarations.Link);
type ListAttributes = AttributesOf<typeof elementDeclarations.List>;

type ListProps = ElementProps<Omit<ListAttributes, 'items'> & { items?: ListAttributes['items'] | string }>;

/** A list fed by a typed source: its `row` is handed the item typed as the sample's (`g => text({ from: g.item.title })`). */
type TypedListProps<Item> = Omit<ListProps, 'items' | 'row'> & {
  items: SourcePath<readonly Item[]>;
  row?: string | RowWriter<SourceRow<Item>>;
};

const listFactory = defineElement<Omit<ListAttributes, 'items'> & { items?: ListAttributes['items'] | SourceName }>(
  elementDeclarations.List
);

const isTypedList = (props: ListProps | TypedListProps<unknown>): props is TypedListProps<unknown> =>
  isSourcePath(props.items);

/**
 * A list's `items` may name the source its rows come from, in their place: `list({ items: 'catalog.data.products' })`
 * — or be a typed source's path (`items: site.data.grid`), whose `row` is then handed its item typed.
 */
export function list<Item>(props: TypedListProps<Item>): ElementSpec;
export function list(props?: ListProps): ElementSpec;
export function list(children: ElementSpec[], props?: ListProps): ElementSpec;
export function list(first?: ListProps | TypedListProps<unknown> | ElementSpec[], second?: ListProps): ElementSpec {
  if (Array.isArray(first)) {
    return listFactory(first, second);
  }

  if (first === undefined || !isTypedList(first)) {
    return listFactory(first);
  }

  const { items, row } = first;

  return listFactory({
    ...first,
    row: typeof row === 'function' ? (named: ListRow) => row(sourceRow(named.source, items)) : row
  });
}
export const listItem = defineElement(elementDeclarations.ListItem);

type TableAttributes = AttributesOf<typeof elementDeclarations.Table>;

type TableProps = ElementProps<Omit<TableAttributes, 'items'> & { items?: TableAttributes['items'] | string }>;

/** A table fed by a typed source: its `row` is handed the item typed, and writes the columns. */
type TypedTableProps<Item> = Omit<TableProps, 'items' | 'row'> & {
  items: SourcePath<readonly Item[]>;
  row?: string | RowWriter<SourceRow<Item>>;
};

const tableFactory = defineElement<Omit<TableAttributes, 'items'> & { items?: TableAttributes['items'] | SourceName }>(
  elementDeclarations.Table
);

const isTypedTable = (props: TableProps | TypedTableProps<unknown>): props is TypedTableProps<unknown> =>
  isSourcePath(props.items);

/**
 * A table of data: its `row` writes its columns — `tableColumn`s, each a `header` and the cell it draws with the row in
 * hand — and its `items` are its rows, written out, a source's name or a typed source's path, as a list's:
 *
 * ```ts
 * table({ id: 'plans', caption: 'Plans compared', items: site.data.plans, row: r => [
 *   tableColumn({ header: 'Plan', rowHeader: true, children: [text({ from: r.item.name })] }),
 *   tableColumn({ header: 'Price', children: [text({ from: r.item.price })] })
 * ] })
 * ```
 */
export function table<Item>(props: TypedTableProps<Item>): ElementSpec;
export function table(props?: TableProps): ElementSpec;
export function table(props?: TableProps | TypedTableProps<unknown>): ElementSpec {
  if (props === undefined || !isTypedTable(props)) {
    return tableFactory(props);
  }

  const { items, row } = props;

  return tableFactory({
    ...props,
    row: typeof row === 'function' ? (named: ListRow) => row(sourceRow(named.source, items)) : row
  });
}
export const tableColumn = defineElement(elementDeclarations.TableColumn);
export const markdown = defineElement(elementDeclarations.Markdown);
export const modalContainer = defineElement(elementDeclarations.ModalContainer);
export const nodeHtml = defineElement(elementDeclarations.NodeHtml);
export const pagination = defineElement(elementDeclarations.Pagination);
export const paragraph = defineElement(elementDeclarations.Paragraph);
/** Another space drawn inside this one, as a widget: `plitziSdk({ id: 'card', bind: { offlineData: 'view.data' } })`. */
export const plitziSdk = defineElement(elementDeclarations.PlitziSdk);
export const reference = defineElement(elementDeclarations.Reference);
export const richText = defineElement(elementDeclarations.RichText);
/**
 * Variants: each visitor sees one of its variants. By chance (an A/B test) — `variants({ children: [variantItem({ weight: 90, children: [a]
 * }), variantItem({ weight: 10, children: [b] })] })`, drawn by the shares and kept when they come back, named after the
 * element until it says `experiment`. By rules — `variants({ chooseBy: 'rules', children: [variantItem({ when: { combinator:
 * 'and', rules: [{ field: 'visitor.device', operator: '=', value: 'mobile' }] }, children: [phones] }),
 * variantItem([everyone])] })` — the first whose rule they match; one with no `when` is for everybody else.
 */
export const variants = defineElement(elementDeclarations.Variants);
export const variantItem = defineElement(elementDeclarations.VariantItem);
/** A person: `avatar({ name: '{{ auth.details.username }}' })` — their picture, or their initials on a colour of their own. */
export const avatar = defineElement(elementDeclarations.Avatar);
/**
 * Who is signed in, in a top bar: `account({ signInHref: '/sign-in', children: [link({ href: '/profile', content:
 * 'Profile' })] })` — "Sign in" for a guest, a menu for somebody signed in.
 */
export const account = defineElement(elementDeclarations.Account);
/** The space's sign-in: `signInForm({ redirectTo: '/dashboard' })` — one button through Plitzi, a form for `basic`. */
export const signInForm = defineElement(elementDeclarations.SignInForm);
export const svg = defineElement(elementDeclarations.Svg);
export const tabContainer = defineElement(elementDeclarations.TabContainer);
export const tabContainerBody = defineElement(elementDeclarations.TabContainerBody);
export const tabContainerHeader = defineElement(elementDeclarations.TabContainerHeader);
export const tabContainerItem = defineElement(elementDeclarations.TabContainerItem);
export const text = defineElement(elementDeclarations.Text);
/** What shows only between two instants: `timeWindow({ startsAt: '2026-12-01T09:00:00Z', endsAt: '…', children })`. */
export const timeWindow = defineElement(elementDeclarations.TimeWindow);
export const themeToggle = defineElement(elementDeclarations.ThemeToggle);
export const video = defineElement(elementDeclarations.Video);
