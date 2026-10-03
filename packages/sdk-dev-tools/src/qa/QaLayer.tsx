import { use, useEffect, useMemo } from 'react';

import { useCommonStore } from '@plitzi/sdk-shared/store';

import QaContext from './QaContext';
import { VISION_MATRIX, qaCss, visionFilterId } from './qaCss';
import QaGrid from './QaGrid';
import { QA_CHECKS, QA_FINDING_ATTRIBUTE, QA_PAGE_ATTRIBUTE, REDUCED_MOTION_CLASS, isQaActive } from './qaSettings';
import QaViewport from './QaViewport';
import { SCANS } from './scans';
import usePageBox from './usePageBox';

import type { QaFindings } from './QaContext';

const SVG = 'http://www.w3.org/2000/svg';

/** How long the checks wait for a resize to settle before they look again. */
const RESCAN_AFTER_MS = 250;

/**
 * What the QA tab has on, applied to the page — mounted with the dev tools whether the panel is open or not, so a
 * tester can fold the panel away and keep the grid.
 *
 * Its rules go in the document's head and its marks on the page's elements, which is where the page is; the grid and
 * the size badge are drawn by React, beside the panel.
 */
const QaLayer = () => {
  const { settings, pageRef, round, setFindings } = use(QaContext);
  const [currentPageId] = useCommonStore('navigation.currentPageId');
  const box = usePageBox(pageRef);
  const active = isQaActive(settings);
  const css = useMemo(() => qaCss(settings), [settings]);
  const checks = useMemo(() => QA_CHECKS.filter(check => settings.checks[check]), [settings.checks]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page || !active) {
      return undefined;
    }

    page.setAttribute(QA_PAGE_ATTRIBUTE, '');

    return () => page.removeAttribute(QA_PAGE_ATTRIBUTE);
  }, [active, pageRef]);

  useEffect(() => {
    if (!css) {
      return undefined;
    }

    const style = document.createElement('style');
    style.setAttribute('data-plitzi-qa', '');
    style.textContent = css;
    document.head.append(style);

    return () => style.remove();
  }, [css]);

  useEffect(() => {
    if (!settings.reducedMotion) {
      return undefined;
    }

    document.documentElement.classList.add(REDUCED_MOTION_CLASS);

    return () => document.documentElement.classList.remove(REDUCED_MOTION_CLASS);
  }, [settings.reducedMotion]);

  // The dichromacies are SVG filters the page's CSS points at by id, so they live in the page's document.
  useEffect(() => {
    const mode = settings.vision;
    if (mode !== 'protanopia' && mode !== 'deuteranopia' && mode !== 'tritanopia') {
      return undefined;
    }

    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('style', 'position: absolute; width: 0; height: 0');
    const filter = document.createElementNS(SVG, 'filter');
    filter.setAttribute('id', visionFilterId(mode));
    const matrix = document.createElementNS(SVG, 'feColorMatrix');
    matrix.setAttribute('type', 'matrix');
    matrix.setAttribute('values', VISION_MATRIX[mode]);
    filter.append(matrix);
    svg.append(filter);
    document.body.append(svg);

    return () => svg.remove();
  }, [settings.vision]);

  // The checks look at the page as drawn: again on demand, when the window settles at a new size, and on another page.
  useEffect(() => {
    const page = pageRef.current;
    if (!page || checks.length === 0) {
      setFindings({ overflow: [], names: [], targets: [] });

      return undefined;
    }

    let marked: Element[] = [];
    const look = () => {
      marked.forEach(element => element.removeAttribute(QA_FINDING_ATTRIBUTE));
      const found: QaFindings = { overflow: [], names: [], targets: [] };
      for (const check of checks) {
        found[check] = SCANS[check](page);
      }

      const byElement = new Map<Element, string[]>();
      checks.forEach(check =>
        found[check].forEach(({ element }) => byElement.set(element, [...(byElement.get(element) ?? []), check]))
      );
      byElement.forEach((names, element) => element.setAttribute(QA_FINDING_ATTRIBUTE, names.join(' ')));
      marked = [...byElement.keys()];
      setFindings(found);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const lookLater = () => {
      clearTimeout(timer);
      timer = setTimeout(look, RESCAN_AFTER_MS);
    };
    // Not at once: a page just switched to is still being drawn.
    lookLater();
    window.addEventListener('resize', lookLater);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', lookLater);
      marked.forEach(element => element.removeAttribute(QA_FINDING_ATTRIBUTE));
    };
  }, [checks, pageRef, round, currentPageId, setFindings]);

  return (
    <>
      {settings.grid && <QaGrid box={box} />}
      {settings.viewport && <QaViewport box={box} />}
    </>
  );
};

export default QaLayer;
