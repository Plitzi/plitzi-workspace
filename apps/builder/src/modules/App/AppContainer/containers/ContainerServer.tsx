import Alert from '@plitzi/plitzi-ui/Alert';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import Actions from '@pmodules/Actions/Actions';
import Connectors from '@pmodules/Connectors/Connectors';
import Credentials from '@pmodules/Credentials';
import Functions from '@pmodules/Functions';
import Runtime from '@pmodules/Runtime';

import PanelSections from '../../components/PanelSections';

import type { PanelSection } from '../../components/PanelSections';

const SECTIONS: [PanelSection, ...PanelSection[]] = [
  { id: 'actions', label: 'Actions', content: <Actions /> },
  { id: 'functions', label: 'Functions', content: <Functions /> },
  { id: 'connectors', label: 'Connectors', content: <Connectors /> },
  { id: 'credentials', label: 'Credentials', content: <Credentials /> },
  { id: 'runtime', label: 'Runtime', content: <Runtime /> }
];

/**
 * Everything of the space that runs on a server — its actions, functions, connectors, the credentials they use and its
 * runtime — under one entry of the sidebar. Whether the space HAS a server to run them is said here, once, above them
 * all.
 */
const ContainerServer = () => {
  const [hasServerRendering] = useBuilderStore('hasServerRendering');

  return (
    <div className="flex min-h-0 grow basis-0 flex-col bg-white dark:bg-zinc-800">
      {!hasServerRendering && (
        <div className="mx-auto w-full max-w-4xl px-4 pt-4">
          <Alert intent="warning" size="sm" solid={false}>
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-medium">This space has no server-rendered deployment.</span>
              <span>
                What is here runs on a server or does not run: a step that calls an action reports itself inert rather
                than doing the work in the browser, and connectors resolve only in the builder&apos;s preview.
              </span>
              <span>To reach visitors, deploy the space with a Plitzi SSR credential.</span>
            </div>
          </Alert>
        </div>
      )}
      <PanelSections name="server" sections={SECTIONS} variant="page" />
    </div>
  );
};

export default ContainerServer;
