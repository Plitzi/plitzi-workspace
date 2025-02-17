/* eslint no-template-curly-in-string: 0 */

import BlockJsx from './BlockJsx';

BlockJsx.content = {
  attributes: {
    content:
      'const { content } = props;\nconst {\n  lodash: { get },\n} = utilities;\n\nconst content2 = React.useMemo(() => get(props, "content2", ""), [get, props]);\n\nreturn <Heading content={`${content} ${content2}`} />;\n',
    props: '{"content": "Hello", "content2": "World"}',
    contentCache:
      'dmFyIGNvbXBvbmVudD1mdW5jdGlvbihlKXtlLl9qc3g7dmFyIHQ9ZS5SZWFjdCxuPWUuZ2V0TWFuYWdlcixpPWUucHJvcHMsbz1lLnV0aWxpdGllcyxyPShlLnVzZVBsaXR6aVNlcnZpY2VDb250ZXh0LGkuY29udGVudCksYT1vLmxvZGFzaC5nZXQsbD10LnVzZU1lbW8oKGZ1bmN0aW9uKCl7cmV0dXJuIGEoaSwiY29udGVudDIiLCIiKX0pLFthLGldKTtyZXR1cm4gdC5jcmVhdGVFbGVtZW50KG4oIkhlYWRpbmciKSx7cGxpdHppSnN4U2tpcEhPQzohMCxwbGl0emlKc3hUeXBlOiJIZWFkaW5nIixwbGl0emlKc3hQcm9wczp7Y29udGVudDoiIi5jb25jYXQociwiICIpLmNvbmNhdChsKX19KX0sZ2V0Q29tcG9uZW50PWZ1bmN0aW9uKGUpe3ZhciB0LG49ZS5fanN4LGk9ZS5SZWFjdCxvPWUuZ2V0TWFuYWdlcixyPWUudXNlUGxpdHppU2VydmljZUNvbnRleHQsYT1lLmFsbG93RW1wdHlSZW5kZXIsbD12b2lkIDAhPT1hJiZhLGM9ZS5wcm9wcyxwPXZvaWQgMD09PWM/e306YyxzPWUudXRpbGl0aWVzLHU9dm9pZCAwPT09cz97fTpzO3RyeXt0PWNvbXBvbmVudCh7X2pzeDpuLFJlYWN0OmksZ2V0TWFuYWdlcjpvLHVzZVBsaXR6aVNlcnZpY2VDb250ZXh0OnIscHJvcHM6cCx1dGlsaXRpZXM6dX0pfWNhdGNoKGUpe3Q9aS5jcmVhdGVFbGVtZW50KCJkaXYiLG51bGwsIkNvbXBvbmVudCBNYWxmb3JtZWQsIEVycm9yOiAiLGkuY3JlYXRlRWxlbWVudCgiYiIsbnVsbCxlLm1lc3NhZ2UpKX1maW5hbGx5e3R8fGx8fCh0PWkuY3JlYXRlRWxlbWVudCgiZGl2IixudWxsLCJSZW5kZXIgRW1wdHkiKSl9cmV0dXJuIHR9O2V4cG9ydCBkZWZhdWx0IGdldENvbXBvbmVudDs=',
    allowEmptyRender: false
  },
  definition: {
    label: 'Block JSX',
    type: 'blockJsx',
    bindings: {},
    styleSelectors: {
      base: ''
    },
    initialState: {
      visibility: true
    }
  },
  builder: {
    canDelete: true,
    canSelect: true,
    canDragDrop: true,
    canMove: true,
    canTemplate: true,
    itemsAllowed: [],
    itemsNotAllowed: []
  },
  market: {
    category: 'advanced',
    owner: 'Plitzi',
    verified: true,
    license: 'MIT',
    website: 'https://plitzi.com',
    backgroundColor: '#4422ee',
    icon: 'fa-solid fa-code'
  },
  defaultStyle: {
    name: 'Block JSX',
    displayMode: 'desktop',
    style: {}
  },
  settings: {}
};

BlockJsx.type = 'blockJsx';

export default BlockJsx;
