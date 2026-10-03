import { isSnippet } from '@plitzi/sdk-shared/schema/snippet';

/** Whether a JSON being uploaded is a snippet — which decides it goes among the snippets rather than the files. */
const isSnippetFile = async (file: File): Promise<boolean> => {
  try {
    return isSnippet(JSON.parse(await file.text()));
  } catch {
    return false;
  }
};

export default isSnippetFile;
