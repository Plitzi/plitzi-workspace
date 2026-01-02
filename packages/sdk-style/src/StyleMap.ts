/* eslint-disable @typescript-eslint/no-dynamic-delete */
import get from 'lodash-es/get.js';
import omit from 'lodash-es/omit.js';
import set from 'lodash-es/set.js';

import processSelector from './helpers/processSelector';

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
  variables: Style['variables'];
};

class StyleMap {
  platform: Style['platform'];
  variables: Style['variables'];

  constructor(props: StyleMapProps) {
    const { platform, variables } = props;
    if (!(platform as typeof platform | undefined) || !(variables as typeof variables | undefined)) {
      throw new Error('Platform and Variables required');
    }

    this.platform = platform;
    this.variables = variables;
  }

  private static getStyleItem = (platform: Style['platform'], displayMode: DisplayMode, selector: string) => {
    const styleItem = get(platform, `${displayMode}.${selector}`) as StyleItem | undefined;

    return styleItem;
  };

  addSelector = (
    displayMode: DisplayMode,
    selector: string,
    type: TagType,
    path: string,
    style: StyleItem['attributes'] = {}
  ) => {
    const styleItem = StyleMap.getStyleItem(this.platform, displayMode, selector);
    if (styleItem) {
      return false;
    }

    let attributes = {};
    if (path) {
      set(attributes, path, style);
    } else if (!path) {
      attributes = style;
    }

    set(this.platform, `${displayMode}.${selector}`, {
      name: selector,
      type,
      attributes,
      cache: processSelector(selector, type, attributes)
    });

    return true;
  };

  updateSelector = (
    displayMode: DisplayMode,
    selector: string,
    type: TagType,
    path: string,
    style?: StyleItem['attributes']
  ) => {
    const styleItem = StyleMap.getStyleItem(this.platform, displayMode, selector);
    if (!styleItem) {
      return this.addSelector(displayMode, selector, type, path, style);
    }

    if (path && style) {
      set(this.platform, `${displayMode}.${selector}.attributes.${path}`, style);
    } else if (path) {
      set(
        this.platform,
        `${displayMode}.${selector}.attributes`,
        omit(get(this.platform, `${displayMode}.${selector}.attributes`), [path])
      );
    } else if (!path && style) {
      set(this.platform, `${displayMode}.${selector}.attributes`, style);
    }

    const newStyle = get(this.platform, `${displayMode}.${selector}.attributes`);
    set(this.platform, `${displayMode}.${selector}.cache`, processSelector(selector, type, newStyle));

    return true;
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
    const styleItem = StyleMap.getStyleItem(this.platform, displayMode, selector);
    if (!styleItem) {
      return false;
    }

    if (get(styleItem, `variables.${category}.${name}`)) {
      return false;
    }

    set(styleItem, `variables.${category}.${name}`, value);

    return true;
  };

  updateSelectorVariable = (
    displayMode: DisplayMode,
    selector: string,
    category: StyleVariableCategory,
    name: string,
    value: StyleVariableValue
  ) => {
    const styleItem = StyleMap.getStyleItem(this.platform, displayMode, selector);
    if (!styleItem) {
      return false;
    }

    set(styleItem, `variables.${category}.${name}`, value);

    return true;
  };

  removeSelectorVariable = (
    displayMode: DisplayMode,
    selector: string,
    category: StyleVariableCategory,
    name: string
  ) => {
    const styleItem = StyleMap.getStyleItem(this.platform, displayMode, selector);
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

    return true;
  };

  // Variables

  addVariable = (category: StyleVariableCategory, name: string, value: StyleVariableValue) => {
    if (!this.variables[category]) {
      this.variables[category] = {};
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
    value: StyleItem['attributes']
  ) => this.getInstance(style).addSelector(displayMode, selector, type, path, value);

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
