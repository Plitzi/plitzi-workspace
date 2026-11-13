import QaXrayBoxesRow from './QaXrayBoxesRow';
import QaXrayRow from './QaXrayRow';
import { XRAY_MARKS } from '../../../../qa/xray';

/**
 * What the x-ray marks on the page, in its colours, with how many of each the page has — one picked to see only it, or
 * the boxes alone.
 */
const QaXray = () => (
  <section className="flex min-w-0 flex-col gap-1.5">
    <div className="text-ui-fg-subtle flex items-center gap-2 text-[10px] font-semibold tracking-wider uppercase">
      <i className="fa-solid fa-x-ray" />
      X-ray
    </div>
    <div className="border-ui-line overflow-hidden rounded border">
      <QaXrayBoxesRow />
      {XRAY_MARKS.map(mark => (
        <QaXrayRow key={mark} mark={mark} />
      ))}
    </div>
  </section>
);

export default QaXray;
