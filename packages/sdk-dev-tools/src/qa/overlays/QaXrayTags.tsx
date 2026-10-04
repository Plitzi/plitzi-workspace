import { use, useEffect, useState } from 'react';

import QaContext from '../QaContext';
import { XRAY, XRAY_ATTRIBUTE, XRAY_MARKS } from '../xray';

import type { XrayFilter, XrayMark } from '../xray';

/** The most tags drawn at once: past it the page is a wall of labels, and the outlines say the rest. */
const MOST_TAGS = 150;

/** A tag's height and step: one that would land on another moves down by this much, thrice at most, then is skipped. */
const TAG_HEIGHT = 16;

type Tag = { id: string; marks: XrayMark[]; left: number; top: number };

const isMark = (value: string): value is XrayMark => XRAY_MARKS.some(mark => mark === value);

/** The tags for what is in the window now: each marked element's name and marks, at its top-left corner. */
const tagsOf = (page: Element, filter: TaggedFilter): Tag[] => {
  const tags: Tag[] = [];
  const taken = new Set<string>();
  for (const element of page.querySelectorAll(`[${XRAY_ATTRIBUTE}]`)) {
    if (tags.length >= MOST_TAGS) {
      break;
    }

    const marks = (element.getAttribute(XRAY_ATTRIBUTE) ?? '').split(' ').filter(isMark);
    if (filter !== 'all' && !marks.includes(filter)) {
      continue;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
      continue;
    }

    // On the element's top edge, outside it, so the tag covers none of what it names — inside where the window's edge
    // leaves no room. Nested elements share a corner: each later one steps down below the tag already there.
    const corner = (y: number) => `${String(Math.round(rect.left))}:${String(Math.round(y))}`;
    let top = rect.top >= TAG_HEIGHT ? rect.top - TAG_HEIGHT + 1 : Math.max(rect.top, 0);
    for (let step = 0; step < 3 && taken.has(corner(top)); step += 1) {
      top += TAG_HEIGHT;
    }

    if (taken.has(corner(top))) {
      continue;
    }

    taken.add(corner(top));
    tags.push({ id: element.getAttribute('data-plitzi-el') ?? '', marks, left: rect.left, top });
  }

  return tags;
};

/** What there are tags for: the boxes alone carry none. */
type TaggedFilter = Exclude<XrayFilter, 'none'>;

export type QaXrayTagsProps = { filter: TaggedFilter };

/**
 * Every element the x-ray marked, named on its corner with a dot for each thing wired to it — so the page says which of
 * its parts are bound, conditional, interactive or moving without pointing at each one.
 */
const QaXrayTags = ({ filter }: QaXrayTagsProps) => {
  const { pageRef } = use(QaContext);
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) {
      return undefined;
    }

    let frame = 0;
    const redraw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTags(tagsOf(page, filter)));
    };
    redraw();
    const observer = new MutationObserver(redraw);
    observer.observe(page, { subtree: true, attributes: true, attributeFilter: [XRAY_ATTRIBUTE] });
    document.addEventListener('scroll', redraw, true);
    window.addEventListener('resize', redraw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('scroll', redraw, true);
      window.removeEventListener('resize', redraw);
    };
  }, [pageRef, filter]);

  return (
    <>
      {tags.map(({ id, marks, left, top }) => (
        <span
          key={`${id}-${String(left)}-${String(top)}`}
          className="pointer-events-none fixed z-[999998] flex h-[15px] max-w-56 items-center gap-1 rounded-sm bg-zinc-900/85 px-1 font-mono text-[10px] leading-none text-white shadow-sm"
          style={{ left, top }}
        >
          {marks.map(mark => (
            <span
              key={mark}
              title={XRAY[mark].label}
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: XRAY[mark].colour }}
            />
          ))}
          <span className="truncate">{id}</span>
        </span>
      ))}
    </>
  );
};

export default QaXrayTags;
