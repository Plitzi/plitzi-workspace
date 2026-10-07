import { projectSpaceAt } from '@plitzi/sdk-authoring/node';

import type { ProjectSpaceSource } from '@plitzi/sdk-authoring/node';

/** What `projectSpaceAt` refuses with a message that is the whole report: the root, the layout, a module with no space. */
const REPORTS: ReadonlySet<string> = new Set(['ProjectRootError', 'ProjectLayoutError', 'ProjectSpaceError']);

/**
 * The project's own declaration, loaded as its server and its `author` script load it (`projectSpaceAt`) — for a
 * command that authors it in this process, at the root it found from whichever folder of the project it was run in. A
 * project refused before its space is authored is said as the problem, in the words the server says it.
 */
export const loadProjectSpace = async (root: string): Promise<ProjectSpaceSource | { problem: string }> => {
  try {
    return await projectSpaceAt(root);
  } catch (error) {
    if (error instanceof Error && REPORTS.has(error.name)) {
      return { problem: error.message };
    }

    throw error;
  }
};
