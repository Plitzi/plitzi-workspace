import { describe, expect, it } from 'vitest';

import { parseBackgroundLayers, serializeLayersToCSS } from './backgroundParser';

import type { BackgroundCSSValues } from './backgroundParser';

/** What the layers write back after being read — the property a person changes nothing in must come back as it was. */
const roundTrip = (values: BackgroundCSSValues): BackgroundCSSValues =>
  serializeLayersToCSS(parseBackgroundLayers(values));

describe('parseBackgroundLayers', () => {
  it('reads nothing from no image', () => {
    expect(parseBackgroundLayers({})).toEqual([]);
    expect(parseBackgroundLayers({ 'background-image': 'none' })).toEqual([]);
  });

  it('reads an image in each way a url is quoted', () => {
    const layers = parseBackgroundLayers({
      'background-image': 'url("a.png"), url(\'b.png\'), url(c.png)'
    });

    expect(layers.map(layer => [layer.type, layer.url])).toEqual([
      ['url', 'a.png'],
      ['url', 'b.png'],
      ['url', 'c.png']
    ]);
  });

  it('reads a linear gradient with a keyword direction, a negative angle and stops in rgba()', () => {
    const [toRight, negative] = parseBackgroundLayers({
      'background-image':
        'linear-gradient(to right, rgba(0, 0, 0, 0.5) 0%, #fff 100%), linear-gradient(-45deg, red, blue)'
    });

    expect(toRight.angle).toBe('to right');
    expect(toRight.stops.map(stop => [stop.color, stop.position])).toEqual([
      ['rgba(0, 0, 0, 0.5)', '0%'],
      ['#fff', '100%']
    ]);
    expect(negative.angle).toBe('-45deg');
    expect(negative.stops.map(stop => stop.color)).toEqual(['red', 'blue']);
  });

  it('reads a stop with two positions as one stop', () => {
    const [layer] = parseBackgroundLayers({ 'background-image': 'linear-gradient(90deg, red 10% 20%, blue)' });

    expect(layer.stops[0]).toMatchObject({ color: 'red', position: '10% 20%' });
  });

  it('reads a radial gradient with an explicit size, keeping it', () => {
    const [layer] = parseBackgroundLayers({
      'background-image': 'radial-gradient(circle 100px at 20% 30%, red, blue)'
    });

    expect(layer).toMatchObject({ radialShape: 'circle', radialExtent: '100px', radialPosition: '20% 30%' });
  });

  it('reads a conic gradient with its angle and center', () => {
    const [layer] = parseBackgroundLayers({
      'background-image': 'conic-gradient(from -0.25turn at 50% 40%, red, blue)'
    });

    expect(layer).toMatchObject({ conicAngle: '-0.25turn', conicPosition: '50% 40%' });
  });

  it('reads a repeating gradient as one that repeats', () => {
    const [layer] = parseBackgroundLayers({
      'background-image': 'repeating-linear-gradient(45deg, red 0 10px, blue 10px 20px)'
    });

    expect(layer).toMatchObject({ type: 'linear-gradient', repeating: true });
  });

  it('keeps what it cannot read as a layer of its own, word for word', () => {
    const [token, imageSet] = parseBackgroundLayers({
      'background-image': 'var(--hero-bg), image-set("a.png" 1x, "a@2x.png" 2x)'
    });

    expect(token).toMatchObject({ type: 'raw', raw: 'var(--hero-bg)' });
    expect(imageSet).toMatchObject({ type: 'raw', raw: 'image-set("a.png" 1x, "a@2x.png" 2x)' });
  });

  it('reads a one-value position the way CSS does', () => {
    const [percent, keyword] = parseBackgroundLayers({
      'background-image': 'url(a.png), url(b.png)',
      'background-position': '20%, top'
    });

    expect([percent.positionX, percent.positionY]).toEqual(['20%', 'center']);
    expect([keyword.positionX, keyword.positionY]).toEqual(['center', 'top']);
  });

  it('repeats a shorter list over the layers, as CSS does', () => {
    const layers = parseBackgroundLayers({
      'background-image': 'url(a.png), url(b.png)',
      'background-size': 'cover',
      'background-repeat': 'no-repeat'
    });

    expect(layers.map(layer => [layer.size, layer.repeat])).toEqual([
      ['cover', 'no-repeat'],
      ['cover', 'no-repeat']
    ]);
  });

  it('reads an unset repeat as CSS initial value, which tiles', () => {
    const [layer] = parseBackgroundLayers({ 'background-image': 'url(a.png)' });

    expect(layer.repeat).toBe('repeat');
  });
});

describe('serializeLayersToCSS', () => {
  it('writes every layer property back as it was read', () => {
    const values: BackgroundCSSValues = {
      'background-image':
        'url("a.png"), linear-gradient(to right, rgba(0, 0, 0, 0.5) 0%, #fff 100%), var(--hero-bg), repeating-radial-gradient(circle 100px at 20% 30%, red, blue)',
      'background-size': 'cover, auto, 50% auto, contain',
      'background-position': 'center center, 0% 0%, right 10px bottom 20px, 20% center',
      'background-repeat': 'no-repeat, repeat-x, repeat, no-repeat',
      'background-attachment': 'fixed, scroll, scroll, local',
      'background-clip': 'border-box, padding-box, border-box, content-box'
    };

    expect(roundTrip(values)).toEqual(values);
  });

  it('writes a gradient that says nothing before its stops as it was — no default added', () => {
    const image = 'linear-gradient(red, blue), radial-gradient(red, 40%, blue), conic-gradient(red, blue)';

    expect(roundTrip({ 'background-image': image })['background-image']).toBe(image);
  });

  it('removes every property when there is no layer left', () => {
    expect(serializeLayersToCSS([])).toEqual({
      'background-image': undefined,
      'background-size': undefined,
      'background-position': undefined,
      'background-repeat': undefined,
      'background-attachment': undefined,
      'background-clip': undefined
    });
  });
});
