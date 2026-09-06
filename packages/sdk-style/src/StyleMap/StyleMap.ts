/* eslint-disable @typescript-eslint/no-dynamic-delete */
import { get, set } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../helpers/processSelector';
import getStyleItem from './helpers/getStyleItem';
import addSelector from './methods/addSelector';
import updateSelector from './methods/updateSelector';

import type {
  DisplayMode,
  SpaceFont,
  Style,
  StyleCategory,
  StyleItem,
  StyleObject,
  StyleState,
  StyleValue,
  StyleVariableCategory,
  StyleVariableValue,
  TagType
} from '@plitzi/sdk-shared';

export type StyleMapProps = {
  platform: Style['platform'];
  variables?: Style['variables'];
  fonts?: Style['fonts'];
};

class StyleMap {
  platform: Style['platform'];
  variables: Style['variables'];
  fonts: SpaceFont[];

  constructor(props: StyleMapProps) {
    const { platform, variables, fonts } = props;
    if (!(platform as typeof platform | undefined)) {
      throw new Error('Platform Required');
    }

    this.platform = platform;
    this.variables = variables ?? {};
    this.fonts = fonts ?? [];
  }

  static getInstance = (props: StyleMapProps) => new this(props);

  addSelector(
    displayMode: DisplayMode,
    selector: string,
    type: TagType,
    path: StyleCategory | undefined,
    value: StyleItem['attributes'] | Partial<StyleObject> | StyleValue | undefined,
    params: { componentType?: string; styleSelector?: string; styleState?: StyleState; styleVariant?: string }
  ): boolean {
    return addSelector(this.platform, displayMode, selector, type, path, value, params);
  }

  static addSelector(
    style: Pick<Style, 'platform' | 'variables'>,
    displayMode: DisplayMode,
    selector: string,
    type: TagType,
    path: StyleCategory | undefined,
    value: StyleItem['attributes'] | Partial<StyleObject> | StyleValue | undefined,
    params: { componentType?: string; styleSelector?: string; styleState?: StyleState; styleVariant?: string }
  ): boolean {
    return this.getInstance(style).addSelector(displayMode, selector, type, path, value, params);
  }

  getSelector = (displayMode: DisplayMode, selector: string) => getStyleItem(this.platform, displayMode, selector);

  static getSelector = (style: Pick<Style, 'platform' | 'variables'>, displayMode: DisplayMode, selector: string) =>
    this.getInstance(style).getSelector(displayMode, selector);

  updateSelector(
    displayMode: DisplayMode,
    selector: string,
    path: StyleCategory | undefined,
    value: StyleItem['attributes'] | Partial<StyleObject> | StyleValue | undefined,
    params: { componentType?: string; styleSelector: string; styleState?: StyleState; styleVariant?: string }
  ): boolean {
    return updateSelector(this.platform, displayMode, selector, path, value, params);
  }

  static updateSelector(
    style: Pick<Style, 'platform' | 'variables'>,
    displayMode: DisplayMode,
    selector: string,
    path: StyleCategory | undefined,
    value: StyleItem['attributes'] | Partial<StyleObject> | StyleValue | undefined,
    params: { componentType?: string; styleSelector: string; styleState?: StyleState; styleVariant?: string }
  ): boolean {
    return this.getInstance(style).updateSelector(displayMode, selector, path, value, params);
  }

  removeSelector = (displayMode: DisplayMode | undefined, selector: string) => {
    if (displayMode) {
      if (!(this.platform[displayMode][selector] as StyleItem | undefined)) {
        return false;
      }

      delete this.platform[displayMode][selector];

      return true;
    }

    let found = false;
    (Object.keys(this.platform) as DisplayMode[]).forEach(displayMode => {
      if (this.platform[displayMode][selector] as StyleItem | undefined) {
        found = true;
        delete this.platform[displayMode][selector];
      }
    });

    return found;
  };

  static removeSelector = (
    style: Pick<Style, 'platform' | 'variables'>,
    displayMode: DisplayMode | undefined,
    selector: string
  ) => this.getInstance(style).removeSelector(displayMode, selector);

  // Selector Variables

  addSelectorVariable = (
    displayMode: DisplayMode,
    selector: string,
    category: StyleVariableCategory,
    name: string,
    value: StyleVariableValue
  ) => {
    const styleItem = getStyleItem(this.platform, displayMode, selector);
    if (!styleItem) {
      return false;
    }

    if (get(styleItem, `variables.${category}.${name}`, '') as StyleVariableValue | undefined) {
      return false;
    }

    set(styleItem, `variables.${category}.${name}`, value);
    set(this.platform, `${displayMode}.${selector}.cache`, processSelector(styleItem));

    return true;
  };

  static addSelectorVariable = (
    style: Pick<Style, 'platform' | 'variables'>,
    displayMode: DisplayMode,
    selector: string,
    category: StyleVariableCategory,
    name: string,
    value: StyleVariableValue
  ) => this.getInstance(style).addSelectorVariable(displayMode, selector, category, name, value);

  updateSelectorVariable = (
    displayMode: DisplayMode,
    selector: string,
    category: StyleVariableCategory,
    name: string,
    value: StyleVariableValue
  ) => {
    const styleItem = getStyleItem(this.platform, displayMode, selector);
    if (!styleItem) {
      return false;
    }

    set(styleItem, `variables.${category}.${name}`, value);
    set(this.platform, `${displayMode}.${selector}.cache`, processSelector(styleItem));

    return true;
  };

  static updateSelectorVariable = (
    style: Pick<Style, 'platform' | 'variables'>,
    displayMode: DisplayMode,
    selector: string,
    category: StyleVariableCategory,
    name: string,
    value: StyleVariableValue
  ) => this.getInstance(style).updateSelectorVariable(displayMode, selector, category, name, value);

  removeSelectorVariable = (
    displayMode: DisplayMode,
    selector: string,
    category: StyleVariableCategory,
    name: string
  ) => {
    const styleItem = getStyleItem(this.platform, displayMode, selector);
    if (!styleItem || !styleItem.variables || !styleItem.variables[category] || !styleItem.variables[category][name]) {
      return false;
    }

    delete styleItem.variables[category][name];
    if (Object.keys(styleItem.variables[category]).length === 0) {
      delete styleItem.variables[category];
    }

    if (Object.keys(styleItem.variables).length === 0) {
      delete styleItem.variables;
    }

    set(this.platform, `${displayMode}.${selector}.cache`, processSelector(styleItem));

    return true;
  };

  static removeSelectorVariable = (
    style: Pick<Style, 'platform' | 'variables'>,
    displayMode: DisplayMode,
    selector: string,
    category: StyleVariableCategory,
    name: string
  ) => this.getInstance(style).removeSelectorVariable(displayMode, selector, category, name);

  // Variables

  addVariable = (category: StyleVariableCategory, name: string, value: StyleVariableValue) => {
    if (!this.variables[category]) {
      this.variables[category] = {};
    }

    if (this.variables[category][name]) {
      return false;
    }

    this.variables[category][name] = value;

    return true;
  };

  static addVariable = (
    style: Pick<Style, 'platform' | 'variables'>,
    category: StyleVariableCategory,
    name: string,
    value: StyleVariableValue
  ) => this.getInstance(style).addVariable(category, name, value);

  updateVariable = (category: StyleVariableCategory, name: string, value: StyleVariableValue) => {
    if (!this.variables[category] || !this.variables[category][name]) {
      return false;
    }

    this.variables[category][name] = value;

    return true;
  };

  static updateVariable = (
    style: Pick<Style, 'platform' | 'variables'>,
    category: StyleVariableCategory,
    name: string,
    value: StyleVariableValue
  ) => this.getInstance(style).updateVariable(category, name, value);

  removeVariable = (category: StyleVariableCategory, name: string) => {
    if (!this.variables[category] || !this.variables[category][name]) {
      return false;
    }

    delete this.variables[category][name];
    if (Object.keys(this.variables[category]).length === 0) {
      delete this.variables[category];
    }

    return true;
  };

  static removeVariable = (
    style: Pick<Style, 'platform' | 'variables'>,
    category: StyleVariableCategory,
    name: string
  ) => this.getInstance(style).removeVariable(category, name);

  // Fonts

  /** A family is the key: it is what `font-family` names, so a space cannot hold two of the same. */
  addFont = (font: SpaceFont) => {
    if (this.fonts.some(item => item.family === font.family)) {
      return false;
    }

    this.fonts.push(font);

    return true;
  };

  /**
   * The write-back is what makes this work on a document that predates the manifest: there was no array to mutate,
   * so the instance made one, and without this line the font would be added to something nobody holds.
   */
  static addFont = (style: Pick<Style, 'platform' | 'variables' | 'fonts'>, font: SpaceFont) => {
    const instance = this.getInstance(style);
    const added = instance.addFont(font);
    style.fonts = instance.fonts;

    return added;
  };

  updateFont = (family: string, font: SpaceFont) => {
    const index = this.fonts.findIndex(item => item.family === family);
    if (index === -1) {
      return false;
    }

    // A rename is a family that already belongs to something else — refused here rather than silently making a
    // duplicate the picker would show twice.
    if (font.family !== family && this.fonts.some(item => item.family === font.family)) {
      return false;
    }

    this.fonts[index] = font;

    return true;
  };

  static updateFont = (style: Pick<Style, 'platform' | 'variables' | 'fonts'>, family: string, font: SpaceFont) => {
    const instance = this.getInstance(style);
    const updated = instance.updateFont(family, font);
    style.fonts = instance.fonts;

    return updated;
  };

  removeFont = (family: string) => {
    const index = this.fonts.findIndex(item => item.family === family);
    if (index === -1) {
      return false;
    }

    this.fonts.splice(index, 1);

    return true;
  };

  static removeFont = (style: Pick<Style, 'platform' | 'variables' | 'fonts'>, family: string) => {
    const instance = this.getInstance(style);
    const removed = instance.removeFont(family);
    style.fonts = instance.fonts;

    return removed;
  };
}

export default StyleMap;
