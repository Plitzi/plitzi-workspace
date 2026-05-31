import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  element: z
    .object({
      type: z
        .string()
        .describe(
          'Element type identifier — same values as create_element. Get valid values from get_builder_context (elementDefaults keys).'
        ),
      label: z.string().describe('Human-readable name for the element'),
      props: z.record(z.string(), z.unknown()).optional().describe('Component props')
    })
    .describe('Element to add'),
  parentId: z
    .string()
    .describe(
      'Parent element ID — use the segment baseElementId as the root parent, or any existing segment element ID'
    )
});

const outputSchema = z
  .object({
    id: z.string().describe('Generated element ID')
  })
  .catchall(z.unknown())
  .describe('The created segment element');

const createSegmentElementTool: McpTool = {
  name: 'create_segment_element',
  adapterName: 'createSegmentElement',
  mcpDefinition: {
    title: 'Create Segment Element',
    description: 'Add an element (component instance) to a segment schema.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default createSegmentElementTool;
