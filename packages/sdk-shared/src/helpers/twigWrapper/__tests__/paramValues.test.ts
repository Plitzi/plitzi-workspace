import { describe, expect, it } from 'vitest';

import { processTwigParam, resolveStepParam } from '../index';

/**
 * What a flow step is handed for a param. The type is the value's own — never guessed from what its text looks like:
 * a password typed as `1234` is text, and so is a zip code, a PIN, an id.
 */
describe('processTwigParam', () => {
  it('hands on one expression’s value exactly as it is', () => {
    expect(processTwigParam('{{ password }}', { password: '1234' })).toBe('1234');
    expect(processTwigParam('{{ flag }}', { flag: 'true' })).toBe('true');
    expect(processTwigParam('{{ count }}', { count: 3 })).toBe(3);
    expect(processTwigParam('{{ on }}', { on: false })).toBe(false);
    expect(processTwigParam('{{ doc }}', { doc: { a: 1 } })).toEqual({ a: 1 });
    expect(processTwigParam('  {{ rows|filter(r => r.open) }}  ', { rows: [{ open: true }, { open: false }] })).toEqual(
      [{ open: true }]
    );
  });

  it('reads a value that is not there as an empty string, as it renders', () => {
    expect(processTwigParam('{{ missing }}', {})).toBe('');
  });

  // The author wrote JSON on purpose: the param is the value it encodes.
  it('hands on the value a JSON filter encodes', () => {
    expect(processTwigParam('{{ saved|json_encode }}', { saved: { id: 7 } })).toEqual({ id: 7 });
    expect(processTwigParam('{{ name|to_json }}', { name: 'Ada' })).toBe('Ada');
  });

  it('reads text around the tokens as a JSON document only when it is one', () => {
    expect(processTwigParam('{ "id": "{{ id }}" }', { id: '0012' })).toEqual({ id: '0012' });
    expect(processTwigParam('[{{ a }}, {{ b }}]', { a: 1, b: 2 })).toEqual([1, 2]);
    expect(processTwigParam('{{ a }}{{ b }}', { a: '1', b: '2' })).toBe('12');
    expect(processTwigParam('{{ size }}px', { size: 4 })).toBe('4px');
  });

  it('renders tags as the text they make', () => {
    expect(processTwigParam('{% if on %}yes{% endif %}', { on: true })).toBe('yes');
  });

  it('leaves text with no template alone', () => {
    expect(processTwigParam('1234', {})).toBe('1234');
  });
});

/** The one resolver both sides use: what the server used to skip was any template `hasValidToken` does not call a token. */
describe('resolveStepParam', () => {
  const scope = { run: { id: 'r1', done: true }, next: '{{ run.id }}' };

  it('runs a template that is not a plain name — an object, a condition', () => {
    expect(resolveStepParam('{{ { "id": run.id, "done": run.done }|json_encode }}', scope).value).toEqual({
      id: 'r1',
      done: true
    });
    // eslint-disable-next-line quotes -- a template quoting its own strings reads best in the other quotes
    expect(resolveStepParam("{{ run.done ? 'yes' : 'no' }}", scope).value).toBe('yes');
  });

  it('reads a value that is itself a template again', () => {
    expect(resolveStepParam('{{ next }}', scope)).toEqual({ value: 'r1', unresolved: false });
  });

  it('says so when a template keeps resolving to another', () => {
    expect(resolveStepParam('{{ loop }}', { loop: '{{ loop }}' }).unresolved).toBe(true);
  });

  it('does not evaluate braces inside what it resolved when they are not a token', () => {
    expect(resolveStepParam('{{ typed }}', { typed: 'see {% if x %}this{% endif %}' }).value).toBe(
      'see {% if x %}this{% endif %}'
    );
  });
});
