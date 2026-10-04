import { use } from 'react';

import QaChecks from './QaChecks';
import QaInspectorPanel from './QaInspectorPanel';
import QaToolbar from './QaToolbar';
import QaXray from './QaXray';
import QaContext from '../../../../qa/QaContext';

/**
 * Tools for checking a build in the browser it will be used in — a pre-production deployment, say — rather than in the
 * builder: an inspector for any element, what lines things up, what the document wires to each element, motion and
 * colour, and the checks a tester runs on every page. The bar on top; the x-ray's legend and the checks beside the
 * inspector below, one over the other when the panel is narrow. All of it stays on while the panel is folded away, and
 * in this browser only.
 */
const QaViewer = () => {
  const { settings } = use(QaContext);

  return (
    <div className="@container flex h-full min-h-0 w-full flex-col">
      <QaToolbar />
      <div className="grid min-h-0 grow grid-cols-1 content-start gap-3 overflow-y-auto p-3 @3xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          {settings.xray && <QaXray />}
          <QaChecks />
        </div>
        <QaInspectorPanel />
      </div>
    </div>
  );
};

export default QaViewer;
