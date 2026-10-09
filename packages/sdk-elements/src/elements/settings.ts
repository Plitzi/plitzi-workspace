import BlockHtml from './advanced/BlockHtml/Settings';
import BlockJsx from './advanced/BlockJsx/Settings';
import Custom from './advanced/Custom/Settings';
import NodeHtml from './advanced/NodeHtml/Settings';
import PlitziSdk from './advanced/PlitziSdk/Settings';
import Reference from './advanced/Reference/Settings';
import Button from './basic/Button/Settings';
import Dropdown from './basic/Dropdown/Settings';
import Heading from './basic/Heading/Settings';
import Link from './basic/Link/Settings';
import Markdown from './basic/Markdown/Settings';
import Paragraph from './basic/Paragraph/Settings';
import RichText from './basic/RichText/Settings';
import Text from './basic/Text/Settings';
import Form from './form/Form/Settings';
import FormControl from './form/FormControl/Settings';
import LayoutContainer from './internal/LayoutContainer/Settings';
import Page from './internal/Page/Settings';
import Embed from './media/Embed/Settings';
import FontAwesome from './media/FontAwesome/Settings';
import Image from './media/Image/Settings';
import Svg from './media/Svg/Settings';
import Video from './media/Video/Settings';
import ApiContainer from './provider/ApiContainer/Settings';
import Channel from './provider/Channel/Settings';
import CarouselTrack from './structure/Carousel/CarouselTrack/Settings';
import Carousel from './structure/Carousel/Settings';
import Container from './structure/Container/Settings';
import DialogContainer from './structure/DialogContainer/Settings';
import ListItem from './structure/List/ListItem/Settings';
import List from './structure/List/Settings';
import ModalContainer from './structure/ModalContainer/Settings';
import Pagination from './structure/Pagination/Settings';
import TabContainer from './structure/TabContainer/Settings';
import TabContainerBody from './structure/TabContainer/TabContainerBody/Settings';
import TabContainerHeader from './structure/TabContainer/TabContainerHeader/Settings';
import TabContainerItem from './structure/TabContainer/TabContainerItem/Settings';

import type { elementDeclarations } from './declarations';
import type { FC } from 'react';

// `plitziSdk` is declared where it renders — `apps/sdk`, since it runs a whole space — and only its settings live here.
type ElementType = (typeof elementDeclarations)[keyof typeof elementDeclarations]['type'] | 'plitziSdk';

// Keyed by the element's type, which is what the builder looks one up by: a key that is not one is a panel never shown.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultElementsSettings: Record<string, FC<any>> = {
  dropdown: Dropdown,
  plitziSdk: PlitziSdk,
  custom: Custom,
  reference: Reference,
  blockHtml: BlockHtml,
  blockJsx: BlockJsx,
  page: Page,
  container: Container,
  layoutContainer: LayoutContainer,
  dialogContainer: DialogContainer,
  modalContainer: ModalContainer,
  carousel: Carousel,
  carouselTrack: CarouselTrack,
  tabContainer: TabContainer,
  tabContainerBody: TabContainerBody,
  tabContainerHeader: TabContainerHeader,
  tabContainerItem: TabContainerItem,
  heading: Heading,
  image: Image,
  video: Video,
  embed: Embed,
  svg: Svg,
  fontAwesome: FontAwesome,
  button: Button,
  paragraph: Paragraph,
  text: Text,
  markdown: Markdown,
  richText: RichText,
  pagination: Pagination,
  nodeHtml: NodeHtml,
  list: List,
  listItem: ListItem,
  link: Link,
  form: Form,
  formControl: FormControl,
  apiContainer: ApiContainer,
  channel: Channel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} satisfies Partial<Record<ElementType, FC<any>>>;

export { defaultElementsSettings };
