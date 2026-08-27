import { elementDeclarations } from '@plitzi/sdk-elements/elements/declarations';

import { defineElement } from './element';

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
export const container = defineElement(elementDeclarations.Container);
export const custom = defineElement(elementDeclarations.Custom);
export const dialogContainer = defineElement(elementDeclarations.DialogContainer);
export const dropdown = defineElement(elementDeclarations.Dropdown);
export const dropdownPopup = defineElement(elementDeclarations.DropdownPopup);
export const fontAwesome = defineElement(elementDeclarations.FontAwesome);
export const form = defineElement(elementDeclarations.Form);
export const formControl = defineElement(elementDeclarations.FormControl);
export const heading = defineElement(elementDeclarations.Heading);
export const image = defineElement(elementDeclarations.Image);
export const link = defineElement(elementDeclarations.Link);
export const list = defineElement(elementDeclarations.List);
export const listItem = defineElement(elementDeclarations.ListItem);
export const markdown = defineElement(elementDeclarations.Markdown);
export const modalContainer = defineElement(elementDeclarations.ModalContainer);
export const nodeHtml = defineElement(elementDeclarations.NodeHtml);
export const pagination = defineElement(elementDeclarations.Pagination);
export const paragraph = defineElement(elementDeclarations.Paragraph);
export const reference = defineElement(elementDeclarations.Reference);
export const richText = defineElement(elementDeclarations.RichText);
export const tabContainer = defineElement(elementDeclarations.TabContainer);
export const tabContainerBody = defineElement(elementDeclarations.TabContainerBody);
export const tabContainerHeader = defineElement(elementDeclarations.TabContainerHeader);
export const tabContainerItem = defineElement(elementDeclarations.TabContainerItem);
export const text = defineElement(elementDeclarations.Text);
export const themeToggle = defineElement(elementDeclarations.ThemeToggle);
export const video = defineElement(elementDeclarations.Video);
