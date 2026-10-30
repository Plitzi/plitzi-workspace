import clsx from 'clsx';
import { use } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { SPACE_THEME_AREA, useTheme } from '@plitzi/sdk-shared/theme';
import AppContext from '@pmodules/App/AppContext';
import BuilderArea from '@pmodules/Builder/components/BuilderArea';

import TestStudioContext from '../../studio/TestStudioContext';

export type CanvasPaneProps = {
  externalStyle: string;
};

/**
 * The page the flows are played on: the space itself, live and in preview, in the device the flow chosen is played at —
 * a phone, a tablet, or a browser window. What is pressed on the right is played here, and what is done here is
 * recorded there. Drawn anew for each play, as a new visitor's page.
 */
const CanvasPane = ({ externalStyle }: CanvasPaneProps) => {
  const { canvasKey, flow } = use(TestStudioContext);
  const { displayMode, debugMode } = use(AppContext);
  const { resolvedTheme } = useTheme(SPACE_THEME_AREA);
  const [[storedCss, definition]] = useBuilderStore(['schema.settings.customCss', 'schema.definition']);
  const customCss = typeof storedCss === 'string' ? storedCss : '';
  const host =
    typeof definition.permanentUrl === 'string' && definition.permanentUrl ? definition.permanentUrl : 'space';
  const canvas = (
    <BuilderArea
      key={canvasKey}
      bare
      className="min-h-0"
      externalStyle={externalStyle}
      customCss={customCss}
      displayMode={displayMode}
      previewMode
      debugMode={debugMode}
      showHeader={false}
    />
  );

  // One tree whatever the device — only its width changes: a device changed mid-play must not mount the canvas anew
  // under the page playing on it. The page takes all the room it is given: the whole of it on a desktop, a tablet's or
  // a phone's width on those, the full height always.
  return (
    <div className="flex min-h-0 min-w-0 grow justify-center overflow-hidden">
      <div
        className={clsx(
          'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-300 dark:border-zinc-700',
          {
            'w-full': displayMode === 'desktop',
            'w-full max-w-3xl': displayMode === 'tablet',
            'w-97.5': displayMode === 'mobile',
            // Behind the page, the canvas' own theme — what shows while it is drawn anew for a play.
            'bg-white': resolvedTheme === 'light',
            'bg-zinc-950': resolvedTheme === 'dark'
          }
        )}
        title={`${host}.plitzi.app${flow?.page && flow.page !== '/' ? flow.page : ''}`}
      >
        {canvas}
      </div>
    </div>
  );
};

export default CanvasPane;
