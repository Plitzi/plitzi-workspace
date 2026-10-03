import { useBuilderStore } from '@plitzi/sdk-shared/store';
import ViewPage from '@pmodules/App/components/ViewPage';

import VisitorGrants from './components/VisitorGrants';
import VisitorRoles from './components/VisitorRoles';

/**
 * Who may do what here, as a visitor: the space's roles, and the people given them.
 *
 * The roles are the space's own — declared in its settings, published and exported with it. Who holds them is not:
 * it is a list of people, kept by the platform, never in a document anybody can read.
 */
const Visitors = () => {
  const [[roles = {}]] = useBuilderStore(['schema.settings.visitorRoles']);

  return (
    <ViewPage
      className="gap-8"
      description="Who may do what on the published site, signed in with their Plitzi account: the roles the space declares, and the people you give them to."
    >
      <VisitorRoles roles={roles} />
      <VisitorGrants roles={Object.keys(roles)} />
    </ViewPage>
  );
};

export default Visitors;
