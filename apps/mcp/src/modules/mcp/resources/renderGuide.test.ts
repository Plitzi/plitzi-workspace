import { describe, expect, it } from 'vitest';

import {
  readRenderResource,
  RENDER_GUIDE_URI,
  renderGuideCore,
  renderGuideText,
  renderGuideTopics,
  renderGuideTopicUri
} from './renderGuide';

import type { RenderGuideTopic } from './renderGuide';

const text = (uri: string): unknown => readRenderResource(uri)?.data;

describe('the render guide, whole and in parts', () => {
  /** One text: the sections are cut from it, so the guide and its parts cannot say different things. */
  it('is its sections, every one with a topic', () => {
    const sections = renderGuideText.split(/\n(?=## )/).slice(1);

    expect(Object.values(renderGuideTopics)).toEqual(sections.map(section => section.trim()));
  });

  it('serves each section on its own, and the whole guide at its address', () => {
    for (const [topic, section] of Object.entries(renderGuideTopics)) {
      expect(text(renderGuideTopicUri(topic as RenderGuideTopic))).toBe(section);
    }

    expect(text(RENDER_GUIDE_URI)).toBe(renderGuideText);
    expect(readRenderResource(`${RENDER_GUIDE_URI}/nothing`)).toBeUndefined();
  });

  /** For a host that counts its tokens: what a first widget needs whole, and where every other part is. */
  it('keeps in its core what a first widget needs, and names where the rest is', () => {
    for (const topic of ['one-call', 'theme', 'types', 'small', 'fails'] as const) {
      expect(renderGuideCore).toContain(renderGuideTopics[topic]);
    }

    for (const topic of ['repeat', 'classes', 'layout', 'svg', 'example', 'data'] as const) {
      expect(renderGuideCore).not.toContain(renderGuideTopics[topic]);
      expect(renderGuideCore).toContain(renderGuideTopicUri(topic));
    }

    expect(renderGuideCore.length).toBeLessThan(renderGuideText.length / 2);
  });
});
