import { use, useCallback } from 'react';

import QaContext from '../../../../qa/QaContext';

/** Has the checks look again — after opening a menu, say, or switching a tab on the page. */
const QaRescanButton = () => {
  const { rescan } = use(QaContext);

  const handleClick = useCallback(() => rescan(), [rescan]);

  return (
    <button
      type="button"
      className="hover:bg-ui-hover rounded px-1.5 py-0.5 font-medium normal-case"
      onClick={handleClick}
    >
      Look again
    </button>
  );
};

export default QaRescanButton;
