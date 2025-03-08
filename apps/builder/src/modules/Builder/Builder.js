import React, { use, useEffect, useMemo } from 'react';
import usePopup from '@plitzi/plitzi-ui/Popup/usePopup';

import BuilderContext from '@plitzi/sdk-shared/builder/BuilderContext';

import AppContext from '@pmodules/App/AppContext';

import BuilderArea from './components/BuilderArea';
import { BUILDER_MODE_NORMAL } from './BuilderProvider';
import BuilderElementTools from './components/BuilderElementTools/BuilderElementTools';

const pagesDefault = [];

/**
 * @param {{
 *   pages?: string[];
 *   customCss?: string;
 *   externalStyle?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const Builder = props => {
  const { pages = pagesDefault, customCss = '', externalStyle = '' } = props;
  const builderContextValue = use(BuilderContext);
  const { existsPopup, addPopup } = usePopup();
  const { multiPagesMode, builderElementPermissions, mode, hasMultiPages } = builderContextValue;
  const { displayMode, previewMode, mobilePreview, debugMode } = use(AppContext);
  if (pages.length === 0 && mode === BUILDER_MODE_NORMAL) {
    return (
      <div className="flex grow basis-0 overflow-auto min-w-0 relative flex-col items-center">
        <div
          className="opacity-20 translate-y-[-50%] h-[400px] w-[400px] top-[50%] absolute bg-no-repeat bg-contain"
          style={{ backgroundImage: 'url(https://cdn.plitzi.com/resources/img/favicon.svg)' }}
        />
        <div>Please add your first page</div>
      </div>
    );
  }

  useEffect(() => {
    if (!existsPopup('element-tools')) {
      addPopup('element-tools', <BuilderElementTools />, {
        icon: <i className="fas fa-tools text-base" />,
        title: 'Tools',
        resizeHandles: ['se'],
        width: 350,
        allowLeftSide: true,
        allowRightSide: true,
        placement: 'right'
      });
    }
  }, []);

  const contextsMemo = useMemo(
    () =>
      pages.reduce(
        (acum, page) => ({
          ...acum,
          [page]: { ...builderContextValue, baseContext: { baseElementId: page }, builderElementPermissions }
        }),
        {}
      ),
    [pages, builderElementPermissions, builderContextValue]
  );

  return (
    <div className="flex grow basis-0 overflow-auto min-w-0">
      {(!multiPagesMode || mode !== BUILDER_MODE_NORMAL) && (
        <BuilderArea
          externalStyle={externalStyle}
          customCss={customCss}
          displayMode={displayMode}
          previewMode={previewMode}
          debugMode={debugMode}
        />
      )}
      {mobilePreview && mode === BUILDER_MODE_NORMAL && displayMode !== 'mobile' && !previewMode && (
        <BuilderArea
          className="basis-[425px] mb-11"
          externalStyle={externalStyle}
          customCss={customCss}
          mobilePreview
          displayMode="mobile"
          showFooter={false}
          headerTitle="Mobile Preview"
          previewMode
        />
      )}
      {multiPagesMode &&
        hasMultiPages &&
        pages.map(page => (
          <BuilderContext key={page} value={contextsMemo[page]}>
            <BuilderArea
              externalStyle={externalStyle}
              customCss={customCss}
              displayMode={displayMode}
              previewMode={previewMode}
              debugMode={debugMode}
            />
          </BuilderContext>
        ))}
    </div>
  );
};

Builder.Plugin = () => null;

export default Builder;
