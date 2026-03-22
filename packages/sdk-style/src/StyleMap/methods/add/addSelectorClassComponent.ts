import { set } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../../../helpers/processSelector';
import getStyleItem from '../../helpers/getStyleItem';

import type { DisplayMode, Style, StyleCategory, StyleItem, StyleValue, TagType } from '@plitzi/sdk-shared';

const addSelectorClassComponent = (
  platform: Style['platform'],
  displayMode: DisplayMode,
  selector: string,
  type: TagType,
  path: StyleCategory | undefined,
  value: Extract<StyleItem, { type: 'element' }>['attributes'] | undefined | StyleValue,
  params: { componentType: string; styleSelector?: string }
) => {
  const styleItem = getStyleItem(platform, displayMode, selector) as
    | Exclude<StyleItem, { type: 'element' }>
    | undefined;
  if (styleItem || !(params as typeof params | undefined) || !params.componentType) {
    return false;
  }

  const { componentType, styleSelector } = params;
  let attributes = {} satisfies Extract<StyleItem, { type: 'element' }>['attributes'];
  if (path && styleSelector && value) {
    set(attributes, `${styleSelector}.${path}`, value);
  } else if (styleSelector && value) {
    set(attributes, styleSelector, value);
  } else if (value) {
    attributes = value;
  }

  set(platform, `${displayMode}.${selector}`, {
    name: selector,
    type,
    attributes,
    componentType,
    cache: processSelector({ name: selector, type, attributes, componentType, cache: '' } as Extract<
      StyleItem,
      { type: 'element' }
    >)
  });

  return true;
};

export default addSelectorClassComponent;
