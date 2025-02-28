import get from 'lodash/get';
import omit from 'lodash/omit';
import set from 'lodash/set';

import { processSelector } from './StyleHelper';

import type { Style, StyleItem, TagType } from './StyleContext';

export type StyleMapProps = {
  platform?: Style['platform'];
};

class StyleMap {
  platform: Style['platform'];

  constructor(props: StyleMapProps = {}) {
    const { platform } = props;
    if (!platform) {
      throw new Error('Platform is required');
    }

    this.platform = platform;
  }

  addSelector = (
    displayMode: string,
    selector: string,
    type: TagType,
    path: string,
    style: StyleItem['attributes'] = {}
  ) => {
    const styleItem = get(this.platform, `${displayMode}.${selector}`) as unknown as StyleItem | undefined;
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
    displayMode: string,
    selector: string,
    type: TagType,
    path: string,
    style?: StyleItem['attributes']
  ) => {
    const styleItem = get(this.platform, `${displayMode}.${selector}`) as unknown as StyleItem | undefined;
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

    const newStyle = get(this.platform, `${displayMode}.${selector}.attributes`) as unknown as StyleItem['attributes'];
    set(this.platform, `${displayMode}.${selector}.cache`, processSelector(selector, type, newStyle));

    return true;
  };

  removeSelector = (selector: string) => {
    let found = false;
    Object.keys(this.platform).forEach(displayMode => {
      if (this.platform[displayMode][selector]) {
        found = true;
        // eslint-disable-next-line
        delete this.platform[displayMode][selector];
      }
    });

    return found;
  };

  // Static

  static getInstance = (props: StyleMapProps) => new this(props);

  static addSelector = (
    platform: Style['platform'],
    displayMode: string,
    selector: string,
    type: TagType,
    path: string,
    style: StyleItem['attributes']
  ) => this.getInstance({ platform }).addSelector(displayMode, selector, type, path, style);

  static updateSelector = (
    platform: Style['platform'],
    displayMode: string,
    selector: string,
    type: TagType,
    path: string,
    style?: StyleItem['attributes']
  ) => this.getInstance({ platform }).updateSelector(displayMode, selector, type, path, style);

  static removeSelector = (platform: Style['platform'], selector: string) =>
    this.getInstance({ platform }).removeSelector(selector);
}

export default StyleMap;
