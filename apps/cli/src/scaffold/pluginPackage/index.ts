import { buildFiles } from './build';
import { docsFiles } from './docs';
import { pluginNames } from './names';
import { packageFiles } from './package';
import { previewFiles } from './preview';
import { elementFiles, packageSourceFiles } from './source';
import { visualFiles } from './visual';
import { managerFiles } from '../packageManager';
import { qualityFilesFor } from '../quality';

import type { ElementText } from './source';
import type { PluginAnswers, ProjectFiles } from '../types';

export { pluginNameProblem, pluginNames } from './names';
export { declarationsRegistry, elementsRegistry } from './source';
export type { PluginNames } from './names';
export type { ElementText } from './source';

/** What the build writes, and what is nobody's to format or lint. */
const OUTPUTS = ['dist', 'visual/.results'];

/**
 * Every file of a plugin package: the element, the build that publishes it, a space to preview it in, and what checks
 * it — a project of its own, with nothing about it shared with whatever repository it sits in except the folder.
 */
export const scaffoldPlugin = (answers: PluginAnswers): ProjectFiles => {
  const names = pluginNames(answers.packageName);
  const elements = answers.elements.map(element => ({
    names: { ...pluginNames(element.name), title: element.title },
    text: { title: element.title, description: element.description, owner: answers.owner }
  }));
  const elementNames = elements.map(element => element.names);

  return {
    ...(answers.inProject ? {} : managerFiles(answers.packageManager, answers.managerVersion)),
    ...packageFiles(names, answers),
    ...qualityFilesFor('browser', OUTPUTS),
    ...packageSourceFiles(elements),
    ...buildFiles(),
    ...previewFiles(elementNames),
    ...visualFiles(elementNames, answers),
    ...docsFiles(elementNames, answers)
  };
};

/**
 * One element, for a folder of a project that already exists: paths relative to the element's own folder. `title` is
 * the label it renders until an attribute says otherwise.
 */
export const scaffoldElement = (name: string, text: ElementText): ProjectFiles =>
  elementFiles({ ...pluginNames(name), title: text.title }, text);
