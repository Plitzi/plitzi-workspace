// Packages
import React, { useCallback, use } from 'react';
import get from 'lodash/get';
import Text from '@plitzi/plitzi-ui/Text';

// Monorepo
import ComponentContext from '@plitzi/sdk-elements/ComponentContext';

// Relatives
import Element from './Element';

const elementsDefault = [];

/**
 * @param {{
 *   elements?: object[];
 *   category?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const ElementCategory = props => {
  const { elements = elementsDefault, category = '' } = props;
  const { getComponentBuilderSettings } = use(ComponentContext);

  const builderElementPermissions = useCallback(
    (element, path = '', defaultValue = undefined) => {
      if (!element) {
        return {};
      }

      const type = get(element, 'definition.type');
      if (!type) {
        return {};
      }

      return getComponentBuilderSettings(element.definition.type, path, defaultValue);
    },
    [getComponentBuilderSettings]
  );

  const elementsToRender = elements.filter(element => builderElementPermissions(element, 'canDragDrop', true));
  if (elementsToRender.length === 0) {
    return undefined;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="border-t border-gray-200" />
      <Text size="sm" weight={500} className="capitalize">
        {category}
      </Text>
      <div className="flex flex-wrap gap-2">
        {elementsToRender.map((element, key) => (
          <Element key={key} element={element} />
        ))}
      </div>
    </div>
  );
};

export default ElementCategory;
