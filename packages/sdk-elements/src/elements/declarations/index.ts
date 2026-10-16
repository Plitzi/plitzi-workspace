/**
 * Every element's static declaration, without its React component.
 *
 * The declarations live beside their elements and are imported here only to be offered as one catalogue. Keeping
 * them free of the component is what makes them readable outside a browser — a seed, a script, a migration — where
 * importing the element itself throws, because the component and the element catalogue reference each other.
 */

import BlockHtmlDeclaration from '../advanced/BlockHtml/declaration';
import BlockJsxDeclaration from '../advanced/BlockJsx/declaration';
import CustomDeclaration from '../advanced/Custom/declaration';
import NodeHtmlDeclaration from '../advanced/NodeHtml/declaration';
import PlitziSdkDeclaration from '../advanced/PlitziSdk/declaration';
import ReferenceDeclaration from '../advanced/Reference/declaration';
import ButtonDeclaration from '../basic/Button/declaration';
import DropdownDeclaration from '../basic/Dropdown/declaration';
import DropdownPopupDeclaration from '../basic/Dropdown/DropdownPopup/declaration';
import HeadingDeclaration from '../basic/Heading/declaration';
import LinkDeclaration from '../basic/Link/declaration';
import MarkdownDeclaration from '../basic/Markdown/declaration';
import ParagraphDeclaration from '../basic/Paragraph/declaration';
import RichTextDeclaration from '../basic/RichText/declaration';
import TextDeclaration from '../basic/Text/declaration';
import ThemeToggleDeclaration from '../basic/ThemeToggle/declaration';
import FormDeclaration from '../form/Form/declaration';
import FormControlDeclaration from '../form/FormControl/declaration';
import LayoutContainerDeclaration from '../internal/LayoutContainer/declaration';
import LoadingDeclaration from '../internal/Loading/declaration';
import NotFoundDeclaration from '../internal/NotFound/declaration';
import PageDeclaration from '../internal/Page/declaration';
import EmbedDeclaration from '../media/Embed/declaration';
import FontAwesomeDeclaration from '../media/FontAwesome/declaration';
import ImageDeclaration from '../media/Image/declaration';
import SvgDeclaration from '../media/Svg/declaration';
import VideoDeclaration from '../media/Video/declaration';
import ApiContainerDeclaration from '../provider/ApiContainer/declaration';
import ChannelDeclaration from '../provider/Channel/declaration';
import CarouselTrackDeclaration from '../structure/Carousel/CarouselTrack/declaration';
import CarouselDeclaration from '../structure/Carousel/declaration';
import ContainerDeclaration from '../structure/Container/declaration';
import DialogContainerDeclaration from '../structure/DialogContainer/declaration';
import ListDeclaration from '../structure/List/declaration';
import ListItemDeclaration from '../structure/List/ListItem/declaration';
import ModalContainerDeclaration from '../structure/ModalContainer/declaration';
import PaginationDeclaration from '../structure/Pagination/declaration';
import TabContainerDeclaration from '../structure/TabContainer/declaration';
import TabContainerBodyDeclaration from '../structure/TabContainer/TabContainerBody/declaration';
import TabContainerHeaderDeclaration from '../structure/TabContainer/TabContainerHeader/declaration';
import TabContainerItemDeclaration from '../structure/TabContainer/TabContainerItem/declaration';

export const elementDeclarations = {
  ApiContainer: ApiContainerDeclaration,
  BlockHtml: BlockHtmlDeclaration,
  BlockJsx: BlockJsxDeclaration,
  Button: ButtonDeclaration,
  Carousel: CarouselDeclaration,
  CarouselTrack: CarouselTrackDeclaration,
  Channel: ChannelDeclaration,
  Container: ContainerDeclaration,
  Custom: CustomDeclaration,
  DialogContainer: DialogContainerDeclaration,
  Dropdown: DropdownDeclaration,
  DropdownPopup: DropdownPopupDeclaration,
  Embed: EmbedDeclaration,
  FontAwesome: FontAwesomeDeclaration,
  Form: FormDeclaration,
  FormControl: FormControlDeclaration,
  Heading: HeadingDeclaration,
  Image: ImageDeclaration,
  LayoutContainer: LayoutContainerDeclaration,
  Link: LinkDeclaration,
  List: ListDeclaration,
  ListItem: ListItemDeclaration,
  Loading: LoadingDeclaration,
  Markdown: MarkdownDeclaration,
  ModalContainer: ModalContainerDeclaration,
  NodeHtml: NodeHtmlDeclaration,
  NotFound: NotFoundDeclaration,
  Page: PageDeclaration,
  Pagination: PaginationDeclaration,
  Paragraph: ParagraphDeclaration,
  PlitziSdk: PlitziSdkDeclaration,
  Reference: ReferenceDeclaration,
  RichText: RichTextDeclaration,
  Svg: SvgDeclaration,
  TabContainer: TabContainerDeclaration,
  TabContainerBody: TabContainerBodyDeclaration,
  TabContainerHeader: TabContainerHeaderDeclaration,
  TabContainerItem: TabContainerItemDeclaration,
  Text: TextDeclaration,
  ThemeToggle: ThemeToggleDeclaration,
  Video: VideoDeclaration
} as const;

export type ElementDeclarationName = keyof typeof elementDeclarations;

export {
  ApiContainerDeclaration,
  BlockHtmlDeclaration,
  BlockJsxDeclaration,
  ButtonDeclaration,
  CarouselDeclaration,
  CarouselTrackDeclaration,
  ChannelDeclaration,
  ContainerDeclaration,
  CustomDeclaration,
  DialogContainerDeclaration,
  DropdownDeclaration,
  DropdownPopupDeclaration,
  EmbedDeclaration,
  FontAwesomeDeclaration,
  FormControlDeclaration,
  FormDeclaration,
  HeadingDeclaration,
  ImageDeclaration,
  LayoutContainerDeclaration,
  LinkDeclaration,
  ListDeclaration,
  ListItemDeclaration,
  LoadingDeclaration,
  MarkdownDeclaration,
  ModalContainerDeclaration,
  NodeHtmlDeclaration,
  NotFoundDeclaration,
  PageDeclaration,
  PaginationDeclaration,
  ParagraphDeclaration,
  PlitziSdkDeclaration,
  ReferenceDeclaration,
  RichTextDeclaration,
  SvgDeclaration,
  TabContainerBodyDeclaration,
  TabContainerDeclaration,
  TabContainerHeaderDeclaration,
  TabContainerItemDeclaration,
  TextDeclaration,
  ThemeToggleDeclaration,
  VideoDeclaration
};

/**
 * Each type's `serverTemplates`, by the type a document names: the attributes the page server evaluates against a
 * context of its own, which the element runtime leaves as written and the authoring lint holds to that context.
 */
export const serverTemplatesByType: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.values(elementDeclarations).flatMap(declaration =>
    'serverTemplates' in declaration ? [[declaration.type, declaration.serverTemplates]] : []
  )
);

// What the declarations are checked with, from beside the elements that own them — as readable outside a browser.
export { interactionBasicTriggers } from '../../Element/helpers/elementConstants';
export { DOCUMENT_SCROLLS, isDocumentScroll } from '../internal/Page/declaration';
export type { DocumentScroll } from '../internal/Page/declaration';
export { NAMEABLE_CONTAINER_TAGS } from '../structure/Container/declaration';
export { HTML_TAG_PARTS } from '../basic/RichText/classHtmlParts';
export { isSvgMarkup } from '../media/Svg/sanitizeSvg';
// The types the declarations' attributes are written in: what an author's spec of an element is typed against.
export type { BlockJsxAttributes } from '../advanced/BlockJsx/declaration';
export type { CustomAttributes } from '../advanced/Custom/declaration';
export type { PlitziSdkAttributes } from '../advanced/PlitziSdk/declaration';
export type { FormControlAttributes } from '../form/FormControl/declaration';
export type { CarouselMode, CarouselTransition } from '../structure/Carousel/CarouselContext';
export type { PaginationPageInfo } from '../structure/Pagination/Pagination';
export type { ProviderPagination } from '../provider/ApiContainer/hooks/useProviderPagination';
export type { IconPlacement } from '../../Element/ElementWords';
