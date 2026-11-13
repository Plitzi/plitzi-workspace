import QaAllChecksButton from './QaAllChecksButton';
import QaCheckRow from './QaCheckRow';
import QaRescanButton from './QaRescanButton';
import { QA_CHECKS } from '../../../../qa/qaSettings';

/** The checks a tester runs on every page, each outlining on the page what it finds. */
const QaChecks = () => (
  <section className="flex min-w-0 flex-col gap-1.5">
    <div className="text-ui-fg-subtle flex items-center justify-between gap-2 text-[10px] font-semibold tracking-wider uppercase">
      <span className="flex items-center gap-2">
        <i className="fa-solid fa-list-check" />
        Checks
      </span>
      <span className="flex items-center gap-1">
        <QaRescanButton />
        <QaAllChecksButton />
      </span>
    </div>
    <div className="border-ui-line overflow-hidden rounded border">
      {QA_CHECKS.map(check => (
        <QaCheckRow key={check} check={check} />
      ))}
    </div>
  </section>
);

export default QaChecks;
