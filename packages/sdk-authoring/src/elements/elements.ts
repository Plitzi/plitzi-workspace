import { elementDeclarations } from '@plitzi/sdk-elements/elements/declarations';

import { defineElement } from './element';
import { isSourcePath, sourceRow } from './source';

import type { ElementProps, ListRow, RowWriter } from './element';
import type { SourceName, SourcePath, SourceRow } from './source';
import type { ElementSpec } from '../schema';
import type { AttributesOf } from '@plitzi/sdk-shared/authoring/declare';

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
export const channel = defineElement(elementDeclarations.Channel);
export const container = defineElement(elementDeclarations.Container);
export const custom = defineElement(elementDeclarations.Custom);
export const dialogContainer = defineElement(elementDeclarations.DialogContainer);
export const dropdown = defineElement(elementDeclarations.Dropdown);
export const dropdownPopup = defineElement(elementDeclarations.DropdownPopup);
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
export const markdown = defineElement(elementDeclarations.Markdown);
export const modalContainer = defineElement(elementDeclarations.ModalContainer);
export const nodeHtml = defineElement(elementDeclarations.NodeHtml);
export const pagination = defineElement(elementDeclarations.Pagination);
export const paragraph = defineElement(elementDeclarations.Paragraph);
export const reference = defineElement(elementDeclarations.Reference);
export const richText = defineElement(elementDeclarations.RichText);
export const svg = defineElement(elementDeclarations.Svg);
export const tabContainer = defineElement(elementDeclarations.TabContainer);
export const tabContainerBody = defineElement(elementDeclarations.TabContainerBody);
export const tabContainerHeader = defineElement(elementDeclarations.TabContainerHeader);
export const tabContainerItem = defineElement(elementDeclarations.TabContainerItem);
export const text = defineElement(elementDeclarations.Text);
export const themeToggle = defineElement(elementDeclarations.ThemeToggle);
export const video = defineElement(elementDeclarations.Video);
