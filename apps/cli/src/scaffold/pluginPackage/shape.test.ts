/* eslint-disable quotes -- the generated code quotes its own strings, and reads best in the other quotes */
import { format } from 'prettier';
import { describe, expect, it } from 'vitest';

import { pluginNames } from './names';
import { shapeFromFlags } from './shape';
import { elementFiles } from './source';
import { qualityFilesFor } from '../quality';

/** The Prettier a new project is formatted with. */
const PRETTIER = JSON.parse(qualityFilesFor('browser', [])['.prettierrc']) as Record<string, unknown>;

const ticker = () => {
  const { shape } = shapeFromFlags({
    prop: ['interval:number=5000', 'paused:boolean', 'label:string=Tick', 'rows:list', 'meta:json'],
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
    expect(shapeFromFlags({ prop: ['rows:list=[1]'] }).problem).toMatch(/data a binding fills/);
  });
});

describe('a shaped element', () => {
  it('declares its attributes, events and actions — what a space is checked against', () => {
    const declaration = ticker()['declaration.ts'];

    expect(declaration).toContain("attributes: { interval: 5000, paused: false, label: 'Tick', rows: [], meta: {} }");
    // Headless: a page check does not look for it on screen.
    expect(declaration).toContain('drawsNothing: true,');
    expect(declaration).toContain("preview: { count: '' }");
    expect(declaration).toContain('callbacks: { reset: {} }');
    // Everything else every plugin shares is `definePlugin`'s to write: the builder's gestures, the catalogue, bindings.
    expect(declaration).toContain('export default definePlugin<TickerAttributes>()({');
    expect(declaration).not.toContain('bindingsAllowed');
  });

  it('fires its events through the SDK’s typed hook, and answers its actions', () => {
    const component = ticker()['Ticker.tsx'];

    // No hook of its own to copy: `usePluginTrigger` reads the events, and what each hands a flow, off the declaration.
    expect(component).toContain("usePluginTrigger(declaration); fire('onTick', { count: … })");
    expect(component).not.toContain('useTickerEvents');
    expect(component).toContain('...declaration.callbacks.reset');
  });

  /** Data — rows, a record — is what a binding fills: typed as such, empty until then, and with no control of its own. */
  it('takes data a binding fills as a list or a record', () => {
    const { 'Ticker.tsx': component, 'Settings.tsx': settings } = ticker();

    expect(component).toContain('rows?: unknown[];');
    expect(component).toContain('meta?: Record<string, unknown>;');
    expect(settings).toContain('Rows: data — bind it to a source.');
    expect(settings).not.toContain('rows = []');
  });

  it('headless, hides itself on a page and shows a badge in the builder', () => {
    const component = ticker()['Ticker.tsx'];

    expect(component).toContain('const style = previewMode ? HIDDEN : BADGE;');
    expect(component).toContain("const HIDDEN: CSSProperties = { display: 'none' };");
  });

  it('gives the builder a control per attribute, by its type', () => {
    const settings = ticker()['Settings.tsx'];

    expect(settings).toContain("onChange={event => onUpdate?.('interval', Number(event.target.value))}");
    expect(settings).toContain('type="checkbox" checked={paused}');
    expect(settings).toContain("onUpdate?.('label', event.target.value)");
  });

  it('writes the panel as Prettier would, a control too long for one line one attribute per line', async () => {
    const settings = ticker()['Settings.tsx'];

    expect(await format(settings, { ...PRETTIER, filepath: 'Settings.tsx' })).toBe(settings);
  });
});
