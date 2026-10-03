/* eslint-disable quotes -- the generated code quotes its own strings, and reads best in the other quotes */
import { describe, expect, it } from 'vitest';

import { pluginNames } from './names';
import { shapeFromFlags } from './shape';
import { elementFiles } from './source';

const ticker = () => {
  const { shape } = shapeFromFlags({
    prop: ['interval:number=5000', 'paused:boolean', 'label:string=Tick'],
    trigger: ['onTick:count'],
    callback: ['reset'],
    headless: true
  });
  if (!shape) {
    throw new Error('the flags describe a shape');
  }

  return elementFiles(
    { ...pluginNames('ticker'), title: 'Ticker' },
    { title: 'Ticker', description: '', owner: '' },
    shape
  );
};

describe('shapeFromFlags', () => {
  it('is no shape at all without flags, which keeps the example', () => {
    expect(shapeFromFlags({ prop: [], trigger: [], callback: [] })).toEqual({});
  });

  it('reads each prop with its type and default, an event with its fields, and an action', () => {
    expect(
      shapeFromFlags({
        prop: ['interval:number=5000', 'paused:boolean'],
        trigger: ['onTick:count,at'],
        callback: ['reset']
      })
    ).toEqual({
      shape: {
        props: [
          { name: 'interval', type: 'number', value: 5000 },
          { name: 'paused', type: 'boolean', value: false }
        ],
        triggers: [{ name: 'onTick', fields: ['count', 'at'] }],
        callbacks: ['reset'],
        headless: false
      }
    });
  });

  it('says what is wrong with a flag, and how to write it', () => {
    expect(shapeFromFlags({ prop: ['interval'] }).problem).toMatch(/name:type/);
    expect(shapeFromFlags({ prop: ['interval:int'] }).problem).toMatch(/string, number, boolean/);
    expect(shapeFromFlags({ prop: ['className:string'] }).problem).toMatch(/not a prop name of its own/);
    expect(shapeFromFlags({ prop: ['n:number=lots'] }).problem).toMatch(/not a number/);
    expect(shapeFromFlags({ trigger: ['tick'] }).problem).toMatch(/onTick/);
    expect(shapeFromFlags({ trigger: ['onClick'] }).problem).toMatch(/already fires/);
    expect(shapeFromFlags({ callback: ['setState'] }).problem).toMatch(/already answers/);
    expect(shapeFromFlags({ prop: ['reset:string'], callback: ['reset'] }).problem).toMatch(/named twice/);
  });
});

describe('a shaped element', () => {
  it('declares its attributes, events and actions — what a space is checked against', () => {
    const declaration = ticker()['declaration.ts'];

    expect(declaration).toContain("attributes: { interval: 5000, paused: false, label: 'Tick' }");
    expect(declaration).toContain("preview: { count: '' }");
    expect(declaration).toContain("reset: { action: 'reset', title: 'Reset', type: 'callback', params: {} }");
    expect(declaration).toContain("{ path: 'interval', label: 'Interval' }");
  });

  it('fires its events through a typed hook, and answers its actions', () => {
    const component = ticker()['Ticker.tsx'];

    expect(component).toContain('export const useTickerEvents = () =>');
    expect(component).toContain('onTick: { count: unknown };');
    expect(component).toContain('...declaration.callbacks.reset');
  });

  it('headless, hides itself on a page and shows a badge in the builder', () => {
    const component = ticker()['Ticker.tsx'];

    expect(component).toContain('const style = previewMode ? HIDDEN : BADGE;');
    expect(component).toContain("const HIDDEN: CSSProperties = { display: 'none' };");
  });

  it('gives the builder a control per attribute, by its type', () => {
    const settings = ticker()['Settings.tsx'];

    expect(settings).toContain('type="number" value={interval}');
    expect(settings).toContain('type="checkbox" checked={paused}');
    expect(settings).toContain("onUpdate?.('label', event.target.value)");
  });
});
