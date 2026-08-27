/**
 * Every element's static declaration, without its React component.
 *
 * The declarations live beside their elements and are imported here only to be offered as one catalogue. Keeping
 * them free of the component is what makes them readable outside a browser — a seed, a script, a migration — where
 * importing the element itself throws, because the component and the element catalogue reference each other.
 */

import BlockHtmlDeclaration from './advanced/BlockHtml/declaration';
import BlockJsxDeclaration from './advanced/BlockJsx/declaration';
import CustomDeclaration from './advanced/Custom/declaration';
import NodeHtmlDeclaration from './advanced/NodeHtml/declaration';
import ReferenceDeclaration from './advanced/Reference/declaration';
import ButtonDeclaration from './basic/Button/declaration';
import DropdownDeclaration from './basic/Dropdown/declaration';
import DropdownPopupDeclaration from './basic/Dropdown/DropdownPopup/declaration';
import HeadingDeclaration from './basic/Heading/declaration';
import LinkDeclaration from './basic/Link/declaration';
import MarkdownDeclaration from './basic/Markdown/declaration';
import ParagraphDeclaration from './basic/Paragraph/declaration';
import RichTextDeclaration from './basic/RichText/declaration';
import TextDeclaration from './basic/Text/declaration';
import ThemeToggleDeclaration from './basic/ThemeToggle/declaration';
import FormDeclaration from './form/Form/declaration';
import FormControlDeclaration from './form/FormControl/declaration';
import LayoutContainerDeclaration from './internal/LayoutContainer/declaration';
import LoadingDeclaration from './internal/Loading/declaration';
import NotFoundDeclaration from './internal/NotFound/declaration';
import PageDeclaration from './internal/Page/declaration';
import FontAwesomeDeclaration from './media/FontAwesome/declaration';
import ImageDeclaration from './media/Image/declaration';
import VideoDeclaration from './media/Video/declaration';
import ApiContainerDeclaration from './provider/ApiContainer/declaration';
import ContainerDeclaration from './structure/Container/declaration';
import DialogContainerDeclaration from './structure/DialogContainer/declaration';
import ListDeclaration from './structure/List/declaration';
import ListItemDeclaration from './structure/List/ListItem/declaration';
import ModalContainerDeclaration from './structure/ModalContainer/declaration';
import PaginationDeclaration from './structure/Pagination/declaration';
import TabContainerDeclaration from './structure/TabContainer/declaration';
import TabContainerBodyDeclaration from './structure/TabContainer/TabContainerBody/declaration';
import TabContainerHeaderDeclaration from './structure/TabContainer/TabContainerHeader/declaration';
import TabContainerItemDeclaration from './structure/TabContainer/TabContainerItem/declaration';

export const elementDeclarations = {
  ApiContainer: ApiContainerDeclaration,
  BlockHtml: BlockHtmlDeclaration,
  BlockJsx: BlockJsxDeclaration,
  Button: ButtonDeclaration,
  Container: ContainerDeclaration,
  Custom: CustomDeclaration,
  DialogContainer: DialogContainerDeclaration,
  Dropdown: DropdownDeclaration,
  DropdownPopup: DropdownPopupDeclaration,
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
  Reference: ReferenceDeclaration,
  RichText: RichTextDeclaration,
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
  ContainerDeclaration,
  CustomDeclaration,
  DialogContainerDeclaration,
  DropdownDeclaration,
  DropdownPopupDeclaration,
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
  ReferenceDeclaration,
  RichTextDeclaration,
  TabContainerBodyDeclaration,
  TabContainerDeclaration,
  TabContainerHeaderDeclaration,
  TabContainerItemDeclaration,
  TextDeclaration,
  ThemeToggleDeclaration,
  VideoDeclaration
};
