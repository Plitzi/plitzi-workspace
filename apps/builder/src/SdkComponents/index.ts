/* eslint-disable @typescript-eslint/no-explicit-any */

import BlockHtml from './advanced/BlockHtml/Settings';
import BlockJsx from './advanced/BlockJsx/Settings';
import Custom from './advanced/Custom/Settings';
import PlitziSdk from './advanced/PlitziSdk/Settings';
import Reference from './advanced/Reference/Settings';
import Button from './basic/Button/Settings';
import Dropdown from './basic/Dropdown/Settings';
import Heading from './basic/Heading/Settings';
import Link from './basic/Link/Settings';
import Markdown from './basic/Markdown/Settings';
import Paragraph from './basic/Paragraph/Settings';
import Text from './basic/Text/Settings';
import Form from './form/Form/Settings';
import FormControl from './form/FormControl/Settings';
import LayoutContainer from './internal/LayoutContainer/Settings';
import Page from './internal/Page/Settings';
import FontAwesome from './media/FontAwesome/Settings';
import Image from './media/Image/Settings';
import Video from './media/Video/Settings';
import ApiContainer from './provider/ApiContainer/Settings';
import CollectionContainer from './provider/CollectionContainer/Settings';
import Container from './structure/Container/Settings';
import DialogContainer from './structure/DialogContainer/Settings';
import List from './structure/List/Settings';
import ModalContainer from './structure/ModalContainer/Settings';
import TabContainer from './structure/TabContainer/Settings';

import type { FC } from 'react';

const defaultElementsSettings: Record<string, FC<any>> = {
  dropdown: Dropdown,
  plitziSdk: PlitziSdk,
  // notFound: NotFound,
  // loading: Loading,
  custom: Custom,
  reference: Reference,
  blockHtml: BlockHtml,
  blockJsx: BlockJsx,
  page: Page,
  container: Container,
  layoutContainer: LayoutContainer,
  dialogContainer: DialogContainer,
  modalContainer: ModalContainer,
  tabContainer: TabContainer,
  heading: Heading,
  image: Image,
  video: Video,
  fontAwesome: FontAwesome,
  button: Button,
  paragraph: Paragraph,
  text: Text,
  markdown: Markdown,
  list: List,
  link: Link,
  form: Form,
  formControl: FormControl,
  apiContainer: ApiContainer,
  collectionContainer: CollectionContainer
};

export { defaultElementsSettings };
