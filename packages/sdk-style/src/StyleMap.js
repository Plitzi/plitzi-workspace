// Packages
import get from 'lodash/get.js';
import set from 'lodash/set.js';
import omit from 'lodash/omit.js';

// Relatives
import { processSelector } from './StyleHelper.js';

class StyleMap {
  constructor(props = {}) {
    const { platform } = props;
    if (!platform) {
      throw new Error('Platform is required');
    }

    this.platform = platform;
  }

  addSelector = (displayMode, selector, type, path, style) => {
    if (get(this.platform, `${displayMode}.${selector}`)) {
      return false;
    }

    let attributes = {};
    if (path) {
      set(attributes, path, style);
    } else if (!path && style) {
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

  updateSelector = (displayMode, selector, type, path, style) => {
    if (!get(this.platform, `${displayMode}.${selector}`)) {
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

  removeSelector = selector => {
    let found = false;
    Object.keys(this.platform).forEach(displayMode => {
      if (this.platform && this.platform[displayMode] && this.platform[displayMode][selector]) {
        found = true;
        delete this.platform[displayMode][selector];
      }
    });

    return found;
  };

  // Static

  static getInstance = props => new this(props);

  static addSelector = (platform, displayMode, selector, type, path, style) =>
    this.getInstance({ platform }).addSelector(displayMode, selector, type, path, style);

  static updateSelector = (platform, displayMode, selector, type, path, style) =>
    this.getInstance({ platform }).updateSelector(displayMode, selector, type, path, style);

  static removeSelector = (platform, selector) => this.getInstance({ platform }).removeSelector(selector);
}

export default StyleMap;
