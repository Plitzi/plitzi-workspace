/* eslint-disable @typescript-eslint/no-dynamic-delete */
import { get, set } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../helpers/processSelector';
import getStyleItem from './helpers/getStyleItem';
import addSelector from './methods/addSelector';
import updateSelector from './methods/updateSelector';

import type {
  DisplayMode,
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
};

class StyleMap {
  platform: Style['platform'];
  variables: Style['variables'];

  constructor(props: StyleMapProps) {
    const { platform, variables } = props;
    if (!(platform as typeof platform | undefined)) {
      throw new Error('Platform Required');
    }

    this.platform = platform;
    this.variables = variables ?? {};
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
}

export default StyleMap;
