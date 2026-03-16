/* eslint-disable @typescript-eslint/no-dynamic-delete */
import { get, set } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../helpers/processSelector';
import getStyleItem from './helpers/getStyleItem';
import addSelectorClassComponent from './methods/add/addSelectorClassComponent';
import addSelectorDefault from './methods/add/addSelectorDefault';
import updateSelectorClassComponent from './methods/update/updateSelectorClassComponent';
import updateSelectorDefault from './methods/update/updateSelectorDefault';

import type {
  DisplayMode,
  Style,
  StyleItem,
  StyleVariableCategory,
  StyleVariableValue,
  TagType
} from '@plitzi/sdk-shared';

export const EMPTY_STYLE_SCHEMA: Style = {
  platform: { desktop: {}, tablet: {}, mobile: {} },
  mode: 'desktop-first',
  theme: {
    default: 'system',
    schemes: ['light', 'dark']
  },
  variables: {},
  cache: ''
};

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
      throw new Error('Platform and Variables required');
    }

    this.platform = platform;
    this.variables = variables ?? {};
  }

  addSelector = (
    displayMode: DisplayMode,
    selector: string,
    type: TagType,
    path: string,
    value?: StyleItem['attributes'],
    params?: { componentType?: string }
  ) => {
    if (type === 'class-component') {
      return addSelectorClassComponent(
        this.platform,
        displayMode,
        selector,
        type,
        path,
        value as Extract<StyleItem, { type: 'class-component' }>['attributes'] | undefined,
        params?.componentType ?? ''
      );
    }

    return addSelectorDefault(
      this.platform,
      displayMode,
      selector,
      type,
      path,
      value as Exclude<StyleItem, { type: 'class-component' }>['attributes'] | undefined
    );
  };

  getSelector = (displayMode: DisplayMode, selector: string) => getStyleItem(this.platform, displayMode, selector);

  updateSelector = (
    displayMode: DisplayMode,
    selector: string,
    type: TagType,
    path: string,
    value?: StyleItem['attributes']
  ) => {
    if (type === 'class-component') {
      return updateSelectorClassComponent(
        this.platform,
        displayMode,
        selector,
        path,
        value as Extract<StyleItem, { type: 'class-component' }>['attributes'] | undefined
      );
    }

    return updateSelectorDefault(
      this.platform,
      displayMode,
      selector,
      path,
      value as Exclude<StyleItem, { type: 'class-component' }>['attributes'] | undefined
    );
  };

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

  updateVariable = (category: StyleVariableCategory, name: string, value: StyleVariableValue) => {
    if (!this.variables[category] || !this.variables[category][name]) {
      return false;
    }

    this.variables[category][name] = value;

    return true;
  };

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

  // Static

  static getInstance = (props: StyleMapProps) => new this(props);

  static addSelector = (
    style: Pick<Style, 'platform' | 'variables'>,
    displayMode: DisplayMode,
    selector: string,
    type: TagType,
    path: string,
    value?: StyleItem['attributes'],
    params?: { componentType?: string }
  ) => this.getInstance(style).addSelector(displayMode, selector, type, path, value, params);

  static getSelector = (style: Pick<Style, 'platform' | 'variables'>, displayMode: DisplayMode, selector: string) =>
    this.getInstance(style).getSelector(displayMode, selector);

  static updateSelector = (
    style: Pick<Style, 'platform' | 'variables'>,
    displayMode: DisplayMode,
    selector: string,
    type: TagType,
    path: string,
    value?: StyleItem['attributes']
  ) => this.getInstance(style).updateSelector(displayMode, selector, type, path, value);

  static removeSelector = (
    style: Pick<Style, 'platform' | 'variables'>,
    displayMode: DisplayMode | undefined,
    selector: string
  ) => this.getInstance(style).removeSelector(displayMode, selector);

  static addSelectorVariable = (
    style: Pick<Style, 'platform' | 'variables'>,
    displayMode: DisplayMode,
    selector: string,
    category: StyleVariableCategory,
    name: string,
    value: StyleVariableValue
  ) => this.getInstance(style).addSelectorVariable(displayMode, selector, category, name, value);

  static updateSelectorVariable = (
    style: Pick<Style, 'platform' | 'variables'>,
    displayMode: DisplayMode,
    selector: string,
    category: StyleVariableCategory,
    name: string,
    value: StyleVariableValue
  ) => this.getInstance(style).updateSelectorVariable(displayMode, selector, category, name, value);

  static removeSelectorVariable = (
    style: Pick<Style, 'platform' | 'variables'>,
    displayMode: DisplayMode,
    selector: string,
    category: StyleVariableCategory,
    name: string
  ) => this.getInstance(style).removeSelectorVariable(displayMode, selector, category, name);

  static addVariable = (
    style: Pick<Style, 'platform' | 'variables'>,
    category: StyleVariableCategory,
    name: string,
    value: StyleVariableValue
  ) => this.getInstance(style).addVariable(category, name, value);

  static updateVariable = (
    style: Pick<Style, 'platform' | 'variables'>,
    category: StyleVariableCategory,
    name: string,
    value: StyleVariableValue
  ) => this.getInstance(style).updateVariable(category, name, value);

  static removeVariable = (
    style: Pick<Style, 'platform' | 'variables'>,
    category: StyleVariableCategory,
    name: string
  ) => this.getInstance(style).removeVariable(category, name);
}

export default StyleMap;
