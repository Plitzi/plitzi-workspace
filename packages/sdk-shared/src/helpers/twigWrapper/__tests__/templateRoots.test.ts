import { describe, expect, it } from 'vitest';

import { templateRootNames } from '../index';

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
