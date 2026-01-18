/* eslint-disable react-hooks/rules-of-hooks */
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import clsx from 'clsx';
import { use, useEffect, useMemo } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import AppContext from '@pmodules/App/AppContext';

import BuilderArea from './components/BuilderArea';
import BuilderElementTools from './components/BuilderElementTools/BuilderElementTools';

import type { ComponentPlugin, BuilderContextValue, ComponentDefinition } from '@plitzi/sdk-shared';
import type { FC } from 'react';

export type BuilderProps = {
  pages?: string[];
  customCss?: string;
  externalStyle?: string;
};

export type BuilderPluginProps = {
  renderType: string;
  component: ComponentPlugin;
  settings?: FC<unknown>;
  definition?: ComponentDefinition;
};

const Builder = ({ pages = [], customCss = '', externalStyle = '' }: BuilderProps) => {
  const builderContextValue = use(BuilderContext);
  const { existsPopup, addPopup } = usePopup();
  const { multiPagesMode, builderElementPermissions, mode, hasMultiPages } = builderContextValue;
  const { displayMode, previewMode, mobilePreview, debugMode } = use(AppContext);
  if (pages.length === 0 && mode === 'normal') {
    return (
      <div className="relative flex min-w-0 grow basis-0 flex-col items-center overflow-auto">
        <div
          className="absolute top-[50%] h-100 w-100 translate-y-[-50%] bg-contain bg-no-repeat opacity-20"
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contextsMemo = useMemo<Record<string, BuilderContextValue>>(
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
    <div
      className={clsx('builder-container flex min-w-0 grow basis-0 overflow-auto', {
        'justify-center': !multiPagesMode
      })}
    >
      {(!multiPagesMode || mode !== 'normal') && (
        <BuilderArea
          externalStyle={externalStyle}
          customCss={customCss}
          displayMode={displayMode}
          previewMode={previewMode}
          debugMode={debugMode}
        />
      )}
      {mobilePreview && mode === 'normal' && displayMode !== 'mobile' && !previewMode && (
        <BuilderArea
          className="basis-106.25"
          externalStyle={externalStyle}
          customCss={customCss}
          mobilePreview
          displayMode="mobile"
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

Builder.Plugin = (() => null) as (props: BuilderPluginProps) => null;

export default Builder;
