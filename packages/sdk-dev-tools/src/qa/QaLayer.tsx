import { use, useEffect, useMemo } from 'react';

import { treeOf } from '@plitzi/sdk-schema/helpers/components';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import { CHECKS } from './checks';
import { NO_FINDINGS } from './findings';
import QaGrid from './overlays/QaGrid';
import QaInspector from './overlays/QaInspector';
import QaTabOrder from './overlays/QaTabOrder';
import QaViewport from './overlays/QaViewport';
import QaXrayTags from './overlays/QaXrayTags';
import QaContext from './QaContext';
import { VISION_MATRIX, qaCss, visionFilterId } from './qaCss';
import { QA_CHECKS, QA_FINDING_ATTRIBUTE, QA_PAGE_ATTRIBUTE, REDUCED_MOTION_CLASS, isQaActive } from './qaSettings';
import usePageBox from './usePageBox';
import { NO_XRAY_COUNTS, XRAY_ATTRIBUTE, xrayMarksOf } from './xray';

import type { QaFindings } from './findings';

const SVG = 'http://www.w3.org/2000/svg';

/** How long the checks wait for a resize to settle before they look again. */
const RESCAN_AFTER_MS = 250;

/** The longest a look waits for the page to be idle. */
const IDLE_TIMEOUT_MS = 1000;

/** How long the page has to stay still before the x-ray marks it again. */
const REMARK_AFTER_MS = 200;

/** The speed every animation plays at in slow motion. */
const SLOW_MOTION_RATE = 0.25;

/**
 * What the QA tab has on, applied to the page — mounted with the dev tools whether the panel is open or not, so a
 * tester can fold the panel away and keep the grid.
 *
 * Its rules go in the document's head and its marks on the page's elements, which is where the page is; the grid and
 * the size badge are drawn by React, beside the panel.
 */
const QaLayer = () => {
  const { settings, pageRef, round, setFindings, setXrayCounts } = use(QaContext);
  const [[currentPageId, flat, components]] = useCommonStore([
    'navigation.currentPageId',
    'schema.flat',
    'schema.components'
  ]);
  const box = usePageBox(pageRef);
  const active = isQaActive(settings);
  const css = useMemo(() => qaCss(settings), [settings]);
  // As words, so the checks look again when which of them are on changes, not whenever the settings object does.
  const checksOn = useMemo(() => QA_CHECKS.filter(check => settings.checks[check]).join(' '), [settings.checks]);

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

  // The page's elements are named in the DOM; what is wired to them is in the document, read by that name.
  useEffect(() => {
    const page = pageRef.current;
    if (!page || !settings.xray) {
      setXrayCounts(NO_XRAY_COUNTS);

      return undefined;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const mark = () => {
      const counts = { ...NO_XRAY_COUNTS };
      page.querySelectorAll('[data-plitzi-el]').forEach(element => {
        const id = element.getAttribute('data-plitzi-el') ?? '';
        const definition = treeOf({ flat, components }, id)?.flat[id]?.definition;
        const marks = definition ? xrayMarksOf(definition) : [];
        marks.forEach(found => {
          counts[found] += 1;
        });
        if (marks.length === 0) {
          element.removeAttribute(XRAY_ATTRIBUTE);
        } else if (element.getAttribute(XRAY_ATTRIBUTE) !== marks.join(' ')) {
          element.setAttribute(XRAY_ATTRIBUTE, marks.join(' '));
        }
      });
      setXrayCounts(counts);
    };
    const markLater = () => {
      clearTimeout(timer);
      timer = setTimeout(mark, REMARK_AFTER_MS);
    };
    mark();
    // What a list renders, a page switched to, a panel opened: new elements, marked once the page settles. The marks'
    // own attribute is left out, or marking would wake the observer it answers.
    const observer = new MutationObserver(markLater);
    observer.observe(page, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      page.querySelectorAll(`[${XRAY_ATTRIBUTE}]`).forEach(element => element.removeAttribute(XRAY_ATTRIBUTE));
    };
  }, [settings.xray, pageRef, flat, components, currentPageId, setXrayCounts]);

  // Every animation the page plays — those running, and each one that starts after — at a quarter of its speed.
  useEffect(() => {
    const page = pageRef.current;
    if (!page || !settings.slowMotion) {
      return undefined;
    }

    const playAt = (rate: number) =>
      page.getAnimations({ subtree: true }).forEach(animation => {
        animation.playbackRate = rate;
      });
    const slow = () => playAt(SLOW_MOTION_RATE);
    slow();
    page.addEventListener('animationstart', slow);
    page.addEventListener('transitionrun', slow);

    return () => {
      page.removeEventListener('animationstart', slow);
      page.removeEventListener('transitionrun', slow);
      playAt(1);
    };
  }, [settings.slowMotion, pageRef]);

  // The checks look at the page as drawn: again on demand, when the window settles at a new size, and on another page.
  useEffect(() => {
    const page = pageRef.current;
    const checks = QA_CHECKS.filter(check => checksOn.split(' ').includes(check));
    if (!page || checks.length === 0) {
      setFindings(NO_FINDINGS);

      return undefined;
    }

    let marked: Element[] = [];
    const look = () => {
      marked.forEach(element => element.removeAttribute(QA_FINDING_ATTRIBUTE));
      const found: QaFindings = { ...NO_FINDINGS };
      for (const check of checks) {
        found[check] = CHECKS[check].run(page);
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
    let idle: number | undefined;
    // When the page has a moment: a check walks every element, and never in the way of a click or a frame.
    const lookWhenIdle = () => {
      if (typeof requestIdleCallback === 'function') {
        idle = requestIdleCallback(look, { timeout: IDLE_TIMEOUT_MS });
      } else {
        look();
      }
    };
    const lookLater = () => {
      clearTimeout(timer);
      if (idle !== undefined && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idle);
      }

      timer = setTimeout(lookWhenIdle, RESCAN_AFTER_MS);
    };
    // Not at once: a page just switched to is still being drawn.
    lookLater();
    window.addEventListener('resize', lookLater);

    return () => {
      clearTimeout(timer);
      if (idle !== undefined && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idle);
      }

      window.removeEventListener('resize', lookLater);
      marked.forEach(element => element.removeAttribute(QA_FINDING_ATTRIBUTE));
    };
  }, [checksOn, pageRef, round, currentPageId, setFindings]);

  return (
    <>
      {settings.grid && <QaGrid box={box} />}
      {settings.xray && <QaXrayTags filter={settings.xrayFilter} />}
      {settings.tabOrder && <QaTabOrder />}
      {settings.inspect && <QaInspector />}
      {settings.viewport && <QaViewport box={box} />}
    </>
  );
};

export default QaLayer;
