import QaXrayRow from './QaXrayRow';
import { XRAY_MARKS } from '../../../../qa/xray';

/** What the x-ray marks on the page, in its colours, with how many of each the page has. */
const QaXray = () => (
  <section className="flex min-w-0 flex-col gap-1.5">
    <div className="flex items-center gap-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
      <i className="fa-solid fa-x-ray" />
      X-ray
    </div>
    <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
      {XRAY_MARKS.map(mark => (
        <QaXrayRow key={mark} mark={mark} />
      ))}
    </div>
  </section>
);

export default QaXray;
