import { use, useCallback } from 'react';

import QaContext from '../../../../qa/QaContext';
import { QA_CHECKS } from '../../../../qa/qaSettings';

/** Every check on at once — or off, when they all are. */
const QaAllChecksButton = () => {
  const { settings, setCheck } = use(QaContext);
  const all = QA_CHECKS.every(check => settings.checks[check]);

  const label = all ? 'None' : 'Run all';

  const handleClick = useCallback(() => QA_CHECKS.forEach(check => setCheck(check, !all)), [setCheck, all]);

  return (
    <button
      type="button"
      className="rounded px-1.5 py-0.5 font-medium normal-case hover:bg-zinc-100 dark:hover:bg-zinc-800"
      onClick={handleClick}
    >
      {label}
    </button>
  );
};

export default QaAllChecksButton;
