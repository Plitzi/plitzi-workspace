import { produce } from 'immer';
import set from 'lodash/set';
import { use, useCallback } from 'react';

import StyleInspector from '@plitzi/sdk-style/StyleInspector';

import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import BuilderStyleContext from '@pmodules/Builder/contexts/BuilderStyleContext';
import AppContext from '@pmodules/App/AppContext';
import BuilderContext from '@pmodules/Builder/BuilderContext';

const StyleInspectorLoader = ({ element, styleSelectors }) => {
  const { displayMode } = use(AppContext);
  const { builderHandler } = use(BuilderContext);
  const { style, selectorSelected, setSelectorSelected, styleSelector, setStyleSelector } = use(BuilderStyleContext);

  const handleAddSelector = useCallback(
    (tag, isDuplicated, originalTag) => {
      if (!tag || (isDuplicated && !originalTag)) {
        return;
      }

      const { platform } = style;
      const { name, type } = tag;
      if (!isDuplicated && name !== '' && !platform[displayMode][name]) {
        builderHandler(EventBridgeTypes.STYLE_ADD_SELECTOR, displayMode, name, type);
      } else if (
        isDuplicated &&
        originalTag &&
        tag &&
        originalTag.name !== name &&
        platform[displayMode][originalTag.name] &&
        !platform[displayMode][name]
      ) {
        builderHandler(
          EventBridgeTypes.STYLE_ADD_SELECTOR,
          displayMode,
          name,
          type,
          '',
          get(platform, `${displayMode}.${originalTag.name}.attributes`, {})
        );
      }
    },
    [builderHandler, displayMode, style]
  );

  const handleChangeSelector = useCallback(
    value => {
      if (!element) {
        return;
      }

      builderHandler(
        EventBridgeTypes.SCHEMA_UPDATE_ELEMENT,
        produce(element, draft => {
          set(draft, `definition.styleSelectors.${styleSelector}`, value);
        })
      );
    },
    [element, builderHandler, styleSelector]
  );

  const handleRemoveSelector = useCallback(() => {}, []);

  if (!element) {
    return undefined;
  }

  return (
    <StyleInspector
      mode="element"
      element={element}
      styleSelectors={styleSelectors}
      displayMode={displayMode}
      style={style}
      selectorSelected={selectorSelected}
      setSelectorSelected={setSelectorSelected}
      styleSelector={styleSelector}
      setStyleSelector={setStyleSelector}
      onAdd={handleAddSelector}
      onChange={handleChangeSelector}
      onRemove={handleRemoveSelector}
    />
  );
};

export default StyleInspectorLoader;
