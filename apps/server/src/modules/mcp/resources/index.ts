import { bindingResource } from './glossary/binding';
import { collectionResource } from './glossary/collection';
import { displayModeResource } from './glossary/displayMode';
import { elementResource } from './glossary/element';
import { environmentResource } from './glossary/environment';
import { interactionResource } from './glossary/interaction';
import { pageResource } from './glossary/page';
import { pluginResource } from './glossary/plugin';
import { resourceResource } from './glossary/resource';
import { schemaResource } from './glossary/schema';
import { schemaVariableResource } from './glossary/schemaVariable';
import { segmentResource } from './glossary/segment';
import { spaceResource } from './glossary/space';
import { styleResource } from './glossary/style';
import { styleSelectorResource } from './glossary/styleSelector';
import { styleVariableResource } from './glossary/styleVariable';
import { workflowDataResource } from './workflows/data';
import { workflowElementsResource } from './workflows/elements';
import { workflowSegmentsResource } from './workflows/segments';
import { workflowStylesResource } from './workflows/styles';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { McpResource } from '@plitzi/sdk-shared';

const glossaryResources = [
  schemaResource,
  elementResource,
  pageResource,
  styleResource,
  styleSelectorResource,
  styleVariableResource,
  segmentResource,
  pluginResource,
  collectionResource,
  spaceResource,
  environmentResource,
  schemaVariableResource,
  resourceResource,
  bindingResource,
  interactionResource,
  displayModeResource
];

const workflowResources = [
  workflowElementsResource,
  workflowStylesResource,
  workflowSegmentsResource,
  workflowDataResource
];

export const registerResources = (
  server: McpServer,
  custom: McpResource[] = [],
  onRead?: (name: string, uri: string) => void
): void => {
  for (const r of [...glossaryResources, ...workflowResources, ...custom]) {
    server.registerResource(r.name, r.uri, { description: r.description, mimeType: r.mimeType }, () => {
      onRead?.(r.name, r.uri);

      return { contents: [{ uri: r.uri, mimeType: r.mimeType, text: r.content }] };
    });
  }
};

// Shared registry so the same docs are reachable both as native MCP resources (OpenCode) and as
// the read_resource / list_resources tools (every provider).
export const allResources: McpResource[] = [...glossaryResources, ...workflowResources];

export const getResourceList = (): { uri: string; name: string; description: string }[] =>
  allResources.map(({ uri, name, description }) => ({ uri, name, description }));

export const getResourceByUri = (uri: string): McpResource | undefined => allResources.find(r => r.uri === uri);
