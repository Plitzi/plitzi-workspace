import { describe, expect, it } from 'vitest';

import { templatePaths, templateRootNames } from '../index';

describe('templateRootNames', () => {
  it('names the first segment of every path a template reads', () => {
    expect(
      templateRootNames('{{apiUrl}}/spaces/{{list_list-spaces.item.id}}/thumbnail?theme={{ theme.resolved }}')
    ).toEqual(['apiUrl', 'list_list-spaces', 'theme']);
  });

  it('finds the names inside tags, filter arguments and ternaries, and none inside a string literal', () => {
    const names = templateRootNames(
      '{% if state.open %}{{ user.name | default(fallback.name) }}{% endif %}{{ "theme.resolved" }}{{ a ? b.c : d }}'
    );

    expect(names.sort()).toEqual(['a', 'b', 'd', 'fallback', 'state', 'user']);
  });

  it('answers nothing for a template with no names in it', () => {
    expect(templateRootNames('plain text')).toEqual([]);
  });
});

describe('templatePaths', () => {
  it('gives each path as far as it is written', () => {
    expect(templatePaths('{{ computed.tool == "pen" ? state.brush.size : theme.resolved }}').sort()).toEqual([
      'computed.tool',
      'state.brush.size',
      'theme.resolved'
    ]);
  });

  it('ends a path at a bracket whose key is only known when it runs, and reads the key too', () => {
    expect(templatePaths('{{ state.owned[source.id] }}').sort()).toEqual(['source.id', 'state.owned']);
  });

  it('keeps a literal index as part of the path', () => {
    expect(templatePaths('{{ rows[0].title }}')).toEqual(['rows.0.title']);
  });

  it('reads paths inside filters, loops and arrows', () => {
    expect(templatePaths('{% for row in list.rows|filter(r => r.open) %}{{ row.id }}{% endfor %}').sort()).toEqual([
      'list.rows',
      'r.open',
      'row.id'
    ]);
  });
});
