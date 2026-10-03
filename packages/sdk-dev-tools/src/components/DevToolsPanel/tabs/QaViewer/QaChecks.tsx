import QaAllChecksButton from './QaAllChecksButton';
import QaCheckRow from './QaCheckRow';
import QaRescanButton from './QaRescanButton';
import { QA_CHECKS } from '../../../../qa/qaSettings';

/** The checks a tester runs on every page, each outlining on the page what it finds. */
const QaChecks = () => (
  <section className="flex min-w-0 flex-col gap-1.5">
    <div className="flex items-center justify-between gap-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
      <span className="flex items-center gap-2">
        <i className="fa-solid fa-list-check" />
        Checks
      </span>
      <span className="flex items-center gap-1">
        <QaRescanButton />
        <QaAllChecksButton />
      </span>
    </div>
    <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
      {QA_CHECKS.map(check => (
        <QaCheckRow key={check} check={check} />
      ))}
    </div>
  </section>
);

export default QaChecks;
