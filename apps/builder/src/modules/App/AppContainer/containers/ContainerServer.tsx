import { useMemo } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import Actions from '@pmodules/Actions/Actions';
import Notice from '@pmodules/App/components/Notice';
import Connectors from '@pmodules/Connectors/Connectors';
import Credentials from '@pmodules/Credentials';
import Data from '@pmodules/Data';
import Functions from '@pmodules/Functions';
import Runtime from '@pmodules/Runtime';
import { useSpaceAccess } from '@pmodules/Space/hooks/useSpaceEntitlements';

import PanelSections from '../../components/PanelSections';

import type { PanelSection } from '../../components/PanelSections';

/** Each section with the space permission it takes: the data is the content's, the rest code or settings. */
const SECTIONS: (PanelSection & { needs: string })[] = [
  { id: 'actions', label: 'Actions', content: <Actions />, needs: 'spaceCode' },
  { id: 'functions', label: 'Functions', content: <Functions />, needs: 'spaceCode' },
  { id: 'data', label: 'Data', content: <Data />, needs: 'spaceContent' },
  { id: 'connectors', label: 'Connectors', content: <Connectors />, needs: 'spaceCode' },
  { id: 'credentials', label: 'Credentials', content: <Credentials />, needs: 'spaceManage' },
  { id: 'runtime', label: 'Runtime', content: <Runtime />, needs: 'spaceCode' }
];

/**
 * Everything of the space that runs on a server — its actions, functions, the data its pages read there, connectors,
 * the credentials they use and its runtime — under one entry of the sidebar. Whether the space HAS a server to run them is said here, once, above them
 * all.
 */
const ContainerServer = () => {
  const [hasServerRendering] = useBuilderStore('hasServerRendering');
  const { may } = useSpaceAccess();
  const sections = useMemo(() => SECTIONS.filter(section => may(section.needs)), [may]);
  if (sections.length === 0) {
    return null;
  }

  const [first, ...rest] = sections;

  return (
    <div className="flex min-h-0 grow basis-0 flex-col bg-white dark:bg-zinc-900">
      <PanelSections
        name="server"
        sections={[first, ...rest]}
        variant="page"
        notice={
          !hasServerRendering && (
            <Notice tone="caution">
              <span>
                <b className="font-semibold">No server-rendered deployment.</b> What is here runs on a server or not at
                all: an action reports itself inert and connectors resolve only in this preview. Deploy the space with a
                Plitzi SSR credential to reach visitors.
              </span>
            </Notice>
          )
        }
      />
    </div>
  );
};

export default ContainerServer;
