import { use } from 'react';

import ConnectorSectionContext from '../ConnectorSection/ConnectorSectionContext';

export type FieldHelpProps = {
  children: string;
};

/**
 * The explanation for one field, shown only while its section has help turned on.
 *
 * The same text is always on the field as a `title`, so hovering answers the question without turning anything on.
 * This is the version for someone meeting the form for the first time.
 */
const FieldHelp = ({ children }: FieldHelpProps) => {
  const showHelp = use(ConnectorSectionContext);
  if (!showHelp) {
    return null;
  }

  return <span className="-mt-1 text-xs text-gray-500 dark:text-zinc-400">{children}</span>;
};

export default FieldHelp;
