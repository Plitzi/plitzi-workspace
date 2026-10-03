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
    <div className="flex min-h-0 grow basis-0 flex-col bg-white dark:bg-zinc-900">
      <PanelSections
        name="server"
        sections={SECTIONS}
        variant="page"
        notice={
          !hasServerRendering && (
            <Alert intent="warning" size="xs" solid={false}>
              <span>
                <b className="font-semibold">No server-rendered deployment.</b> What is here runs on a server or not at
                all: an action reports itself inert and connectors resolve only in this preview. Deploy the space with a
                Plitzi SSR credential to reach visitors.
              </span>
            </Alert>
          )
        }
      />
    </div>
  );
};

export default ContainerServer;
