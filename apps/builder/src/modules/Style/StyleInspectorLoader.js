import { use } from 'react';

import StyleInspector from '@plitzi/sdk-style/StyleInspector';

import AppContext from '@pmodules/App/AppContext';

const StyleInspectorLoader = ({ element, styleSelectors }) => {
  const { displayMode } = use(AppContext);

  return <StyleInspector mode="element" element={element} styleSelectors={styleSelectors} displayMode={displayMode} />;
};

export default StyleInspectorLoader;
