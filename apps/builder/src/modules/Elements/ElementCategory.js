// Packages
import React, { useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import { ComponentContext } from '@plitzi/plitzi-sdk';

// Relatives
import Element from './Element';

const elementsDefault = [];

const ElementCategory = props => {
  const { elements = elementsDefault, category = '' } = props;
  const { getComponentBuilderSettings } = useContext(ComponentContext);

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
    <div className="flex flex-col mt-4">
      <Heading type="h5">{category}</Heading>
      <div className="flex flex-wrap gap-4">
        {elementsToRender.map((element, key) => (
          <Element key={key} element={element} />
        ))}
      </div>
    </div>
  );
};

ElementCategory.propTypes = {
  category: PropTypes.string,
  elements: PropTypes.array
};

export default ElementCategory;
