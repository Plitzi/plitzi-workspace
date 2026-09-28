import Card from '@plitzi/plitzi-ui/Card';
import Heading from '@plitzi/plitzi-ui/Heading';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

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
    <Card className="relative flex grow basis-0" rounded="none">
      <Card.Body grow>
        <div className="mx-auto flex w-full max-w-4xl grow basis-0 flex-col gap-6 p-4">
          <Heading as="h5">Visitors</Heading>
          <VisitorRoles roles={roles} />
          <VisitorGrants roles={Object.keys(roles)} />
        </div>
      </Card.Body>
    </Card>
  );
};

export default Visitors;
