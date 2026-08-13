import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { createReporter } from './createReporter';
import { getReporter, setReporter } from './reporterRegistry';

import type { AnalyticsConfig } from '@plitzi/sdk-shared';

export type AnalyticsReporterProps = {
  analytics?: AnalyticsConfig;
};

/**
 * Renders nothing; reports what only the browser can see.
 *
 * It exists at all because the server sees a visit once — the SSR render, or the schema fetch of a
 * client-side render — and then never again, however long the visitor stays or however many routes they move
 * through. Those are this component's, along with named interactions.
 *
 * `firstViewCounted` is the seam between the two: when the server already counted this page load, the first
 * render here would be the same view a second time, so it is skipped and only subsequent routes are reported.
 */
const AnalyticsReporter = ({ analytics }: AnalyticsReporterProps) => {
  const location = useLocation();
  // Whether the view about to be reported is the one the server already counted. A ref, not state: it must
  // change without causing the render that would report it.
  const skipFirst = useRef(analytics?.firstViewCounted === true);

  useEffect(() => {
    if (!analytics?.endpoint || !analytics.key) {
      return undefined;
    }

    const reporter = createReporter(analytics);
    setReporter(reporter);

    return () => {
      setReporter(undefined);
      reporter.stop();
    };
  }, [analytics]);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;

      return;
    }

    // Read through the registry rather than closing over the reporter, so a route change during the same
    // render pass that (re)created it still reports against the live one.
    getReporter()?.trackRender();
  }, [location.pathname, location.search]);

  return null;
};

export default AnalyticsReporter;
